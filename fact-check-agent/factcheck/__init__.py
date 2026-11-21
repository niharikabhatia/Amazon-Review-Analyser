"""Fact-Check Agent: extract claims from a document and verify them against the live web."""

from .claims import extract_claims
from .llm import LLMClient, LLMError
from .models import Claim, ClaimResult, Contradiction, Correction, Page, Source, Verdict
from .review import correct_document, find_contradictions
from .verifier import verify_claim

__all__ = [
    "Claim", "ClaimResult", "Contradiction", "Correction", "LLMClient", "LLMError", "Page",
    "Source", "Verdict", "correct_document", "extract_claims", "find_contradictions", "verify_claim",
]
