"""PDF text extraction."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader


class PDFReadError(Exception):
    """Raised when a PDF cannot be read or contains no extractable text."""


@dataclass
class PageText:
    number: int  # 1-based page number
    text: str


def _clean(text: str) -> str:
    text = text.replace(" ", " ")
    text = re.sub(r"-\n(\w)", r"\1", text)  # re-join hyphenated line breaks
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pages(data: bytes, max_pages: int = 30) -> list[PageText]:
    """Return the cleaned text of each page that contains text."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            reader.decrypt("")
        pages = [
            PageText(i + 1, _clean(page.extract_text() or ""))
            for i, page in enumerate(reader.pages[:max_pages])
        ]
    except Exception as exc:  # pypdf raises many exception types
        raise PDFReadError(f"Could not read the PDF: {exc}") from exc

    pages = [p for p in pages if p.text]
    if not pages:
        raise PDFReadError(
            "No selectable text found in this PDF. Scanned/image-only PDFs are not supported."
        )
    return pages


def chunk_pages(pages: list[PageText], max_chars: int = 12_000) -> list[list[PageText]]:
    """Group pages into chunks small enough for one extraction call."""
    chunks: list[list[PageText]] = []
    current: list[PageText] = []
    size = 0
    for page in pages:
        if current and size + len(page.text) > max_chars:
            chunks.append(current)
            current, size = [], 0
        current.append(page)
        size += len(page.text)
    if current:
        chunks.append(current)
    return chunks
