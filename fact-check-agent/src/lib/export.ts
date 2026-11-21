import type { Claim, ClaimResult, Contradiction, Correction } from '../types';

export interface ReportData {
  filename: string;
  generatedAt: string;
  trustScore: number | null;
  claims: Claim[];
  results: Record<number, ClaimResult>;
  contradictions: Contradiction[];
  corrections: Correction[];
}

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const base = (name: string) => name.replace(/\.pdf$/i, '') || 'document';

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(r: ReportData) {
  const rows = [
    ['#', 'Page', 'Verdict', 'Claim', 'Document says', 'Real fact', 'Explanation', 'Evidence', 'Confidence', 'Sources'],
    ...r.claims.map((c) => {
      const res = r.results[c.id];
      return [
        c.id, c.page ?? '', res?.verdict ?? 'Not checked', c.text, c.quote, res?.correct_fact,
        res?.explanation, res?.evidence_quote, res?.confidence, res?.sources.map((s) => s.url).join(' | '),
      ];
    }),
  ];
  download(rows.map((row) => row.map(csvCell).join(',')).join('\n'), `${base(r.filename)}-fact-check.csv`, 'text/csv');
}

export function exportJson(r: ReportData) {
  const payload = {
    filename: r.filename,
    generated_at: r.generatedAt,
    trust_score: r.trustScore,
    claims: r.claims.map((c) => ({ ...c, result: r.results[c.id] ?? null })),
    contradictions: r.contradictions,
    corrections: r.corrections,
  };
  download(JSON.stringify(payload, null, 2), `${base(r.filename)}-fact-check.json`, 'application/json');
}
