"""Fact-Check Agent: extract claims from a PDF and verify them against the live web."""

from .models import Claim, ClaimResult, Source, Verdict
from .pipeline import Report, Settings, run_pipeline

__all__ = ["Claim", "ClaimResult", "Report", "Settings", "Source", "Verdict", "run_pipeline"]
