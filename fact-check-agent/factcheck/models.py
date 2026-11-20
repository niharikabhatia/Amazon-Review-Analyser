"""Data models shared across the fact-checking pipeline."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum


class Verdict(str, Enum):
    """The three report labels required by the brief, plus an error state."""

    VERIFIED = "Verified"  # Claim matches current, reliable data.
    INACCURATE = "Inaccurate"  # Topic is real but the figure is wrong or outdated.
    FALSE = "False"  # No supporting evidence exists / claim is fabricated.
    ERROR = "Error"  # The check itself failed (API error, timeout...).

    @classmethod
    def parse(cls, value: str | None) -> "Verdict":
        text = (value or "").strip().lower()
        if text.startswith("verif") or text in {"true", "correct", "accurate"}:
            return cls.VERIFIED
        if text.startswith("inacc") or text in {"outdated", "partially true", "misleading"}:
            return cls.INACCURATE
        if text.startswith("false") or text in {"fabricated", "unsupported", "no evidence"}:
            return cls.FALSE
        return cls.ERROR


@dataclass
class Source:
    title: str
    url: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Claim:
    id: int
    text: str  # Self-contained, checkable statement.
    category: str = "other"  # statistic | date | financial | technical | other
    quote: str = ""  # Original wording from the PDF.
    search_query: str = ""  # Suggested web query for verification.
    page: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ClaimResult:
    claim: Claim
    verdict: Verdict
    correct_fact: str = ""
    explanation: str = ""
    confidence: int = 0
    sources: list[Source] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.claim.id,
            "claim": self.claim.text,
            "quote": self.claim.quote,
            "category": self.claim.category,
            "page": self.claim.page,
            "verdict": self.verdict.value,
            "correct_fact": self.correct_fact,
            "explanation": self.explanation,
            "confidence": self.confidence,
            "sources": [s.to_dict() for s in self.sources],
        }
