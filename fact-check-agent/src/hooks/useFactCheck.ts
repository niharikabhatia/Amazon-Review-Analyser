import { useCallback, useMemo, useRef, useState } from 'react';
import { correctDocument, extractClaims, findContradictions, verifyClaim } from '../lib/api';
import { buildHighlights, type Highlight } from '../lib/highlight';
import { MAX_FILE_MB, openPdf, readLayouts, toPageTexts, type PageLayout, type PDFDocumentProxy } from '../lib/pdf';
import { runPool } from '../lib/pool';
import type {
  Claim, ClaimResult, ClaimStatus, Contradiction, Correction, Settings, Stage,
} from '../types';

const CONCURRENCY = 4;

export interface FactCheckState {
  stage: Stage;
  error: string | null;
  filename: string;
  doc: PDFDocumentProxy | null;
  layouts: PageLayout[];
  claims: Claim[];
  status: Record<number, ClaimStatus>;
  results: Record<number, ClaimResult>;
  contradictions: Contradiction[];
  corrections: Correction[];
  reviewError: string | null; // consistency/correction failures don't fail the report
  startedAt: number | null;
  finishedAt: number | null;
}

const initial: FactCheckState = {
  stage: 'idle', error: null, filename: '', doc: null, layouts: [], claims: [], status: {},
  results: {}, contradictions: [], corrections: [], reviewError: null, startedAt: null, finishedAt: null,
};

export function useFactCheck(settings: Settings) {
  const [state, setState] = useState<FactCheckState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const patch = (p: Partial<FactCheckState> | ((s: FactCheckState) => Partial<FactCheckState>)) =>
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));

  const reset = useCallback(() => {
    abortRef.current?.abort();
    state.doc?.destroy();
    setState(initial);
  }, [state.doc]);

  const run = useCallback(
    async (file: File) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const signal = ctrl.signal;
      setState({ ...initial, stage: 'reading', filename: file.name, startedAt: Date.now() });

      try {
        // 1. Read the PDF in the browser.
        if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Please upload a PDF under ${MAX_FILE_MB} MB.`);
        const doc = await openPdf(await file.arrayBuffer());
        const layouts = await readLayouts(doc);
        const pages = toPageTexts(layouts).filter((p) => p.text);
        if (!pages.length) throw new Error('No selectable text found. Scanned/image-only PDFs are not supported yet.');
        patch({ doc, layouts, stage: 'extracting' });

        // 2. Extract claims.
        const claims = await extractClaims(pages, settings, signal);
        if (signal.aborted) return;
        if (!claims.length) {
          patch({ claims, stage: 'done', finishedAt: Date.now() });
          return;
        }
        patch({
          claims,
          stage: 'verifying',
          status: Object.fromEntries(claims.map((c) => [c.id, 'queued' as ClaimStatus])),
        });

        // 3. Verify each claim (4 in parallel), with a second opinion when unsure.
        const results: Record<number, ClaimResult> = {};
        await runPool(claims, CONCURRENCY, async (claim) => {
          patch((s) => ({ status: { ...s.status, [claim.id]: 'checking' } }));
          let result: ClaimResult;
          try {
            result = await verifyClaim(claim, settings, undefined, signal);
            if (result.needs_second_opinion && !signal.aborted) {
              patch((s) => ({ status: { ...s.status, [claim.id]: 'rechecking' }, results: { ...s.results, [claim.id]: result } }));
              result = await verifyClaim(claim, settings, result, signal);
            }
          } catch (err) {
            if (signal.aborted) return;
            result = {
              claim_id: claim.id, verdict: 'Error', correct_fact: '', explanation: (err as Error).message,
              evidence_quote: '', confidence: 0, sources: [], second_opinion: false,
            };
          }
          results[claim.id] = result;
          patch((s) => ({ status: { ...s.status, [claim.id]: 'done' }, results: { ...s.results, [claim.id]: result } }));
        }, signal);
        if (signal.aborted) return;

        // 4. Document-level review: contradictions + corrected version.
        patch({ stage: 'reviewing' });
        const [consistency, corrections] = await Promise.allSettled([
          findContradictions(claims, settings, signal),
          correctDocument(claims, Object.values(results), settings, signal),
        ]);
        if (signal.aborted) return;
        const failed = [consistency, corrections].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        patch({
          stage: 'done',
          finishedAt: Date.now(),
          contradictions: consistency.status === 'fulfilled' ? consistency.value : [],
          corrections: corrections.status === 'fulfilled' ? corrections.value : [],
          reviewError: failed ? (failed.reason as Error).message : null,
        });
      } catch (err) {
        if (signal.aborted) return;
        patch({ stage: 'error', error: (err as Error).message || 'Something went wrong.' });
      }
    },
    [settings],
  );

  const highlights: Map<number, Highlight> = useMemo(
    () => buildHighlights(state.claims, state.layouts),
    [state.claims, state.layouts],
  );

  const summary = useMemo(() => {
    const counts = { Verified: 0, Inaccurate: 0, False: 0, Error: 0 };
    for (const r of Object.values(state.results)) counts[r.verdict]++;
    const judged = counts.Verified + counts.Inaccurate + counts.False;
    return {
      counts,
      checked: Object.keys(state.results).length,
      total: state.claims.length,
      trustScore: judged ? Math.round((counts.Verified / judged) * 100) : null,
    };
  }, [state.results, state.claims.length]);

  return { state, run, reset, highlights, summary };
}
