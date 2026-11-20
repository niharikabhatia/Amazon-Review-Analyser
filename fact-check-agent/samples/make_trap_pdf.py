"""Generate samples/trap_document.pdf: a marketing brief seeded with known errors.

Run: python samples/make_trap_pdf.py   (requires reportlab, see requirements-dev.txt)

The answer key below lists what the agent is expected to flag.
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

ANSWER_KEY = [
    # (claim as written, expected verdict, real fact)
    ("ChatGPT launched on 30 November 2022", "Verified", "Launched 30 Nov 2022"),
    ("ChatGPT reached 100M users in about two months", "Verified", "~100M MAU by Jan 2023"),
    ("Google holds 98% of global search", "Inaccurate", "~90% (StatCounter)"),
    ("Apple first hit a $3T market cap in 2018", "Inaccurate", "$1T in 2018; $3T in Jan 2022"),
    ("Tesla delivered 5 million vehicles in 2023", "Inaccurate", "~1.81 million"),
    ("World population passed 10 billion in 2022", "Inaccurate", "Passed 8 billion, Nov 2022"),
    ("Amazon 2023 revenue $574.8B", "Verified", "$574.8B"),
    ("Microsoft bought LinkedIn for $26.2B in 2016", "Verified", "$26.2B, 2016"),
    ("Bitcoin was created in 2015", "Inaccurate", "2009"),
    ("2024 MIT study: 87% of CMOs replaced SEO with GEO", "False", "No such study"),
    ("Eiffel Tower completed in 1899", "Inaccurate", "1889"),
    ("Nvidia was founded in 1993", "Verified", "1993"),
]

TITLE = "The 2026 AI Marketing Playbook"
SECTIONS = [
    (
        "Why AI search matters now",
        "OpenAI launched ChatGPT on 30 November 2022, and it became the fastest-growing "
        "consumer app in history, reaching 100 million users in roughly two months. "
        "Google still dominates traditional search with 98% of the global search market, "
        "but answer engines are quickly reshaping how buyers discover brands.",
    ),
    (
        "Big Tech is all-in",
        "Apple became the first company to reach a $3 trillion market capitalisation back in "
        "2018. Nvidia, founded in 1993, now powers most AI training workloads. Microsoft's "
        "$26.2 billion acquisition of LinkedIn in 2016 gives it unmatched B2B data for AI. "
        "Amazon reported net sales of $574.8 billion in 2023.",
    ),
    (
        "Every industry is moving",
        "Tesla delivered 5 million vehicles in 2023, proving that tech-first brands win. "
        "With the world population passing 10 billion in 2022, the addressable audience for "
        "AI assistants has never been larger. Even Bitcoin, created in 2015, is now marketed "
        "through AI-generated content.",
    ),
    (
        "The GEO opportunity",
        "A 2024 MIT study found that 87% of Fortune 500 CMOs have already fully replaced their "
        "SEO budgets with Generative Engine Optimization. Brands that wait risk becoming as "
        "outdated as the Eiffel Tower felt when it was completed in 1899.",
    ),
]


def build(path: Path) -> None:
    styles = getSampleStyleSheet()
    story = [Paragraph(TITLE, styles["Title"]), Spacer(1, 12)]
    for heading, body in SECTIONS:
        story += [Paragraph(heading, styles["Heading2"]), Paragraph(body, styles["BodyText"]),
                  Spacer(1, 10)]
    SimpleDocTemplate(str(path), pagesize=A4, title=TITLE).build(story)


if __name__ == "__main__":
    out = Path(__file__).with_name("trap_document.pdf")
    build(out)
    print(f"Wrote {out}")
