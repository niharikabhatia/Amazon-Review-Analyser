import { Code2, Settings2 } from 'lucide-react';

export function PenMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M8 24 L21 11 L24 14 L11 27 L7 28 Z" fill="#D62828" />
      <path d="M21 11 L23 9 L26 12 L24 14 Z" fill="#1A1A1A" />
    </svg>
  );
}

interface Props {
  onSettings: () => void;
  onHome: () => void;
}

export function Header({ onSettings, onHome }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <header className="masthead-rule bg-paper no-print">
      <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-4 px-5 pb-3 pt-4">
        <button onClick={onHome} className="flex items-center gap-2 text-left" aria-label="Red Pen home">
          <PenMark />
          <span className="font-serif text-3xl font-extrabold tracking-tight">Red Pen</span>
          <span className="ml-3 hidden text-xs uppercase tracking-[0.2em] text-muted md:inline">
            The AI fact-check desk
          </span>
        </button>
        <div className="flex items-center gap-4 text-sm text-ink-2">
          <span className="hidden font-serif italic text-muted lg:inline">{today}</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-pen"
            id="github-link"
          >
            <Code2 className="h-4 w-4" /> <span className="hidden sm:inline">Code</span>
          </a>
          <button onClick={onSettings} className="inline-flex items-center gap-1.5 hover:text-pen">
            <Settings2 className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
