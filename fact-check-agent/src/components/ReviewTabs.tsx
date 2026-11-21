import { Check, Copy, Loader2, Split } from 'lucide-react';
import { useState } from 'react';
import { proofDiff } from '../lib/diff';
import type { Claim, Contradiction, Correction, Stage } from '../types';
import { ProofText } from './ClaimCard';

const Waiting = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 py-10 text-sm text-muted">
    <Loader2 className="h-4 w-4 animate-spin" /> {text}
  </p>
);

/** D7: inline proof marks, wrong words struck through and new words handwritten. */
export function CorrectedTab({
  corrections, stage, reviewError, onSelect,
}: { corrections: Correction[]; stage: Stage; reviewError: string | null; onSelect: (id: number) => void }) {
  const [copied, setCopied] = useState(false);
  if (stage !== 'done') return <Waiting text="The corrected version is written once every claim is checked…" />;
  if (!corrections.length)
    return (
      <p className="py-10 text-sm text-muted">
        {reviewError ? `Could not write corrections: ${reviewError}` : 'Nothing to correct: every checked claim holds up.'}
      </p>
    );

  const copy = async () => {
    const text = corrections.map((c) => c.corrected).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-2">
          {corrections.length} passage{corrections.length === 1 ? '' : 's'} rewritten with the real facts
        </p>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-sm hover:border-ink"
        >
          {copied ? <Check className="h-4 w-4 text-verified" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy clean text'}
        </button>
      </div>
      <div className="divide-y divide-rule rounded-xl border border-rule bg-white">
        {corrections.map((c) => (
          <button
            key={c.claim_id}
            onClick={() => onSelect(c.claim_id)}
            className="flex w-full gap-3 px-4 py-4 text-left hover:bg-paper"
            data-testid="correction"
          >
            <span className="w-8 shrink-0 whitespace-nowrap pt-1 font-serif text-sm font-semibold text-muted">§ {c.claim_id}</span>
            <p className="font-serif text-[17px] leading-relaxed">
              <ProofText segments={proofDiff(c.original, c.corrected)} />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConsistencyTab({
  contradictions, claims, stage, onSelect,
}: { contradictions: Contradiction[]; claims: Claim[]; stage: Stage; onSelect: (id: number) => void }) {
  if (stage !== 'done') return <Waiting text="Cross-checking the document against itself…" />;
  if (!contradictions.length)
    return <p className="py-10 text-sm text-muted">No internal contradictions: the document is consistent with itself.</p>;
  const byId = new Map(claims.map((c) => [c.id, c]));
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">Places where the document disagrees with itself:</p>
      {contradictions.map((c, i) => (
        <div key={i} className="rounded-xl border border-pen/30 bg-white p-4">
          <p className="flex items-center gap-2 font-semibold text-pen">
            <Split className="h-4 w-4" /> {c.explanation}
          </p>
          <ul className="mt-2 space-y-1">
            {c.claim_ids.map((id) => (
              <li key={id}>
                <button onClick={() => onSelect(id)} className="text-left font-serif text-sm hover:text-pen">
                  <b>§ {id}</b> “{byId.get(id)?.quote || byId.get(id)?.text}”
                  {byId.get(id)?.page ? <span className="text-muted"> · p.{byId.get(id)!.page}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
