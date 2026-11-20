"""Streamlit front end for the Fact-Check Agent."""

from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import os
from pathlib import Path

import streamlit as st

from factcheck import Report, Settings, Verdict, run_pipeline
from factcheck.llm import LLMError
from factcheck.pdf_reader import PDFReadError

APP_DIR = Path(__file__).parent
SAMPLE_PDF = APP_DIR / "samples" / "trap_document.pdf"
MAX_UPLOAD_MB = 10

VERDICT_STYLE = {
    Verdict.VERIFIED: ("#0f7b4a", "#e6f4ec", "✅"),
    Verdict.INACCURATE: ("#a35a00", "#fff3e0", "⚠️"),
    Verdict.FALSE: ("#b3261e", "#fdecea", "❌"),
    Verdict.ERROR: ("#5f6368", "#f1f3f4", "⏺"),
}

st.set_page_config(page_title="Fact-Check Agent", page_icon="🔎", layout="wide")


def secret(name: str, default: str = "") -> str:
    """Read a setting from Streamlit secrets, falling back to environment variables."""
    try:
        value = st.secrets.get(name)
    except Exception:  # no secrets.toml present
        value = None
    return str(value or os.getenv(name, default)).strip()


# --------------------------------------------------------------------------- sidebar
with st.sidebar:
    st.header("Settings")
    server_key = secret("OPENAI_API_KEY")
    user_key = st.text_input(
        "OpenAI API key" + (" (optional override)" if server_key else ""),
        type="password",
        help="Used only for this session, never stored. Leave blank to use the app's key.",
    )
    model = st.selectbox(
        "Model",
        options=list(dict.fromkeys(
            [secret("OPENAI_MODEL", "gpt-4.1-mini"), "gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"]
        )),
        help="Larger models catch subtler errors but cost more.",
    )
    max_claims = st.slider("Max claims to check", 5, 40, int(secret("MAX_CLAIMS", "20") or 20))
    tavily_key = secret("TAVILY_API_KEY")
    st.caption(
        "Search backend: **"
        + ("Tavily + OpenAI" if tavily_key else "OpenAI web search")
        + "**"
    )
    if SAMPLE_PDF.exists():
        st.divider()
        st.download_button(
            "Download a sample trap PDF",
            SAMPLE_PDF.read_bytes(),
            file_name=SAMPLE_PDF.name,
            mime="application/pdf",
            use_container_width=True,
        )

api_key = user_key.strip() or server_key

# --------------------------------------------------------------------------- header
st.title("🔎 Fact-Check Agent")
st.markdown(
    "A **truth layer** for marketing content. Upload a PDF and the agent will "
    "**extract** every stat, date and financial or technical figure, **verify** each one "
    "against the live web, and **report** it as "
    "✅ **Verified**, ⚠️ **Inaccurate** (wrong or outdated) or ❌ **False** (no evidence), "
    "with the correct figure and sources."
)

uploaded = st.file_uploader("Upload a PDF", type=["pdf"])
run = st.button("Run fact-check", type="primary", disabled=uploaded is None)


# --------------------------------------------------------------------------- run
def run_check(data: bytes, name: str) -> Report | None:
    if not api_key:
        st.error("No OpenAI API key configured. Add one in the sidebar.")
        return None
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        st.error(f"File is larger than {MAX_UPLOAD_MB} MB.")
        return None

    settings = Settings(
        openai_api_key=api_key, model=model, tavily_api_key=tavily_key, max_claims=max_claims
    )
    bar = st.progress(0.0, text="Starting...")
    try:
        report = run_pipeline(data, name, settings, lambda msg, pct: bar.progress(pct, text=msg))
    except PDFReadError as exc:
        st.error(str(exc))
        return None
    except LLMError as exc:
        st.error(str(exc))
        return None
    finally:
        bar.empty()
    return report


if run and uploaded is not None:
    data = uploaded.getvalue()
    report = run_check(data, uploaded.name)
    if report is not None:
        st.session_state["report"] = report
        st.session_state["report_hash"] = hashlib.sha256(data).hexdigest()

report: Report | None = st.session_state.get("report")
if report is None:
    st.info("Upload a PDF and click **Run fact-check** to get started.")
    st.stop()


