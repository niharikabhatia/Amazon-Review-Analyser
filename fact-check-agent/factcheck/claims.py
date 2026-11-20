"""Step 1 - Extract: pull specific, checkable claims out of document text."""

from __future__ import annotations

from .llm import LLMClient, parse_json
from .models import Claim
from .pdf_reader import PageText

EXTRACTION_INSTRUCTIONS = """\
You are a meticulous fact-checking editor. Your job is to extract every specific,
objectively checkable factual claim from a document so it can be verified against the web.

EXTRACT claims that contain at least one of:
- statistics or percentages (market share, growth rates, user counts, survey results)
- dates and timelines (launch years, founding dates, "as of" figures)
- financial figures (revenue, valuation, funding, prices, market size)
- technical figures (speeds, capacities, specifications, benchmark results)
- concrete facts about named entities (who did what, rankings, records, "first/largest")

DO NOT extract opinions, predictions, marketing fluff, advice, or vague statements
("AI is transforming business"). Do not invent claims that are not in the text.

For each claim:
- "claim": rewrite it as ONE self-contained sentence. Resolve pronouns and include the
  subject, the figure and the time frame stated in the document, so it can be checked
  without the surrounding text. Keep the document's numbers exactly as written.
- "quote": the shortest verbatim excerpt from the document that contains the claim.
- "category": one of statistic, date, financial, technical, other.
- "page": the page number the claim appears on (from the [Page N] markers).
- "search_query": a concise web search query that would find the authoritative figure.

Merge duplicates. Return at most {max_claims} claims, prioritising the most specific
and most consequential ones.

Respond with JSON only: {{"claims": [{{"claim": "...", "quote": "...", "category": "...",
"page": 1, "search_query": "..."}}]}}"""


def _format_chunk(pages: list[PageText]) -> str:
    return "\n\n".join(f"[Page {p.number}]\n{p.text}" for p in pages)


def extract_claims(llm: LLMClient, chunk: list[PageText], max_claims: int) -> list[dict]:
    """Return raw claim dicts for one chunk of pages."""
    instructions = EXTRACTION_INSTRUCTIONS.format(max_claims=max_claims)
    response = llm.complete(instructions, f"DOCUMENT:\n\n{_format_chunk(chunk)}")
    data = parse_json(response.text)
    claims = data.get("claims", []) if isinstance(data, dict) else []
    return [c for c in claims if isinstance(c, dict) and str(c.get("claim", "")).strip()]


def build_claims(raw: list[dict], max_claims: int) -> list[Claim]:
    """De-duplicate raw claim dicts and convert them into numbered Claim objects."""
    seen: set[str] = set()
    claims: list[Claim] = []
    for item in raw:
        text = str(item.get("claim", "")).strip()
        key = " ".join(text.lower().split())
        if not text or key in seen:
            continue
        seen.add(key)
        page = item.get("page")
        claims.append(
            Claim(
                id=len(claims) + 1,
                text=text,
                category=str(item.get("category") or "other").lower(),
                quote=str(item.get("quote") or "").strip(),
                search_query=str(item.get("search_query") or text).strip(),
                page=page if isinstance(page, int) else None,
            )
        )
        if len(claims) >= max_claims:
            break
    return claims
