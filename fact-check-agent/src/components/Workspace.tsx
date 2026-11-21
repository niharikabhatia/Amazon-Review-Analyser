import { useEffect, useMemo, useRef, useState } from 'react';
import type { FactCheckState } from '../hooks/useFactCheck';
import type { Highlight } from '../lib/highlight';
import { VERDICT_ORDER } from '../lib/verdict';
import type { Verdict } from '../types';
import { ClaimCard } from './ClaimCard';
import { PdfViewer } from './PdfViewer';
import { ConsistencyTab, CorrectedTab } from './ReviewTabs';

type Tab = 'claims' | 'corrected' | 'consistency' | 'document';
type Filter = 'All' | Exclude<Verdict, 'Error'>;

interface Props {
  state: FactCheckState;
  highlights: Map<number, Highlight>;
}

/** D2 split view: highlighted PDF on the left, claims and review tabs on the right. */
export function Workspace({ state, highlights }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('claims');
  const [filter, setFilter] = useState<Filter>('All');
  const cardRefs = useRef(new Map<number, HTMLElement>());

  const done = state.stage === 'done';
  const contradictionsFor = (id: number) => state.contradictions.filter((c) => c.claim_ids.includes(id));

  // Once finished, show the most serious problems first; while running keep document order.
  const ordered = useMemo(() => {
    const list = [...state.claims];
    if (done) {
      list.sort((a, b) => {
        const va = state.results[a.id]?.verdict ?? 'Error';
        const vb = state.results[b.id]?.verdict ?? 'Error';
        return VERDICT_ORDER[va] - VERDICT_ORDER[vb] || a.id - b.id;
      });
    }
    return list.filter((c) => filter === 'All' || state.results[c.id]?.verdict === filter);
  }, [state.claims, state.results, done, filter]);

  const select = (id: number, from: 'pdf' | 'card') => {
    setSelected(id);
    if (from === 'pdf') {
      setTab('claims');
      setFilter('All');
    }
  };

  // Scroll the selected card into view (e.g. when a PDF highlight is clicked).
  useEffect(() => {
    if (selected == null) return;
    const el = cardRefs.current.get(selected);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected, tab]);

  const count = (v: Filter) =>
    v === 'All' ? state.claims.length : Object.values(state.results).filter((r) => r.verdict === v).length;

  const pdf = state.doc && (
    <PdfViewer
      doc={state.doc}
      layouts={state.layouts}
      highlights={highlights}
      results={state.results}
      selectedId={selected}
      onSelect={(id) => select(id, 'pdf')}
    />
  );

  const tabs: [Tab, string, string][] = [
    ['document', 'Document', 'lg:hidden'],
    ['claims', `Claims${state.claims.length ? ` (${state.claims.length})` : ''}`, ''],
    ['corrected', `Corrected version${state.corrections.length ? ` (${state.corrections.length})` : ''}`, ''],
    ['consistency', `Consistency${state.contradictions.length ? ` (${state.contradictions.length})` : ''}`, ''],
  ];

  return (
    <main className="mx-auto grid max-w-[1400px] gap-6 px-5 py-5 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      {/* Left: the document */}
      <section className="hidden lg:block print:hidden">
        <div className="sticky top-[92px] h-[calc(100vh-110px)] overflow-y-auto rounded-xl bg-paper-2 py-6 pl-10 pr-6">
          <p className="mb-3 truncate font-serif text-sm italic text-muted">{state.filename}</p>
          {pdf}
        </div>
      </section>

      {/* Right: review */}
      <section className="min-w-0">
        <nav className="mb-4 flex gap-5 border-b border-rule text-sm no-print" role="tablist">
          {tabs.map(([key, label, cls]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 pb-2 ${cls} ${
                tab === key ? 'border-pen font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'document' && <div className="lg:hidden">{pdf}</div>}

        {tab === 'claims' && (
          <>
            {state.stage === 'extracting' || state.stage === 'reading' ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl border border-rule bg-white" />
                ))}
                <p className="text-center font-serif text-sm italic text-muted">Reading the copy and marking every figure…</p>
              </div>
            ) : state.claims.length === 0 ? (
              <p className="py-10 text-sm text-muted">
                No specific, checkable claims (stats, dates, figures) were found in this document.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2 text-sm no-print">
                  {(['All', 'False', 'Inaccurate', 'Verified'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-full border px-3 py-1 ${
                        filter === f ? 'border-ink bg-ink text-paper' : 'border-rule bg-white hover:border-ink/50'
                      }`}
                    >
                      {f} <span className="opacity-60">{count(f)}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {ordered.map((c) => (
                    <ClaimCard
                      key={c.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(c.id, el);
                        else cardRefs.current.delete(c.id);
                      }}
                      claim={c}
                      result={state.results[c.id]}
                      status={state.status[c.id] ?? 'queued'}
                      correction={state.corrections.find((x) => x.claim_id === c.id)}
                      contradictions={contradictionsFor(c.id)}
                      selected={selected === c.id}
                      onSelect={() => select(c.id, 'card')}
                    />
                  ))}
                  {ordered.length === 0 && <p className="py-6 text-sm text-muted">No claims with this verdict.</p>}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'corrected' && (
          <CorrectedTab
            corrections={state.corrections}
            stage={state.stage}
            reviewError={state.reviewError}
            onSelect={(id) => {
              setTab('claims');
              select(id, 'card');
            }}
          />
        )}
        {tab === 'consistency' && (
          <ConsistencyTab
            contradictions={state.contradictions}
            claims={state.claims}
            stage={state.stage}
            onSelect={(id) => {
              setTab('claims');
              select(id, 'card');
            }}
          />
        )}
      </section>
    </main>
  );
}
