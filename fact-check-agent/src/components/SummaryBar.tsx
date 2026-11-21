import { Check, Download, FileJson, Loader2, Printer, RotateCcw } from 'lucide-react';
import type { Stage } from '../types';

interface Props {
  filename: string;
  stage: Stage;
  counts: { Verified: number; Inaccurate: number; False: number; Error: number };
  total: number;
  checked: number;
  trustScore: number | null;
  onCsv: () => void;
  onJson: () => void;
  onPrint: () => void;
  onNew: () => void;
}

const STEPS: { key: Stage; label: string }[] = [
  { key: 'reading', label: 'Read' },
  { key: 'extracting', label: 'Find claims' },
  { key: 'verifying', label: 'Verify' },
  { key: 'reviewing', label: 'Review' },
];
const ORDER: Stage[] = ['reading', 'extracting', 'verifying', 'reviewing', 'done'];

/** D6 big serif score + D4 live desk ticker, in one sticky bar. */
export function SummaryBar(p: Props) {
  const done = p.stage === 'done';
  const judged = p.counts.Verified + p.counts.Inaccurate + p.counts.False;
  const toFix = p.counts.Inaccurate + p.counts.False;
  const seg = (n: number) => (p.total ? `${(n / p.total) * 100}%` : '0%');
  const stageIdx = ORDER.indexOf(p.stage);

  return (
    <div className="z-30 border-b border-rule bg-paper/95 backdrop-blur no-print lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
        {/* Score */}
        <div className="flex items-baseline gap-2" data-testid="trust-score">
          <span className="font-serif text-4xl font-extrabold leading-none tracking-tight lg:text-5xl">
            {p.trustScore == null ? '—' : `${p.trustScore}%`}
          </span>
          <span className="font-serif text-lg italic text-ink-2">holds up</span>
        </div>

        {/* Bar + counts */}
        <div className="min-w-[260px] flex-1">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-paper-2">
            <div className="bg-verified transition-all duration-500" style={{ width: seg(p.counts.Verified) }} />
            <div className="bg-amber transition-all duration-500" style={{ width: seg(p.counts.Inaccurate) }} />
            <div className="bg-pen transition-all duration-500" style={{ width: seg(p.counts.False) }} />
            <div className="bg-muted/50 transition-all duration-500" style={{ width: seg(p.counts.Error) }} />
          </div>
          <p className="mt-1.5 text-sm text-ink-2">
            <b className="text-verified">{p.counts.Verified} verified</b> ·{' '}
            <b className="text-amber">{p.counts.Inaccurate} inaccurate</b> · <b className="text-pen">{p.counts.False} false</b>
            {p.counts.Error > 0 && <> · {p.counts.Error} not checked</>}
            {judged > 0 && (
              <span className="ml-2 font-serif italic">
                {toFix ? `${toFix} need${toFix === 1 ? 's' : ''} fixing` : 'nothing to fix'}
              </span>
            )}
          </p>
        </div>

        {/* Ticker or actions */}
        {!done ? (
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid="ticker">
            {STEPS.map((s, i) => {
              const idx = ORDER.indexOf(s.key);
              const state = stageIdx > idx ? 'done' : stageIdx === idx ? 'active' : 'todo';
              let label = s.label;
              if (s.key === 'extracting' && state === 'done') label = `${p.total} claims found`;
              if (s.key === 'verifying' && state !== 'todo') label = `Verifying ${p.checked}/${p.total}`;
              return (
                <li key={s.key} className={`flex items-center gap-1.5 ${state === 'todo' ? 'text-muted' : ''}`}>
                  {i > 0 && <span className="text-rule">—</span>}
                  {state === 'done' ? (
                    <Check className="h-4 w-4 text-verified" strokeWidth={3} />
                  ) : state === 'active' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-pen" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-muted" />
                  )}
                  <span className={state === 'active' ? 'font-semibold' : ''}>{label}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <BarButton onClick={p.onCsv} icon={<Download className="h-4 w-4" />} label="CSV" />
            <BarButton onClick={p.onJson} icon={<FileJson className="h-4 w-4" />} label="JSON" />
            <BarButton onClick={p.onPrint} icon={<Printer className="h-4 w-4" />} label="Print" />
            <button
              onClick={p.onNew}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 font-semibold text-paper hover:bg-pen"
            >
              <RotateCcw className="h-4 w-4" /> New document
            </button>
          </div>
        )}
      </div>
      {!done && (
        <div className="h-0.5 bg-paper-2">
          <div
            className="h-full bg-pen transition-all duration-500"
            style={{
              width: `${
                p.stage === 'reading' ? 4 : p.stage === 'extracting' ? 12 : p.stage === 'reviewing' ? 96
                  : 15 + (p.total ? (p.checked / p.total) * 80 : 0)
              }%`,
            }}
          />
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {done ? `Finished. ${p.trustScore ?? 0}% of claims hold up.` : `Checking ${p.filename}`}
      </p>
    </div>
  );
}

function BarButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-2 hover:border-ink"
    >
      {icon} {label}
    </button>
  );
}
