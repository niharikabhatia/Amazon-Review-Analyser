"""Orchestrates Extract -> Verify -> Report."""

from __future__ import annotations

from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from .claims import build_claims, extract_claims
from .llm import LLMClient
from .models import Claim, ClaimResult, Verdict
from .pdf_reader import chunk_pages, extract_pages
from .search import TavilySearch
from .verifier import verify_claim

ProgressFn = Callable[[str, float], None]


@dataclass
class Settings:
    openai_api_key: str
    model: str = "gpt-4.1-mini"
    tavily_api_key: str = ""
    max_claims: int = 20
    max_workers: int = 5


@dataclass
class Report:
    filename: str
    pages: int
    results: list[ClaimResult] = field(default_factory=list)
    search_backend: str = ""
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    )

    @property
    def counts(self) -> Counter:
        return Counter(r.verdict for r in self.results)

    def to_dict(self) -> dict:
        return {
            "filename": self.filename,
            "pages": self.pages,
            "generated_at": self.generated_at,
            "search_backend": self.search_backend,
            "summary": {v.value: self.counts.get(v, 0) for v in Verdict},
            "claims": [r.to_dict() for r in self.results],
        }


def _noop(_msg: str, _pct: float) -> None:
    pass


def run_pipeline(
    pdf_bytes: bytes, filename: str, settings: Settings, progress: ProgressFn = _noop
) -> Report:
    llm = LLMClient(settings.openai_api_key, settings.model)
    searcher = TavilySearch(settings.tavily_api_key) if settings.tavily_api_key else None

    # 1. Extract text
    progress("Reading PDF...", 0.02)
    pages = extract_pages(pdf_bytes)
    report = Report(
        filename=filename,
        pages=len(pages),
        search_backend="Tavily + OpenAI" if searcher else "OpenAI web search",
    )

    # 2. Extract claims (one call per chunk of pages)
    chunks = chunk_pages(pages)
    raw: list[dict] = []
    for i, chunk in enumerate(chunks, 1):
        progress(f"Extracting claims (part {i}/{len(chunks)})...", 0.05 + 0.15 * i / len(chunks))
        raw += extract_claims(llm, chunk, settings.max_claims)
    claims = build_claims(raw, settings.max_claims)
    if not claims:
        progress("No checkable claims found.", 1.0)
        return report

    # 3. Verify each claim against the live web, in parallel
    results: dict[int, ClaimResult] = {}
    with ThreadPoolExecutor(max_workers=settings.max_workers) as pool:
        futures = {pool.submit(verify_claim, llm, c, searcher): c for c in claims}
        for done, future in enumerate(as_completed(futures), 1):
            claim: Claim = futures[future]
            results[claim.id] = future.result()
            progress(
                f"Verified {done}/{len(claims)} claims...", 0.2 + 0.8 * done / len(claims)
            )

    report.results = [results[c.id] for c in claims]
    progress("Done", 1.0)
    return report
