/** Word-level diff (LCS) for editor-style proof marks. */
export type Segment = { type: 'same' | 'del' | 'ins'; text: string };

const tokenize = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

export function wordDiff(before: string, after: string): Segment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;
  // LCS table (documents are short passages, so O(n*m) is fine)
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: Segment[] = [];
  const push = (type: Segment['type'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) push('same', a[i++]), j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', a[i++]);
    else push('ins', b[j++]);
  }
  while (i < n) push('del', a[i++]);
  while (j < m) push('ins', b[j++]);
  // Whitespace-only edits read better as unchanged text.
  return out.map((s) => (s.type !== 'same' && !s.text.trim() ? { ...s, type: 'same' } : s));
}

const NUM = /\d[\d,.]*\s*(%|percent|million|billion|trillion|m\b|bn\b)?/gi;

/**
 * Before a full correction exists, mark which figures in the quote look wrong:
 * numbers in the document's quote that do not appear in the real fact.
 */
export function suspectSegments(quote: string, correctFact: string): Segment[] {
  const factNums = new Set((correctFact.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]$/, '')));
  const out: Segment[] = [];
  let last = 0;
  for (const m of quote.matchAll(NUM)) {
    const raw = m[0].trim();
    const digits = raw.match(/\d[\d,.]*/)![0].replace(/[,.]$/, '');
    if (factNums.has(digits)) continue;
    const start = m.index!;
    out.push({ type: 'same', text: quote.slice(last, start) });
    out.push({ type: 'del', text: quote.slice(start, start + raw.length) });
    last = start + raw.length;
  }
  out.push({ type: 'same', text: quote.slice(last) });
  return out.filter((s) => s.text);
}

/**
 * Diff for display: when a passage was largely rewritten, interleaved word marks are
 * unreadable, so strike the whole original and write the replacement after it.
 */
export function proofDiff(before: string, after: string): Segment[] {
  const segs = wordDiff(before, after);
  const same = segs.filter((s) => s.type === 'same').reduce((n, s) => n + s.text.trim().length, 0);
  if (same / Math.max(before.length, after.length, 1) < 0.45) {
    return [{ type: 'del', text: before }, { type: 'ins', text: after }];
  }
  return segs;
}
