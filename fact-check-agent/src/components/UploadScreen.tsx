import { Check, FileText, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { MAX_FILE_MB } from '../lib/pdf';

export const SAMPLES = [
  { file: 'ai-marketing-playbook.pdf', title: 'The 2026 AI Marketing Playbook', blurb: '12 claims · market share, valuations, a "study"' },
  { file: 'india-digital-economy-report.pdf', title: "India's Digital Economy Briefing", blurb: '9 claims · GDP, UPI, plus an internal contradiction' },
  { file: 'clean-tech-investor-memo.pdf', title: 'Clean-Tech Investor Memo', blurb: '9 claims · energy, EVs, consumer tech' },
];

interface Props {
  onFile: (file: File) => void;
  error: string | null;
}

export function UploadScreen({ onFile, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  const runSample = async (name: string) => {
    setLoadingSample(name);
    try {
      const blob = await (await fetch(`/samples/${name}`)).blob();
      onFile(new File([blob], name, { type: 'application/pdf' }));
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <main className="paper-grain min-h-[calc(100vh-72px)]">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        {/* Left: pitch */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-pen">The truth layer for marketing content</p>
          <h1 className="mt-4 font-serif text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Catch fake stats before your readers do.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Upload any PDF: a report, a pitch deck, a blog draft. Red Pen reads it like a newsroom fact-checker and
            marks every figure that doesn't hold up, with the real numbers and sources.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              ['Extracts every claim', 'Stats, dates, financial and technical figures, nothing with a number slips through.'],
              ['Checks the live web', "Each claim is searched now, against today's date, preferring primary sources."],
              ['Gives you the real facts', 'Verified, Inaccurate or False, with the correct figure, evidence and links.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-ink-2">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-10 border-t border-rule pt-4 font-serif text-sm italic text-muted">
            Your PDF is read in your browser; only its text is sent for checking and nothing is stored.
          </p>
        </section>

        {/* Right: drop zone + samples */}
        <section className="flex flex-col gap-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-8 py-14 text-center transition ${
              dragging ? 'border-pen bg-pen-soft/40' : 'border-ink/25 hover:border-ink/60'
            }`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-2">
              <Upload className="h-6 w-6" />
            </span>
            <p className="mt-5 font-serif text-2xl font-semibold">Drop your PDF here</p>
            <p className="mt-1 text-sm text-ink-2">
              or <span className="font-semibold text-pen underline underline-offset-4">browse your files</span>
            </p>
            <p className="mt-4 text-xs text-muted">PDF with selectable text · up to {MAX_FILE_MB} MB · first 25 pages</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = '';
              }}
              data-testid="file-input"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-pen/30 bg-pen-soft px-4 py-3 text-sm text-pen" role="alert">
              {error}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              No PDF handy? Try a trap document
            </p>
            <div className="divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-white">
              {SAMPLES.map((s) => (
                <button
                  key={s.file}
                  onClick={() => runSample(s.file)}
                  disabled={loadingSample !== null}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-paper-2 disabled:opacity-60"
                >
                  <FileText className="h-5 w-5 shrink-0 text-pen" />
                  <span className="flex-1">
                    <span className="block font-serif font-semibold">{s.title}</span>
                    <span className="block text-xs text-muted">{s.blurb}</span>
                  </span>
                  <span className="text-xs font-semibold text-ink-2">{loadingSample === s.file ? 'Loading…' : 'Check →'}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
