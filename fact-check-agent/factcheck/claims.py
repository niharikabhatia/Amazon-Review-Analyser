"""Step 1 - Extract: pull every specific, checkable claim out of the document.

Two passes make sure a planted lie is not skipped:
1. The LLM extracts claims from the full text (chunked by pages).
2. A recall guard scans for every sentence containing a number, percentage,
   currency amount or year. Any such sentence that no extracted claim covers is
   sent back to the LLM for a focused second extraction.
"""

from __future__ import annotations

import re

from .llm import LLMClient, parse_json
from .models import Claim, Page

EXTRACTION_INSTRUCTIONS = """\
You are a meticulous fact-checking editor. Extract every specific, objectively
checkable factual claim from the text so it can be verified against the live web.

EXTRACT claims containing at least one of:
- statistics or percentages (market share, growth rates, user counts, survey results)
- dates and timelines (launch/founding years, "as of" figures, event dates)
- financial figures (revenue, valuation, funding, prices, market size, GDP)
- technical figures (speeds, capacities, specifications, measurements, records)
- concrete facts about named entities (who did what, rankings, "first/largest", studies)

DO NOT extract opinions, predictions, advice, marketing fluff or vague statements.
Never invent claims that are not in the text. If one sentence contains several
independent facts, split them into separate claims.

For each claim return:
- "claim": ONE self-contained sentence. Resolve pronouns, keep the subject, the figure
  and the time frame exactly as the document states them (do not correct anything).
- "quote": the shortest EXACT verbatim excerpt from the text containing the claim
  (copy characters exactly; it is used to highlight the claim in the PDF).
- "category": statistic | date | financial | technical | other
- "page": the page number from the [Page N] marker.
- "search_query": a concise web search query to find the authoritative figure.

Return at most {max_claims} claims, most specific and consequential first.
Respond with JSON only:
{{"claims": [{{"claim": "...", "quote": "...", "category": "...", "page": 1, "search_query": "..."}}]}}"""

RECALL_PROMPT = """\
The following sentences from the same document contain figures or dates that were
not yet captured. Extract every checkable factual claim from them (same rules).
If a sentence has no checkable fact (e.g. a page number or pure opinion), skip it.

{sentences}"""

# A number, percentage, currency amount, multiplier or 4-digit year.
_NUMERIC = re.compile(
    r"(\d[\d,.]*\s*(%|percent|per cent|million|billion|trillion|crore|lakh|[kmbt]\b|x\b)?"
    r"|[$€£₹¥]\s*\d|\b(1[89]|20)\d{2}\b)",
    re.IGNORECASE,
)
_NUMBER_TOKEN = re.compile(r"\d[\d,]*(?:\.\d+)?")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


def _format_pages(pages: list[Page]) -> str:
    return "\n\n".join(f"[Page {p.page}]\n{p.text}" for p in pages)


def chunk_pages(pages: list[Page], max_chars: int = 12_000) -> list[list[Page]]:
    """Group pages into chunks small enough for one extraction call."""
    chunks: list[list[Page]] = []
    current: list[Page] = []
    size = 0
    for page in pages:
        if current and size + len(page.text) > max_chars:
            chunks.append(current)
            current, size = [], 0
        current.append(page)
        size += len(page.text)
    if current:
        chunks.append(current)
    return chunks


def numeric_sentences(pages: list[Page]) -> list[tuple[int, str]]:
    """Every sentence that contains a figure, percentage, amount or year."""
    found: list[tuple[int, str]] = []
    for page in pages:
        text = re.sub(r"\s+", " ", page.text)
        for sentence in _SENTENCE_SPLIT.split(text):
            sentence = sentence.strip()
            # Skip fragments that are just a number (page numbers, list markers).
            if len(sentence) >= 25 and _NUMERIC.search(sentence):
                found.append((page.page, sentence))
    return found


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "").rstrip(".") for n in _NUMBER_TOKEN.findall(text)}


def uncovered_sentences(sentences: list[tuple[int, str]], raw: list[dict]) -> list[tuple[int, str]]:
    """Numeric sentences whose figures do not appear in any extracted claim."""
    covered: set[str] = set()
    for item in raw:
        covered |= _numbers(f"{item.get('claim', '')} {item.get('quote', '')}")
    return [(page, s) for page, s in sentences if not _numbers(s) <= covered]


def _parse_claims(text: str) -> list[dict]:
    data = parse_json(text)
    claims = data.get("claims", []) if isinstance(data, dict) else []
    return [c for c in claims if isinstance(c, dict) and str(c.get("claim", "")).strip()]


def build_claims(raw: list[dict], max_claims: int) -> list[Claim]:
    """De-duplicate raw claim dicts and number them."""
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
                quote=str(item.get("quote") or "").strip(),
                category=str(item.get("category") or "other").lower(),
                page=page if isinstance(page, int) and page > 0 else None,
                search_query=str(item.get("search_query") or text).strip(),
            )
        )
        if len(claims) >= max_claims:
            break
    return claims


def extract_claims(llm: LLMClient, pages: list[Page], max_claims: int = 25) -> list[Claim]:
    instructions = EXTRACTION_INSTRUCTIONS.format(max_claims=max_claims)

    raw: list[dict] = []
    for chunk in chunk_pages(pages):
        response = llm.complete(instructions, f"TEXT:\n\n{_format_pages(chunk)}")
        raw += _parse_claims(response.text)

    # Recall guard: re-extract from numeric sentences the first pass missed.
    missed = uncovered_sentences(numeric_sentences(pages), raw)
    if missed:
        listing = "\n".join(f"[Page {page}] {s}" for page, s in missed[:40])
        response = llm.complete(instructions, RECALL_PROMPT.format(sentences=listing))
        raw += _parse_claims(response.text)

    return build_claims(raw, max_claims)
