import type { Verdict } from '../types';

export const VERDICT_STYLE: Record<Verdict, { label: string; fg: string; bg: string; mark: string; hl: string }> = {
  Verified: { label: 'Verified', fg: 'text-verified', bg: 'bg-verified-soft', mark: '✓', hl: 'rgba(31,122,77,0.22)' },
  Inaccurate: { label: 'Inaccurate', fg: 'text-amber', bg: 'bg-amber-soft', mark: '≠', hl: 'rgba(183,121,31,0.28)' },
  False: { label: 'False', fg: 'text-pen', bg: 'bg-pen-soft', mark: '✗', hl: 'rgba(214,40,40,0.26)' },
  Error: { label: 'Not checked', fg: 'text-muted', bg: 'bg-paper-2', mark: '?', hl: 'rgba(122,117,107,0.18)' },
};

/** Highlight colour for a claim that has not been judged yet. */
export const PENDING_HL = 'rgba(26,26,26,0.08)';

/** Report order: the most important problems first. */
export const VERDICT_ORDER: Record<Verdict, number> = { False: 0, Inaccurate: 1, Verified: 2, Error: 3 };
