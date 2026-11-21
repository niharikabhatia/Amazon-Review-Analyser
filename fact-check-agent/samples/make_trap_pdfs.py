"""Generate test "trap documents": marketing-style PDFs seeded with known errors.

Run:  python samples/make_trap_pdfs.py   (needs reportlab: pip install -r requirements-dev.txt)
Writes the PDFs to public/samples/ so the web app can offer them as samples.
Each document's ANSWER_KEY lists what the agent is expected to report.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "samples"

DOCUMENTS = [
    {
        "file": "ai-marketing-playbook.pdf",
        "title": "The 2026 AI Marketing Playbook",
        "sections": [
            ("Why AI search matters now",
             "OpenAI launched ChatGPT on 30 November 2022, and it reached 100 million users in "
             "roughly two months. Google still dominates traditional search with 98% of the global "
             "search market, but answer engines are quickly reshaping how buyers discover brands."),
            ("Big Tech is all-in",
             "Apple became the first company to reach a $3 trillion market capitalisation back in "
             "2018. Nvidia, founded in 1993, now powers most AI training workloads. Microsoft's "
             "$26.2 billion acquisition of LinkedIn in 2016 gives it unmatched B2B data for AI. "
             "Amazon reported net sales of $574.8 billion in 2023."),
            ("Every industry is moving",
             "Tesla delivered 5 million vehicles in 2023, proving that tech-first brands win. "
             "With the world population passing 10 billion in 2022, the addressable audience for "
             "AI assistants has never been larger. Even Bitcoin, created in 2015, is now marketed "
             "through AI-generated content."),
            ("The GEO opportunity",
             "A 2024 MIT study found that 87% of Fortune 500 CMOs have already fully replaced their "
             "SEO budgets with Generative Engine Optimization. Brands that wait risk becoming as "
             "outdated as the Eiffel Tower felt when it was completed in 1899."),
        ],
        "answer_key": [
            ("ChatGPT launched 30 Nov 2022", "Verified", ""),
            ("ChatGPT 100M users in ~2 months", "Verified", ""),
            ("Google 98% search share", "Inaccurate", "~90% (StatCounter)"),
            ("Apple first $3T market cap in 2018", "Inaccurate", "$1T in 2018; $3T in Jan 2022"),
            ("Nvidia founded 1993", "Verified", ""),
            ("Microsoft bought LinkedIn for $26.2B in 2016", "Verified", ""),
            ("Amazon 2023 net sales $574.8B", "Verified", ""),
            ("Tesla delivered 5M vehicles in 2023", "Inaccurate", "~1.81M"),
            ("World population passed 10B in 2022", "Inaccurate", "Passed 8B in Nov 2022"),
            ("Bitcoin created in 2015", "Inaccurate", "2009"),
            ("2024 MIT study: 87% of CMOs replaced SEO", "False", "No such study"),
            ("Eiffel Tower completed 1899", "Inaccurate", "1889"),
        ],
    },
    {
        "file": "india-digital-economy-report.pdf",
        "title": "India's Digital Economy: 2026 Brand Briefing",
        "sections": [
            ("A market like no other",
             "India became the world's most populous country in 2023, overtaking China, yet many "
             "brands still plan for a market of 900 million people. The country's GDP crossed "
             "$10 trillion in 2022, making it the largest consumer opportunity on earth."),
            ("Payments went digital overnight",
             "UPI was launched by NPCI in 2016 and today processes about 1 million transactions "
             "a month. Reliance Jio, which launched commercially in 2010, made mobile data "
             "affordable for hundreds of millions of users."),
            ("Science and pride",
             "Chandrayaan-3 landed near the Moon's south pole in August 2023, a first for any "
             "country. Since UPI's launch in 2019, digital trust has grown every year."),
            ("Where shoppers decide",
             "A 2023 Harvard report found that 95% of Indian consumers now shop exclusively "
             "through ChatGPT recommendations, so AI visibility is no longer optional."),
        ],
        "answer_key": [
            ("India most populous in 2023, overtaking China", "Verified", ""),
            ("India population 900 million", "Inaccurate", "~1.4-1.46 billion"),
            ("India GDP crossed $10T in 2022", "Inaccurate", "~$3.4T in 2022"),
            ("UPI launched by NPCI in 2016", "Verified", ""),
            ("UPI ~1 million transactions a month", "Inaccurate", "~20 billion a month (2025-26)"),
            ("Jio launched commercially in 2010", "Inaccurate", "September 2016"),
            ("Chandrayaan-3 south-pole landing Aug 2023, first country", "Verified", ""),
            ("UPI launched in 2019", "Inaccurate", "2016 (also contradicts the 2016 claim)"),
            ("2023 Harvard report: 95% shop only via ChatGPT", "False", "No such report"),
        ],
        "contradictions": [("UPI launched in 2016", "UPI launched in 2019")],
    },
    {
        "file": "clean-tech-investor-memo.pdf",
        "title": "Clean-Tech & Consumer Tech Investor Memo",
        "sections": [
            ("The climate tailwind",
             "The Paris Agreement was adopted in 2015, and solar power now supplies 40% of the "
             "world's electricity. Tesla, founded in 2003, proved that electric cars could be "
             "desirable, and BYD overtook Tesla in quarterly battery-electric vehicle sales in "
             "Q4 2023."),
            ("Batteries that last",
             "A Stanford study shows that modern EV batteries last 300 years, removing the last "
             "objection to electric cars."),
            ("Lessons from consumer tech",
             "The iPhone, launched in 2010, created the app economy. Netflix today has 50 million "
             "subscribers worldwide. Bitcoin's market capitalisation first exceeded $1 trillion "
             "in 2021."),
            ("Bold ambition",
             "Like climbing Mount Everest, all 9,848 metres of it, the energy transition rewards "
             "those who start early."),
        ],
        "answer_key": [
            ("Paris Agreement adopted 2015", "Verified", ""),
            ("Solar supplies 40% of world electricity", "Inaccurate", "~7% in 2024 (Ember)"),
            ("Tesla founded 2003", "Verified", ""),
            ("BYD overtook Tesla in quarterly BEV sales Q4 2023", "Verified", ""),
            ("Stanford: EV batteries last 300 years", "False", "No such study"),
            ("iPhone launched 2010", "Inaccurate", "2007"),
            ("Netflix 50M subscribers", "Inaccurate", "300M+ paid memberships (end 2024)"),
            ("Bitcoin first >$1T market cap in 2021", "Verified", ""),
            ("Mount Everest 9,848 m", "Inaccurate", "8,849 m"),
        ],
    },
]


def build(doc: dict, path: Path) -> None:
    styles = getSampleStyleSheet()
    story = [Paragraph(doc["title"], styles["Title"]), Spacer(1, 12)]
    for i, (heading, body) in enumerate(doc["sections"]):
        if i == 2:  # put the second half on page 2 so page numbers matter
            story.append(PageBreak())
        story += [Paragraph(heading, styles["Heading2"]), Paragraph(body, styles["BodyText"]),
                  Spacer(1, 10)]
    SimpleDocTemplate(str(path), pagesize=A4, title=doc["title"]).build(story)


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for doc in DOCUMENTS:
        build(doc, OUT_DIR / doc["file"])
        print("Wrote", OUT_DIR / doc["file"])
