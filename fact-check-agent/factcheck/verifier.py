"""Steps 2 & 3 - Verify a claim against the live web and produce a verdict.

Each call lets the model run OpenAI's built-in ``web_search`` tool. The prompt
carries today's date and forces two searches (the claim itself and the latest
figure), so an old statistic presented as current comes back "Inaccurate".
Low-confidence results can be re-checked with ``previous`` (second opinion).
"""

from __future__ import annotations

from datetime import date

from .llm import LLMClient, LLMError, parse_json
from .models import Claim, ClaimResult, Source, Verdict

VERIFY_INSTRUCTIONS = """\
You are a rigorous fact-checker acting as a "truth layer" for marketing content.
Today's date is {today}. Marketing documents often contain outdated statistics,
inflated numbers, wrong dates and fabricated studies. Trust only evidence you find
now, not your memory.

PROCESS (use the web_search tool):
1. Search for the claim itself (the specific figure/date/entity).
2. Search for the LATEST authoritative figure on the same topic (e.g. "<topic> {year}").
3. Prefer primary and authoritative sources: official reports, company filings and
   investor relations, government/statistics agencies, the original study, then
   reputable news. Prefer the most recent data.

VERDICT (exactly one):
- "Verified": reliable current sources confirm the claim, including its number, date
  and entity (normal rounding is fine, e.g. 49.6% ~ "about 50%").
- "Inaccurate": the topic is real but the claim is wrong: the figure is off or
  exaggerated, the date/entity is wrong, or it is an old statistic presented as
  current while newer data exists.
- "False": no credible evidence supports it, or evidence shows it never happened
  (fabricated study, invented event, non-existent quote).

OUTPUT FIELDS:
- "correct_fact": the real fact with its number and as-of date and source name.
  For Verified, restate the confirmed fact. For False, say what the evidence shows
  (e.g. "No such MIT study exists; ...").
- "explanation": 1-2 sentences on the discrepancy (or why it holds).
- "evidence_quote": one short sentence copied from the best source that proves the
  verdict ("" if none was found).
- "confidence": integer 0-100.
- "sources": up to 4 sources actually used, most authoritative first.

Respond with JSON only:
{{"verdict": "Verified|Inaccurate|False", "correct_fact": "...", "explanation": "...",
"evidence_quote": "...", "confidence": 85, "sources": [{{"title": "...", "url": "..."}}]}}"""

SECOND_OPINION = """\

A first check of this claim was inconclusive (verdict: {verdict}, confidence {confidence}).
Its reasoning: "{explanation}"
Search again with DIFFERENT queries and sources, then give your own independent verdict."""


def _claim_prompt(claim: Claim) -> str:
    parts = [f"CLAIM: {claim.text}"]
    if claim.quote and claim.quote != claim.text:
        parts.append(f'ORIGINAL WORDING: "{claim.quote}"')
    if claim.search_query:
        parts.append(f"SUGGESTED QUERY: {claim.search_query}")
    return "\n".join(parts)


def _sources(data: dict, citations: list[Source]) -> list[Source]:
    sources: list[Source] = []
    for s in data.get("sources") or []:
        if isinstance(s, dict) and str(s.get("url", "")).startswith("http"):
            sources.append(Source(title=str(s.get("title") or s["url"]), url=s["url"]))
        elif isinstance(s, str) and s.startswith("http"):
            sources.append(Source(title=s, url=s))
    known = {s.url for s in sources}
    sources += [c for c in citations if c.url not in known]
    return sources[:5]


def _check(llm: LLMClient, claim: Claim, extra: str = "") -> ClaimResult:
    today = date.today()
    instructions = VERIFY_INSTRUCTIONS.format(today=today.strftime("%d %B %Y"), year=today.year)
    response = llm.complete(instructions, _claim_prompt(claim) + extra, web_search=True)
    data = parse_json(response.text)

    verdict = Verdict.parse(data.get("verdict"))
    if verdict is Verdict.ERROR:
        raise LLMError(f"Unrecognised verdict: {data.get('verdict')!r}")
    try:
        confidence = max(0, min(100, int(data.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0

    return ClaimResult(
        claim_id=claim.id,
        verdict=verdict,
        correct_fact=str(data.get("correct_fact") or "").strip(),
        explanation=str(data.get("explanation") or "").strip(),
        evidence_quote=str(data.get("evidence_quote") or "").strip(),
        confidence=confidence,
        sources=_sources(data, response.citations),
    )


def reconcile(first: ClaimResult, second: ClaimResult) -> ClaimResult:
    """Combine two independent checks of the same claim.

    Agreement raises confidence. On disagreement the higher-confidence result wins;
    on a tie we keep the flag (missing a planted error is worse than a false alarm).
    """
    if first.verdict == second.verdict:
        best = first if first.confidence >= second.confidence else second
        merged = best.model_copy(update={
            "confidence": min(95, max(first.confidence, second.confidence) + 10),
            "sources": _merge_sources(best.sources, first.sources + second.sources),
        })
    elif first.confidence != second.confidence:
        best = first if first.confidence > second.confidence else second
        merged = best.model_copy(update={"confidence": min(best.confidence, 60)})
    else:
        best = first if first.verdict is not Verdict.VERIFIED else second
        merged = best.model_copy(update={"confidence": min(best.confidence, 55)})
    return merged.model_copy(update={"second_opinion": True})


def _merge_sources(primary: list[Source], others: list[Source]) -> list[Source]:
    seen: dict[str, Source] = {s.url: s for s in primary}
    for s in others:
        seen.setdefault(s.url, s)
    return list(seen.values())[:5]


def verify_claim(llm: LLMClient, claim: Claim, previous: ClaimResult | None = None) -> ClaimResult:
    """Verify one claim. Pass ``previous`` to run a second opinion and reconcile."""
    try:
        if previous is None or previous.verdict is Verdict.ERROR:
            return _check(llm, claim)
        extra = SECOND_OPINION.format(
            verdict=previous.verdict.value,
            confidence=previous.confidence,
            explanation=previous.explanation[:300],
        )
        return reconcile(previous, _check(llm, claim, extra))
    except Exception as exc:  # one failing claim must never break the report
        if previous is not None and previous.verdict is not Verdict.ERROR:
            return previous.model_copy(update={"second_opinion": True})
        return ClaimResult(claim_id=claim.id, verdict=Verdict.ERROR, explanation=str(exc)[:300])
