"""Document-level checks: internal contradictions and the corrected version."""

from __future__ import annotations

from .llm import LLMClient, parse_json
from .models import Claim, ClaimResult, Contradiction, Correction, Verdict

CONSISTENCY_INSTRUCTIONS = """\
You check a document for INTERNAL contradictions: places where the document's own
claims disagree with each other (e.g. a launch year given as 2016 in one place and
2019 in another, percentages of a whole that add up to more than 100%, a figure
that changes between sections). Do not judge real-world truth here, only whether
the claims are consistent with each other. Report only clear contradictions.

Respond with JSON only:
{"contradictions": [{"claim_ids": [1, 4], "explanation": "one sentence"}]}
Return {"contradictions": []} if there are none."""

CORRECTION_INSTRUCTIONS = """\
You are a copy editor fixing a marketing document after a fact-check. For each item,
rewrite the ORIGINAL passage so it states the correct fact. Keep the original tone,
length and wording wherever possible and change only what is wrong. For fabricated
claims with no real equivalent, rewrite the passage to remove the false claim
(or replace it with the closest verified fact). Cite nothing inline.

Respond with JSON only:
{"corrections": [{"claim_id": 1, "corrected": "..."}]}"""


def find_contradictions(llm: LLMClient, claims: list[Claim]) -> list[Contradiction]:
    if len(claims) < 2:
        return []
    listing = "\n".join(f"[{c.id}] (page {c.page or '?'}) {c.text}" for c in claims)
    data = parse_json(llm.complete(CONSISTENCY_INSTRUCTIONS, f"CLAIMS:\n{listing}").text)
    valid = {c.id for c in claims}
    out: list[Contradiction] = []
    for item in data.get("contradictions") or []:
        if not isinstance(item, dict):
            continue
        ids = [i for i in item.get("claim_ids") or [] if isinstance(i, int) and i in valid]
        if len(set(ids)) >= 2 and item.get("explanation"):
            out.append(Contradiction(claim_ids=sorted(set(ids)), explanation=str(item["explanation"])))
    return out


def correct_document(
    llm: LLMClient, claims: list[Claim], results: list[ClaimResult]
) -> list[Correction]:
    """Rewrite each flagged passage (Inaccurate/False) with the real facts."""
    by_id = {c.id: c for c in claims}
    flagged = [
        (by_id[r.claim_id], r)
        for r in results
        if r.verdict in (Verdict.INACCURATE, Verdict.FALSE) and r.claim_id in by_id
    ]
    if not flagged:
        return []

    items = "\n\n".join(
        f"[{c.id}] VERDICT: {r.verdict.value}\nORIGINAL: {c.quote or c.text}\nREAL FACT: {r.correct_fact}"
        for c, r in flagged
    )
    data = parse_json(llm.complete(CORRECTION_INSTRUCTIONS, items).text)
    rewritten = {
        item.get("claim_id"): str(item.get("corrected") or "").strip()
        for item in data.get("corrections") or []
        if isinstance(item, dict)
    }
    return [
        Correction(claim_id=c.id, original=c.quote or c.text, corrected=rewritten[c.id])
        for c, _ in flagged
        if rewritten.get(c.id)
    ]
