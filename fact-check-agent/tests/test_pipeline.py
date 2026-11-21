"""Offline tests. The OpenAI client is replaced by a fake, so no API key is needed."""

from __future__ import annotations

import json

import pytest

from factcheck.claims import build_claims, extract_claims, numeric_sentences, uncovered_sentences
from factcheck.llm import LLMError, LLMResponse, parse_json
from factcheck.models import Claim, ClaimResult, Page, Source, Verdict
from factcheck.review import correct_document, find_contradictions
from factcheck.verifier import reconcile, verify_claim

PAGES = [
    Page(page=1, text="Google holds 98% of the global search market. Nvidia was founded in 1993."),
    Page(page=2, text="Tesla delivered 5 million vehicles in 2023. Our team loves coffee."),
]


class FakeLLM:
    """Scripted responses keyed on the instructions / prompt contents."""

    def __init__(self, verdicts: dict[str, dict] | None = None):
        self.calls: list[tuple[str, str, bool]] = []
        self.verdicts = verdicts or {}

    def complete(self, instructions, prompt, web_search=False):
        self.calls.append((instructions, prompt, web_search))
        if "captured" in prompt:  # recall-guard pass
            return LLMResponse(json.dumps({"claims": [
                {"claim": "Tesla delivered 5 million vehicles in 2023.",
                 "quote": "Tesla delivered 5 million vehicles in 2023.", "page": 2},
            ]}))
        if "Extract every specific" in instructions:
            return LLMResponse(json.dumps({"claims": [
                {"claim": "Google holds 98% of the global search market.", "quote": "98%",
                 "category": "statistic", "page": 1},
                {"claim": "Nvidia was founded in 1993.", "page": 1},
                {"claim": "Nvidia was founded in 1993.", "page": 1},  # duplicate
            ]}))
        if "INTERNAL contradictions" in instructions:
            return LLMResponse('{"contradictions": [{"claim_ids": [1, 2, 99], "explanation": "x"}]}')
        if "copy editor" in instructions:
            return LLMResponse('{"corrections": [{"claim_id": 1, "corrected": "Google holds about 90%."}]}')
        assert web_search, "verification must use live web search"
        for needle, body in self.verdicts.items():
            if needle in prompt:
                return LLMResponse("```json\n" + json.dumps(body) + "\n```",
                                   citations=[Source(title="Cited", url="https://cited.example")])
        return LLMResponse(json.dumps({"verdict": "Verified", "confidence": 90}))


# ----------------------------------------------------------------------------- helpers
def test_parse_json_variants():
    assert parse_json('{"a": 1}') == {"a": 1}
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json('Sure! {"a": 1} hope that helps') == {"a": 1}
    with pytest.raises(LLMError):
        parse_json("no json here")


def test_verdict_parse():
    assert Verdict.parse("verified") is Verdict.VERIFIED
    assert Verdict.parse("Outdated") is Verdict.INACCURATE
    assert Verdict.parse("FALSE") is Verdict.FALSE
    assert Verdict.parse("maybe") is Verdict.ERROR


def test_numeric_sentences_skips_non_numeric():
    found = [s for _, s in numeric_sentences(PAGES)]
    assert "Our team loves coffee." not in found
    assert any("98%" in s for s in found)
    assert any("1993" in s for s in found)


def test_uncovered_sentences_detects_missed_figures():
    raw = [{"claim": "Google holds 98% of search", "quote": ""}, {"claim": "Nvidia founded 1993"}]
    missed = uncovered_sentences(numeric_sentences(PAGES), raw)
    assert [p for p, _ in missed] == [2]


def test_build_claims_dedupes_and_caps():
    claims = build_claims([{"claim": "A"}, {"claim": "a "}, {"claim": "B"}, {"claim": ""}, {"claim": "C"}], 2)
    assert [c.text for c in claims] == ["A", "B"]
    assert [c.id for c in claims] == [1, 2]


# ----------------------------------------------------------------------------- extraction
def test_extract_claims_runs_recall_guard():
    llm = FakeLLM()
    claims = extract_claims(llm, PAGES)
    assert [c.text for c in claims] == [
        "Google holds 98% of the global search market.",
        "Nvidia was founded in 1993.",
        "Tesla delivered 5 million vehicles in 2023.",  # recovered by the recall guard
    ]
    assert claims[2].page == 2
    assert len(llm.calls) == 2


# ----------------------------------------------------------------------------- verification
CLAIM = Claim(id=1, text="Google holds 98% of the global search market.", quote="98%")


def test_verify_claim_parses_result_and_merges_citations():
    llm = FakeLLM({"98%": {"verdict": "Inaccurate", "correct_fact": "About 90% (StatCounter, 2025).",
                           "evidence_quote": "Google 89.7%", "confidence": 88,
                           "sources": [{"title": "StatCounter", "url": "https://gs.statcounter.com"}]}})
    result = verify_claim(llm, CLAIM)
    assert result.verdict is Verdict.INACCURATE
    assert result.evidence_quote == "Google 89.7%"
    assert [s.url for s in result.sources] == ["https://gs.statcounter.com", "https://cited.example"]
    assert "Today's date is" in llm.calls[0][0]
    assert not result.wants_second_opinion()


def test_low_confidence_requests_second_opinion():
    llm = FakeLLM({"98%": {"verdict": "Verified", "confidence": 40}})
    assert verify_claim(llm, CLAIM).wants_second_opinion()


def test_second_opinion_prompt_and_reconcile():
    first = ClaimResult(claim_id=1, verdict=Verdict.VERIFIED, confidence=40, explanation="unclear")
    llm = FakeLLM({"98%": {"verdict": "Inaccurate", "confidence": 85, "correct_fact": "~90%"}})
    result = verify_claim(llm, CLAIM, previous=first)
    assert "inconclusive" in llm.calls[0][1]
    assert result.verdict is Verdict.INACCURATE and result.second_opinion
    assert result.confidence == 60  # capped on disagreement


def test_reconcile_rules():
    v = ClaimResult(claim_id=1, verdict=Verdict.VERIFIED, confidence=60)
    i = ClaimResult(claim_id=1, verdict=Verdict.INACCURATE, confidence=60)
    assert reconcile(v, i).verdict is Verdict.INACCURATE  # tie keeps the flag
    agree = reconcile(i, i.model_copy(update={"confidence": 65}))
    assert agree.verdict is Verdict.INACCURATE and agree.confidence == 75


def test_failed_check_becomes_error_not_exception():
    class Boom(FakeLLM):
        def complete(self, *a, **k):
            raise LLMError("OpenAI rate limit hit.")

    result = verify_claim(Boom(), CLAIM)
    assert result.verdict is Verdict.ERROR and "rate limit" in result.explanation


# ----------------------------------------------------------------------------- review
def test_contradictions_filter_unknown_ids():
    claims = [CLAIM, Claim(id=2, text="Google holds 50%.")]
    found = find_contradictions(FakeLLM(), claims)
    assert found[0].claim_ids == [1, 2]


def test_corrections_only_for_flagged_claims():
    claims = [CLAIM, Claim(id=2, text="Nvidia was founded in 1993.")]
    results = [ClaimResult(claim_id=1, verdict=Verdict.INACCURATE, correct_fact="~90%"),
               ClaimResult(claim_id=2, verdict=Verdict.VERIFIED)]
    out = correct_document(FakeLLM(), claims, results)
    assert len(out) == 1 and out[0].original == "98%" and "90%" in out[0].corrected
