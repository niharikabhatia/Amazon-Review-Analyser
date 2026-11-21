"""Data models shared by the fact-checking modules and the API."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    """The three report labels required by the brief, plus an error state."""

    VERIFIED = "Verified"  # Matches current, reliable data.
    INACCURATE = "Inaccurate"  # Real topic, but the figure is wrong, exaggerated or outdated.
    FALSE = "False"  # No credible evidence exists / fabricated.
    ERROR = "Error"  # The check itself failed (API error, timeout...).

    @classmethod
    def parse(cls, value: str | None) -> "Verdict":
        text = (value or "").strip().lower()
        if text.startswith("verif") or text in {"true", "correct", "accurate"}:
            return cls.VERIFIED
        if text.startswith("inacc") or text in {"outdated", "partially true", "misleading", "exaggerated"}:
            return cls.INACCURATE
        if text.startswith("false") or text in {"fabricated", "unsupported", "no evidence"}:
            return cls.FALSE
        return cls.ERROR


class Page(BaseModel):
    page: int = Field(ge=1)  # 1-based page number
    text: str


class Source(BaseModel):
    title: str
    url: str


class Claim(BaseModel):
    id: int
    text: str  # Self-contained, checkable statement.
    quote: str = ""  # Verbatim wording from the document (used for highlighting).
    category: str = "other"  # statistic | date | financial | technical | other
    page: int | None = None
    search_query: str = ""


class ClaimResult(BaseModel):
    claim_id: int
    verdict: Verdict
    correct_fact: str = ""  # The real fact, with figure and as-of date.
    explanation: str = ""
    evidence_quote: str = ""  # Sentence from a source that proves the verdict.
    confidence: int = 0  # 0-100
    sources: list[Source] = Field(default_factory=list)
    second_opinion: bool = False  # True once a low-confidence result was re-checked.

    def wants_second_opinion(self) -> bool:
        return self.verdict is not Verdict.ERROR and not self.second_opinion and self.confidence < 70


class Contradiction(BaseModel):
    claim_ids: list[int]
    explanation: str


class Correction(BaseModel):
    claim_id: int
    original: str  # Verbatim sentence/passage from the document.
    corrected: str  # Same passage rewritten with the real facts.
