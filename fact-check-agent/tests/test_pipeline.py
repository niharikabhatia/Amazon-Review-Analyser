"""Offline tests: the OpenAI client is replaced by a fake so no API key is needed."""

import json
from pathlib import Path

import pytest

from factcheck import pipeline
from factcheck.claims import build_claims
from factcheck.llm import LLMError, LLMResponse, parse_json
from factcheck.models import Source, Verdict
from factcheck.pdf_reader import PDFReadError, chunk_pages, extract_pages

SAMPLE = Path(__file__).resolve().parents[1] / "samples" / "trap_document.pdf"


class FakeLLM:
    """Returns canned JSON: claim extraction first, then one verdict per claim."""

    def __init__(self, *_args, **_kwargs):
        pass

    def complete(self, instructions, prompt, web_search=False):
        if "extract every specific" in instructions:
            return LLMResponse(json.dumps({"claims": [
                {"claim": "Google holds 98% of the global search market.", "quote": "98%",
                 "category": "statistic", "page": 1, "search_query": "google search share"},
                {"claim": "Nvidia was founded in 1993.", "category": "date", "page": 1},
                {"claim": "A 2024 MIT study found 87% of CMOs replaced SEO with GEO.", "page": 1},
                {"claim": "Nvidia was founded in 1993.", "page": 1},  # duplicate
            ]}))
        assert web_search, "verification must use live web search when Tavily is not set"
        if "98%" in prompt:
            body = {"verdict": "Inaccurate", "correct_fact": "About 90% (StatCounter, 2025).",
                    "confidence": 90}
        elif "MIT" in prompt:
            body = {"verdict": "False", "correct_fact": "No credible evidence found."}
        else:
            body = {"verdict": "Verified", "correct_fact": "Founded April 1993."}
        return LLMResponse("```json\n" + json.dumps(body) + "\n```",
                           citations=[Source("Example", "https://example.com")])


def test_extract_pages_from_sample():
    pages = extract_pages(SAMPLE.read_bytes())
    text = " ".join(p.text for p in pages)
    assert "98%" in text and "1899" in text
    assert chunk_pages(pages, max_chars=100)


def test_extract_pages_rejects_garbage():
    with pytest.raises(PDFReadError):
        extract_pages(b"not a pdf")


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


def test_build_claims_dedupes_and_caps():
    raw = [{"claim": "A"}, {"claim": "a "}, {"claim": "B"}, {"claim": ""}, {"claim": "C"}]
    claims = build_claims(raw, max_claims=2)
    assert [c.text for c in claims] == ["A", "B"]
    assert [c.id for c in claims] == [1, 2]


def test_full_pipeline(monkeypatch):
    monkeypatch.setattr(pipeline, "LLMClient", FakeLLM)
    report = pipeline.run_pipeline(
        SAMPLE.read_bytes(), "trap.pdf", pipeline.Settings(openai_api_key="test")
    )
    verdicts = [r.verdict for r in report.results]
    assert verdicts == [Verdict.INACCURATE, Verdict.VERIFIED, Verdict.FALSE]
    assert "90%" in report.results[0].correct_fact
    assert report.results[0].sources[0].url == "https://example.com"
    assert report.to_dict()["summary"]["Inaccurate"] == 1


def test_one_failing_claim_does_not_break_report(monkeypatch):
    class Flaky(FakeLLM):
        def complete(self, instructions, prompt, web_search=False):
            if web_search and "MIT" in prompt:
                raise LLMError("OpenAI rate limit hit.")
            return super().complete(instructions, prompt, web_search)

    monkeypatch.setattr(pipeline, "LLMClient", Flaky)
    report = pipeline.run_pipeline(
        SAMPLE.read_bytes(), "trap.pdf", pipeline.Settings(openai_api_key="test")
    )
    assert [r.verdict for r in report.results].count(Verdict.ERROR) == 1
