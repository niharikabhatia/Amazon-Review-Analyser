"""API tests with FastAPI's TestClient and a fake LLM."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import api.index as api_module
from tests.test_pipeline import FakeLLM

client = TestClient(api_module.app)
PAGES = [{"page": 1, "text": "Google holds 98% of the global search market. Nvidia was founded in 1993."}]


@pytest.fixture(autouse=True)
def fake_llm(monkeypatch):
    llm = FakeLLM({"98%": {"verdict": "Inaccurate", "correct_fact": "About 90%", "confidence": 88}})
    monkeypatch.setattr(api_module, "LLMClient", lambda key, model: llm)
    monkeypatch.setenv("OPENAI_API_KEY", "server-key")
    return llm


def test_health():
    body = client.get("/api/health").json()
    assert body["ok"] and body["server_key"]


def test_extract_and_verify_flow():
    claims = client.post("/api/extract", json={"pages": PAGES}).json()["claims"]
    assert claims[0]["text"].startswith("Google")
    result = client.post("/api/verify", json={"claim": claims[0]}).json()
    assert result["verdict"] == "Inaccurate" and result["needs_second_opinion"] is False


def test_missing_key_returns_401(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY")
    r = client.post("/api/extract", json={"pages": PAGES})
    assert r.status_code == 401 and "API key" in r.json()["detail"]
    # ...but a user-supplied key works
    assert client.post("/api/extract", json={"pages": PAGES}, headers={"X-OpenAI-Key": "mine"}).status_code == 200


def test_rejects_unknown_model():
    r = client.post("/api/extract", json={"pages": PAGES}, headers={"X-OpenAI-Model": "gpt-9"})
    assert r.status_code == 400


def test_empty_and_oversized_documents():
    assert client.post("/api/extract", json={"pages": [{"page": 1, "text": "  "}]}).status_code == 422
    huge = [{"page": 1, "text": "x" * 130_000}]
    assert client.post("/api/extract", json={"pages": huge}).status_code == 413


def test_llm_failure_during_extract_is_502(monkeypatch, fake_llm):
    from factcheck.llm import LLMError

    def boom(*a, **k):
        raise LLMError("OpenAI API quota exhausted.")

    monkeypatch.setattr(fake_llm, "complete", boom)
    r = client.post("/api/extract", json={"pages": PAGES})
    assert r.status_code == 502 and "quota" in r.json()["detail"]


def test_consistency_and_correct():
    claims = [{"id": 1, "text": "A 98%", "quote": "98%"}, {"id": 2, "text": "B 50%"}]
    assert client.post("/api/consistency", json={"claims": claims}).json()["contradictions"][0]["claim_ids"] == [1, 2]
    results = [{"claim_id": 1, "verdict": "Inaccurate", "correct_fact": "90%"}]
    out = client.post("/api/correct", json={"claims": claims, "results": results}).json()
    assert out["corrections"][0]["claim_id"] == 1
