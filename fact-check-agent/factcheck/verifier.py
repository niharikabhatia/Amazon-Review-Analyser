"""Steps 2 & 3 - Verify a claim against live web data and produce a verdict."""

from __future__ import annotations

from datetime import date

from .llm import LLMClient, LLMError, parse_json
from .models import Claim, ClaimResult, Source, Verdict
from .search import TavilySearch, format_evidence

VERIFY_INSTRUCTIONS = """\
You are a rigorous fact-checker acting as a "truth layer" for marketing content.
Today's date is {today}. Marketing documents often contain outdated statistics,
inflated numbers and fabricated facts. Assume nothing; trust only evidence.

{evidence_rule}

Classify the claim with exactly one verdict:
- "Verified": reliable sources confirm the claim, including its number, date and
  entity (allow normal rounding, e.g. 49.6% ~ "about 50%").
- "Inaccurate": the topic is real but the claim is wrong or outdated: the figure is
  off, it is an old statistic presented as current, the wrong year/entity is used,
  or it is exaggerated. Give the correct, most recent figure.
- "False": no credible evidence supports the claim, or evidence clearly shows the
  event/fact never happened (fabricated statistic, non-existent study, invented event).

Rules:
- Prefer primary and authoritative sources (official reports, company filings,
  government/statistics agencies, reputable news). Prefer the most recent data.
- If the document's figure was true in the past but newer data exists, the verdict is
  "Inaccurate" and correct_fact must state the newer figure and its date.
- "correct_fact" must state the real fact with its number and as-of date/source year
  (for Verified, restate the confirmed fact; for False, state what the evidence actually
  shows, or "No credible evidence found for this claim.").
- Keep "explanation" to 1-3 sentences explaining the discrepancy.
- "confidence" is an integer 0-100.

Respond with JSON only:
{{"verdict": "Verified|Inaccurate|False", "correct_fact": "...", "explanation": "...",
"confidence": 85, "sources": [{{"title": "...", "url": "..."}}]}}"""

WEB_TOOL_RULE = (
    "Use the web_search tool to find current, authoritative evidence before deciding. "
    "Run more than one search if the first results are inconclusive."
)
EVIDENCE_RULE = (
    "Base your verdict ONLY on the numbered search results provided below, plus "
    "well-established general knowledge. Cite the URLs you relied on."
)


def _claim_prompt(claim: Claim) -> str:
    parts = [f"CLAIM: {claim.text}"]
    if claim.quote and claim.quote != claim.text:
        parts.append(f'ORIGINAL WORDING: "{claim.quote}"')
    return "\n".join(parts)


def _sources_from(data: dict, fallback: list[Source]) -> list[Source]:
    sources: list[Source] = []
    for s in data.get("sources") or []:
        if isinstance(s, dict) and str(s.get("url", "")).startswith("http"):
            sources.append(Source(title=str(s.get("title") or s["url"]), url=s["url"]))
        elif isinstance(s, str) and s.startswith("http"):
            sources.append(Source(title=s, url=s))
    known = {s.url for s in sources}
    sources += [s for s in fallback if s.url not in known]
    return sources[:6]


def verify_claim(
    llm: LLMClient, claim: Claim, searcher: TavilySearch | None = None
) -> ClaimResult:
    today = date.today().strftime("%d %B %Y")
    try:
        if searcher is not None:
            results = searcher.search(claim.search_query or claim.text)
            instructions = VERIFY_INSTRUCTIONS.format(today=today, evidence_rule=EVIDENCE_RULE)
            prompt = f"{_claim_prompt(claim)}\n\nSEARCH RESULTS:\n{format_evidence(results)}"
            response = llm.complete(instructions, prompt)
            fallback = [r.source for r in results]
        else:
            instructions = VERIFY_INSTRUCTIONS.format(today=today, evidence_rule=WEB_TOOL_RULE)
            response = llm.complete(instructions, _claim_prompt(claim), web_search=True)
            fallback = response.citations

        data = parse_json(response.text)
        verdict = Verdict.parse(data.get("verdict"))
        if verdict is Verdict.ERROR:
            raise LLMError(f"Unrecognised verdict: {data.get('verdict')!r}")

        try:
            confidence = max(0, min(100, int(data.get("confidence", 0))))
        except (TypeError, ValueError):
            confidence = 0

        return ClaimResult(
            claim=claim,
            verdict=verdict,
            correct_fact=str(data.get("correct_fact") or "").strip(),
            explanation=str(data.get("explanation") or "").strip(),
            confidence=confidence,
            sources=_sources_from(data, fallback),
        )
    except Exception as exc:  # never let one claim break the whole report
        return ClaimResult(claim=claim, verdict=Verdict.ERROR, explanation=str(exc)[:300])
