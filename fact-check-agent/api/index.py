"""HTTP API (FastAPI). Deployed as a single Vercel Python function.

The browser drives the workflow so every request stays short:
  POST /api/extract      pages of text      -> claims
  POST /api/verify       one claim          -> verdict (+ optional second opinion)
  POST /api/consistency  claims             -> internal contradictions
  POST /api/correct      claims + results   -> corrected passages
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from factcheck import (  # noqa: E402
    Claim, ClaimResult, Contradiction, Correction, LLMClient, LLMError, Page,
    correct_document, extract_claims, find_contradictions, verify_claim,
)

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
ALLOWED_MODELS = {DEFAULT_MODEL, "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"}
MAX_PAGES = 25
MAX_CHARS = 120_000
MAX_CLAIMS = 40

app = FastAPI(title="Fact-Check Agent API", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.exception_handler(LLMError)
async def _llm_error(_request, exc: LLMError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


def get_llm(api_key: str | None, model: str | None) -> LLMClient:
    """Build an LLM client from the caller's key (if given) or the server key."""
    key = (api_key or "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(401, "No OpenAI API key configured. Add your own key in Settings.")
    chosen = (model or "").strip() or DEFAULT_MODEL
    if chosen not in ALLOWED_MODELS:
        raise HTTPException(400, f"Unsupported model: {chosen}")
    return LLMClient(key, chosen)


# ----------------------------------------------------------------------------- schemas
class ExtractRequest(BaseModel):
    pages: list[Page] = Field(min_length=1)
    max_claims: int = Field(default=25, ge=1, le=MAX_CLAIMS)


class ExtractResponse(BaseModel):
    claims: list[Claim]


class VerifyRequest(BaseModel):
    claim: Claim
    previous: ClaimResult | None = None  # set to request a second opinion


class VerifyResponse(ClaimResult):
    needs_second_opinion: bool = False


class ConsistencyRequest(BaseModel):
    claims: list[Claim]


class ConsistencyResponse(BaseModel):
    contradictions: list[Contradiction]


class CorrectRequest(BaseModel):
    claims: list[Claim]
    results: list[ClaimResult]


class CorrectResponse(BaseModel):
    corrections: list[Correction]


# ----------------------------------------------------------------------------- routes
@app.get("/api/health")
def health():
    return {
        "ok": True,
        "default_model": DEFAULT_MODEL,
        "models": sorted(ALLOWED_MODELS),
        "server_key": bool(os.getenv("OPENAI_API_KEY")),
    }


@app.post("/api/extract", response_model=ExtractResponse)
def extract(
    body: ExtractRequest,
    x_openai_key: str | None = Header(default=None),
    x_openai_model: str | None = Header(default=None),
):
    pages = [p for p in body.pages if p.text.strip()][:MAX_PAGES]
    if not pages:
        raise HTTPException(422, "No selectable text found. Scanned/image-only PDFs are not supported.")
    if sum(len(p.text) for p in pages) > MAX_CHARS:
        raise HTTPException(413, f"Document too long: please upload at most ~{MAX_CHARS // 1000}k characters.")
    llm = get_llm(x_openai_key, x_openai_model)
    return ExtractResponse(claims=extract_claims(llm, pages, body.max_claims))


@app.post("/api/verify", response_model=VerifyResponse)
def verify(
    body: VerifyRequest,
    x_openai_key: str | None = Header(default=None),
    x_openai_model: str | None = Header(default=None),
):
    llm = get_llm(x_openai_key, x_openai_model)
    result = verify_claim(llm, body.claim, body.previous)
    return VerifyResponse(**result.model_dump(), needs_second_opinion=result.wants_second_opinion())


@app.post("/api/consistency", response_model=ConsistencyResponse)
def consistency(
    body: ConsistencyRequest,
    x_openai_key: str | None = Header(default=None),
    x_openai_model: str | None = Header(default=None),
):
    llm = get_llm(x_openai_key, x_openai_model)
    return ConsistencyResponse(contradictions=find_contradictions(llm, body.claims[:MAX_CLAIMS]))


@app.post("/api/correct", response_model=CorrectResponse)
def correct(
    body: CorrectRequest,
    x_openai_key: str | None = Header(default=None),
    x_openai_model: str | None = Header(default=None),
):
    llm = get_llm(x_openai_key, x_openai_model)
    return CorrectResponse(corrections=correct_document(llm, body.claims, body.results))
