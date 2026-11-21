import { ChevronRight, ExternalLink, Split } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { proofDiff, suspectSegments, type Segment } from '../lib/diff';
import { VERDICT_STYLE } from '../lib/verdict';
import type { Claim, ClaimResult, ClaimStatus, Contradiction, Correction } from '../types';

interface Props {
  claim: Claim;
  result?: ClaimResult;
  status: ClaimStatus;
  correction?: Correction;
  contradictions: Contradiction[];
  selected: boolean;
  onSelect: () => void;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export function ProofText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.type === 'del' ? (
          <del key={i} className="decoration-pen decoration-2 text-ink-2">{s.text}</del>
        ) : s.type === 'ins' ? (
          <ins key={i} className="ml-1 font-hand text-[1.35em] leading-none text-pen no-underline">{s.text}</ins>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** D5 "proof-mark" card: struck-through figure, handwritten correction, verdict stamp. */
export const ClaimCard = forwardRef<HTMLElement, Props>(function ClaimCard(
  { claim, result, status, correction, contradictions, selected, onSelect },
  ref,
) {
  const [open, setOpen] = useState(false);
  const pending = !result || status === 'checking' || status === 'queued';
  const v = result ? VERDICT_STYLE[result.verdict] : null;
  const flagged = result && (result.verdict === 'Inaccurate' || result.verdict === 'False');
  const quote = claim.quote || claim.text;

  let body: Segment[] = [{ type: 'same', text: quote }];
  if (flagged && !pending) {
    body = correction ? proofDiff(correction.original, correction.corrected).filter((s) => s.type !== 'ins')
      : suspectSegments(quote, result!.correct_fact);
    if (result!.verdict === 'False' && !body.some((s) => s.type === 'del')) body = [{ type: 'del', text: quote }];
  }

  return (
    <article
      ref={ref}
      onClick={onSelect}
      data-testid="claim-card"
      className={`relative cursor-pointer rounded-xl border bg-white p-4 transition ${
        selected ? 'border-ink shadow-[0_6px_24px_-10px_rgba(26,26,26,0.35)]' : 'border-rule hover:border-ink/40'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="font-serif font-semibold text-ink">§ {claim.id}</span> · {claim.category}
          {claim.page ? ` · p.${claim.page}` : ''}
        </p>
        {pending ? (
          <span className="rounded-sm border border-dashed border-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {status === 'queued' ? 'Queued' : 'Checking…'}
          </span>
        ) : (
          <span
            className={`-rotate-3 rounded-sm border-2 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.15em] ${v!.fg} border-current`}
            data-testid="verdict-stamp"
          >
            {status === 'rechecking' ? 'Second opinion…' : v!.label}
          </span>
        )}
      </div>

      {/* Claim text with proof marks */}
      <p className={`mt-2 font-serif text-[17px] leading-snug ${pending ? 'text-ink-2' : ''}`}>
        “<ProofText segments={body} />”
      </p>
      {claim.quote && claim.quote.length < 40 && (
        <p className="mt-1 text-xs text-muted">{claim.text}</p>
      )}

      {pending && (
        <div className="mt-3 space-y-1.5" aria-hidden>
          <div className="h-2 w-4/5 animate-pulse rounded bg-paper-2" />
          <div className="h-2 w-3/5 animate-pulse rounded bg-paper-2" />
        </div>
      )}

      {!pending && result && (
        <>
          {flagged && result.correct_fact && (
            <p className="mt-2 font-hand text-2xl leading-tight text-pen" data-testid="real-fact">
              ✎ {result.correct_fact}
            </p>
          )}
          {result.verdict === 'Verified' && result.correct_fact && (
            <p className="mt-2 text-sm text-verified">
              <b>✓ Confirmed:</b> {result.correct_fact}
            </p>
          )}
          {result.explanation && (
            <p className={`mt-1.5 text-sm ${result.verdict === 'Error' ? 'text-muted' : 'text-ink-2'}`}>{result.explanation}</p>
          )}

          {contradictions.map((c, i) => (
            <p key={i} className="mt-2 flex gap-1.5 rounded-md bg-pen-soft px-2.5 py-1.5 text-xs text-pen">
              <Split className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Contradicts § {c.claim_ids.filter((id) => id !== claim.id).join(', § ')}:</b> {c.explanation}
              </span>
            </p>
          ))}

          {result.verdict !== 'Error' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => !o);
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
              aria-expanded={open}
            >
              <ChevronRight className={`h-3.5 w-3.5 transition ${open ? 'rotate-90' : ''}`} />
              Evidence · {result.sources.length} source{result.sources.length === 1 ? '' : 's'} · {result.confidence}% confident
              {result.second_opinion && ' · double-checked'}
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2 border-l-2 border-rule pl-3" onClick={(e) => e.stopPropagation()}>
              {result.evidence_quote && (
                <blockquote className="font-serif text-sm italic text-ink-2">“{result.evidence_quote}”</blockquote>
              )}
              <ul className="space-y-1">
                {result.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-ink-2 underline decoration-rule underline-offset-2 hover:text-pen"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="font-semibold">{host(s.url)}</span> · {s.title.slice(0, 80)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
});
