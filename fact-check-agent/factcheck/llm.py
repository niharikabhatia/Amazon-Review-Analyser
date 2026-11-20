"""Thin wrapper around the OpenAI Responses API."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from openai import OpenAI

from .models import Source


class LLMError(Exception):
    """Raised when the model call fails or returns unusable output."""


@dataclass
class LLMResponse:
    text: str
    citations: list[Source] = field(default_factory=list)


def parse_json(text: str) -> dict:
    """Parse a JSON object from model output, tolerating code fences and prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise LLMError(f"Model did not return valid JSON: {text[:200]!r}")


def _friendly_error(exc: Exception) -> str:
    msg = str(exc)
    low = msg.lower()
    if "insufficient_quota" in low or "quota" in low:
        return "OpenAI API quota exhausted. Add credits or use a different API key."
    if "invalid_api_key" in low or "401" in low or "incorrect api key" in low:
        return "Invalid OpenAI API key."
    if "rate limit" in low or "429" in low:
        return "OpenAI rate limit hit. Please retry in a minute."
    return f"OpenAI error: {msg[:300]}"


class LLMClient:
    def __init__(self, api_key: str, model: str):
        self.client = OpenAI(api_key=api_key, max_retries=3, timeout=120)
        self.model = model

    def complete(self, instructions: str, prompt: str, web_search: bool = False) -> LLMResponse:
        """Run one model call. With ``web_search`` the model can browse the live web."""
        kwargs: dict = {"model": self.model, "instructions": instructions, "input": prompt}
        if web_search:
            kwargs["tools"] = [{"type": "web_search"}]
        try:
            response = self.client.responses.create(**kwargs)
        except Exception as exc:  # openai raises a family of APIError subclasses
            raise LLMError(_friendly_error(exc)) from exc

        return LLMResponse(text=response.output_text or "", citations=_citations(response))


def _citations(response) -> list[Source]:
    """Collect url_citation annotations from a Responses API result."""
    seen: dict[str, Source] = {}
    for item in getattr(response, "output", None) or []:
        if getattr(item, "type", None) != "message":
            continue
        for part in getattr(item, "content", None) or []:
            for ann in getattr(part, "annotations", None) or []:
                if getattr(ann, "type", None) == "url_citation" and ann.url not in seen:
                    seen[ann.url] = Source(title=getattr(ann, "title", "") or ann.url, url=ann.url)
    return list(seen.values())
