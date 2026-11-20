"""Optional Tavily web search backend.

When a TAVILY_API_KEY is configured, evidence is gathered with Tavily and handed
to the model. Otherwise the model uses OpenAI's built-in web_search tool.
"""

from __future__ import annotations

from dataclasses import dataclass

from .models import Source


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    published_date: str = ""

    @property
    def source(self) -> Source:
        return Source(title=self.title or self.url, url=self.url)


class TavilySearch:
    def __init__(self, api_key: str, max_results: int = 6):
        from tavily import TavilyClient  # imported lazily: optional dependency

        self.client = TavilyClient(api_key=api_key)
        self.max_results = max_results

    def search(self, query: str) -> list[SearchResult]:
        response = self.client.search(
            query=query[:400],
            search_depth="advanced",
            max_results=self.max_results,
            include_answer=False,
        )
        return [
            SearchResult(
                title=r.get("title", ""),
                url=r.get("url", ""),
                content=(r.get("content") or "")[:1500],
                published_date=r.get("published_date") or "",
            )
            for r in response.get("results", [])
            if r.get("url")
        ]


def format_evidence(results: list[SearchResult]) -> str:
    if not results:
        return "No search results were found."
    blocks = []
    for i, r in enumerate(results, 1):
        date = f" (published {r.published_date})" if r.published_date else ""
        blocks.append(f"[{i}] {r.title}{date}\nURL: {r.url}\n{r.content}")
    return "\n\n".join(blocks)
