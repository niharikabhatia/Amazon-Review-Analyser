# 🔎 Fact-Check Agent: a "Truth Layer" for marketing PDFs

Upload a PDF. The agent **extracts** every specific claim (stats, dates, financial and technical figures), **verifies** each one against the **live web**, and **reports** it as:

| Verdict | Meaning |
|---|---|
| ✅ **Verified** | Matches current, reliable data |
| ⚠️ **Inaccurate** | Real topic, but the figure is wrong, exaggerated or **outdated**. The correct, latest figure is shown |
| ❌ **False** | No credible evidence exists (fabricated stat, non-existent study) |

Every verdict comes with the **real fact**, a short explanation, a confidence score and **source links**. Reports can be downloaded as CSV or JSON.

**Live app:** `<add your Streamlit Cloud URL here>`
**Demo video:** `<add link>`

---

## How it works

```
PDF ──► 1. Extract text (pypdf, page-aware, chunked)
      ──► 2. Extract claims (LLM → JSON: self-contained claim, verbatim quote, page, search query)
      ──► 3. Verify each claim in parallel against the live web
             • default: OpenAI Responses API + built-in `web_search` tool
             • optional: Tavily search results → LLM judges only on that evidence
      ──► 4. Report: verdict + correct fact + explanation + confidence + sources
```

Design choices that matter for "trap documents":

- **Date-aware verification.** Today's date goes into every verification prompt, so a stat that *was* true (e.g. an old market-share figure) is flagged **Inaccurate (outdated)** and the newer figure is given.
- **Self-contained claims.** Claims are rewritten with subject, number and time frame, so each one can be searched on its own, and the verbatim quote is kept for traceability.
- **Evidence over memory.** The model must search before it decides and cite URLs. Primary and authoritative, most recent sources are preferred.
- **Failure isolation.** If one claim's check fails (rate limit, timeout), it is marked *Error* and the rest of the report still completes.
- **Bring-your-own-key.** If the hosted key runs out of credits, a reviewer can paste their own key in the sidebar. It is used for that session only and never stored.

## Project structure

```
fact-check-agent/
├── app.py                    # Streamlit UI (upload → progress → report → CSV/JSON)
├── factcheck/
│   ├── pdf_reader.py         # PDF text extraction + chunking
│   ├── claims.py             # Step 1: claim extraction prompt + de-duplication
│   ├── verifier.py           # Step 2/3: web verification + verdict
│   ├── search.py             # Optional Tavily search backend
│   ├── llm.py                # OpenAI Responses API wrapper, JSON parsing, citations
│   ├── pipeline.py           # Orchestration, parallelism, report model
│   └── models.py             # Claim / Verdict / Source dataclasses
├── samples/
│   ├── make_trap_pdf.py      # Builds a test PDF seeded with known errors (+ answer key)
│   └── trap_document.pdf
├── tests/test_pipeline.py    # Offline tests (LLM mocked)
├── requirements.txt
└── .streamlit/               # config + secrets template
```

## Run locally

```bash
cd fact-check-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml   # then add your OPENAI_API_KEY
streamlit run app.py
```

Run the tests (no API key needed):

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Deploy to Streamlit Community Cloud

1. Push this repo to GitHub.
2. Go to [share.streamlit.io](https://share.streamlit.io), then **Create app**, then pick the repo/branch and set **Main file path** to `fact-check-agent/app.py`.
3. Open **Advanced settings → Secrets** and paste:
   ```toml
   OPENAI_API_KEY = "sk-..."
   # TAVILY_API_KEY = "tvly-..."   # optional
   ```
4. Click **Deploy**. Streamlit installs `fact-check-agent/requirements.txt` automatically.

## Configuration

| Setting | Required | Default | Notes |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | | Used for extraction, reasoning and (by default) web search |
| `TAVILY_API_KEY` | | | If set, Tavily supplies the search evidence instead of OpenAI web search |
| `OPENAI_MODEL` | | `gpt-4.1-mini` | Any Responses-API model that supports the `web_search` tool |
| `MAX_CLAIMS` | | `20` | Upper bound on claims checked per document (cost control) |

## Testing with the sample trap document

`samples/trap_document.pdf` mixes true facts with planted errors. The expected answers are in `samples/make_trap_pdf.py`, for example:

| Document says | Expected | Real fact |
|---|---|---|
| Google holds 98% of global search | ⚠️ Inaccurate | ~90% (StatCounter) |
| Apple first hit a $3T market cap in 2018 | ⚠️ Inaccurate | $1T in 2018, $3T in Jan 2022 |
| Tesla delivered 5M vehicles in 2023 | ⚠️ Inaccurate | ~1.81M |
| 2024 MIT study: 87% of CMOs replaced SEO with GEO | ❌ False | No such study |
| ChatGPT launched 30 Nov 2022 | ✅ Verified | |

## Limitations

- Scanned or image-only PDFs are not supported (no OCR).
- Very long documents are capped at 30 pages and `MAX_CLAIMS` claims to keep cost and latency bounded.
- Verdicts are only as good as what's findable on the open web. Paywalled data may come back as *False (no evidence)*.
