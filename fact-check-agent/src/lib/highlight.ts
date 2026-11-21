import type { Claim } from '../types';
import type { PageLayout } from './pdf';

/** A highlight rectangle in PDF user-space units (origin top-left, y down). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Highlight {
  claimId: number;
  page: number;
  rects: Rect[];
}

/**
 * Collapse whitespace and normalise quotes/dashes so a claim's quote matches the PDF
 * text even when line breaks or typography differ. Returns the normalised string and,
 * for every character in it, its index in the original string.
 */
function normalise(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let ch = text[i];
    if (/\s/.test(ch)) {
      if (lastSpace) continue;
      ch = ' ';
      lastSpace = true;
    } else {
      lastSpace = false;
      ch = ch
        .replace(/[‘’]/, "'")
        .replace(/[“”]/, '"')
        .replace(/[–—]/, '-')
        .toLowerCase();
    }
    norm += ch;
    map.push(i);
  }
  return { norm, map };
}

/** Find [start, end) of `needle` inside `layout.text`, tolerant to whitespace. */
function locate(layout: PageLayout, needle: string): [number, number] | null {
  const hay = normalise(layout.text);
  const target = normalise(needle).norm.trim().replace(/[.,;:]$/, '');
  if (target.length < 2) return null;
  let at = hay.norm.indexOf(target);
  // Hyphenated line breaks: retry without hyphen+space joins.
  if (at < 0) at = hay.norm.replace(/- /g, '').indexOf(target.replace(/- /g, ''));
  if (at < 0) return null;
  const start = hay.map[at];
  const end = hay.map[Math.min(at + target.length - 1, hay.map.length - 1)] + 1;
  return [start, end];
}

/** Rectangles covering text offsets [start, end) on one page. */
function rectsFor(layout: PageLayout, start: number, end: number): Rect[] {
  const rects: Rect[] = [];
  for (const run of layout.runs) {
    const runEnd = run.start + run.str.length;
    if (runEnd <= start || run.start >= end) continue;
    const from = Math.max(start, run.start) - run.start;
    const to = Math.min(end, runEnd) - run.start;
    const charW = run.str.length ? run.width / run.str.length : 0;
    const pad = run.height * 0.18;
    rects.push({
      x: run.x + from * charW,
      y: layout.height - run.y - run.height - pad / 2,
      w: Math.max((to - from) * charW, 2),
      h: run.height + pad,
    });
  }
  return rects;
}

/** Map each claim to highlight rectangles, searching its page first, then all pages. */
export function buildHighlights(claims: Claim[], layouts: PageLayout[]): Map<number, Highlight> {
  const out = new Map<number, Highlight>();
  for (const claim of claims) {
    const needles = [claim.quote, claim.text].filter((s) => s && s.trim().length > 1);
    const ordered = [
      ...layouts.filter((l) => l.page === claim.page),
      ...layouts.filter((l) => l.page !== claim.page),
    ];
    search: for (const needle of needles) {
      for (const layout of ordered) {
        const span = locate(layout, needle);
        if (span) {
          const rects = rectsFor(layout, span[0], span[1]);
          if (rects.length) {
            out.set(claim.id, { claimId: claim.id, page: layout.page, rects });
            break search;
          }
        }
      }
    }
  }
  return out;
}