# --------------------------------------------------------------------------- report
def to_csv(rep: Report) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["#", "Verdict", "Claim", "Correct fact", "Explanation", "Confidence", "Sources"])
    for r in rep.results:
        writer.writerow([
            r.claim.id, r.verdict.value, r.claim.text, r.correct_fact, r.explanation,
            r.confidence, " | ".join(s.url for s in r.sources),
        ])
    return buf.getvalue()


st.divider()
st.subheader(f"Report: {report.filename}")
st.caption(
    f"{report.pages} page(s) · {len(report.results)} claims checked · "
    f"{report.search_backend} · {report.generated_at}"
)

if not report.results:
    st.warning("No specific, checkable claims (stats, dates, figures) were found in this document.")
    st.stop()

counts = report.counts
cols = st.columns(4)
cols[0].metric("Claims checked", len(report.results))
cols[1].metric("✅ Verified", counts.get(Verdict.VERIFIED, 0))
cols[2].metric("⚠️ Inaccurate", counts.get(Verdict.INACCURATE, 0))
cols[3].metric("❌ False", counts.get(Verdict.FALSE, 0))
if counts.get(Verdict.ERROR):
    st.warning(f"{counts[Verdict.ERROR]} claim(s) could not be checked. See details below.")

flagged = counts.get(Verdict.INACCURATE, 0) + counts.get(Verdict.FALSE, 0)
if flagged:
    st.error(f"**{flagged} claim(s) flagged.** Review the corrections below before publishing.")
else:
    st.success("No inaccurate or false claims detected.")

left, right = st.columns([3, 1])
with left:
    shown = st.multiselect(
        "Show",
        options=[v.value for v in Verdict if counts.get(v)],
        default=[v.value for v in Verdict if counts.get(v)],
        label_visibility="collapsed",
    )
with right:
    d1, d2 = st.columns(2)
    d1.download_button("CSV", to_csv(report), "fact_check_report.csv", "text/csv", use_container_width=True)
    d2.download_button(
        "JSON",
        json.dumps(report.to_dict(), indent=2),
        "fact_check_report.json",
        "application/json",
        use_container_width=True,
    )

# Flagged claims first, then verified, then errors.
order = {Verdict.FALSE: 0, Verdict.INACCURATE: 1, Verdict.VERIFIED: 2, Verdict.ERROR: 3}
for r in sorted(report.results, key=lambda r: (order[r.verdict], r.claim.id)):
    if r.verdict.value not in shown:
        continue
    fg, bg, icon = VERDICT_STYLE[r.verdict]
    esc = html.escape
    with st.container(border=True):
        page = f" · page {r.claim.page}" if r.claim.page else ""
        st.markdown(
            f'<span style="background:{bg};color:{fg};padding:3px 10px;border-radius:12px;'
            f'font-weight:600;font-size:0.85rem">{icon} {r.verdict.value}</span>'
            f'&nbsp;&nbsp;<span style="color:#5f6368;font-size:0.85rem">'
            f"#{r.claim.id} · {esc(r.claim.category)}{page}"
            + (f" · confidence {r.confidence}%" if r.confidence else "")
            + "</span>",
            unsafe_allow_html=True,
        )
        st.markdown(f"**Claim:** {esc(r.claim.text)}")
        if r.claim.quote:
            st.markdown(f'<span style="color:#5f6368">Document says: “{esc(r.claim.quote)}”</span>',
                        unsafe_allow_html=True)
        if r.correct_fact and r.verdict in (Verdict.INACCURATE, Verdict.FALSE):
            st.markdown(
                f'<div style="background:{bg};border-radius:8px;padding:8px 12px;margin:6px 0">'
                f'<b style="color:{fg}">Real fact:</b> {esc(r.correct_fact)}</div>',
                unsafe_allow_html=True,
            )
        elif r.correct_fact:
            st.markdown(f"**Confirmed:** {esc(r.correct_fact)}")
        if r.explanation:
            st.markdown(f"_{esc(r.explanation)}_")
        if r.sources:
            st.markdown(
                "Sources: " + " · ".join(
                    f"[{esc(s.title[:70])}]({s.url})" for s in r.sources
                )
            )
