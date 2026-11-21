import { useEffect, useRef, useState } from 'react';
import type { Highlight } from '../lib/highlight';
import type { PageLayout, PDFDocumentProxy } from '../lib/pdf';
import { PENDING_HL, VERDICT_STYLE } from '../lib/verdict';
import type { ClaimResult } from '../types';

interface Props {
  doc: PDFDocumentProxy;
  layouts: PageLayout[];
  highlights: Map<number, Highlight>;
  results: Record<number, ClaimResult>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** Renders every page to a canvas and overlays verdict-coloured highlights. */
export function PdfViewer({ doc, layouts, highlights, results, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll the selected claim's highlight into view.
  useEffect(() => {
    if (selectedId == null) return;
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-claim="${selectedId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedId]);

  const byPage = new Map<number, Highlight[]>();
  for (const h of highlights.values()) byPage.set(h.page, [...(byPage.get(h.page) ?? []), h]);

  return (
    <div ref={wrapRef} className="space-y-5">
      {width > 0 &&
        layouts.map((layout) => (
          <PdfPage
            key={layout.page}
            doc={doc}
            layout={layout}
            width={width}
            highlights={byPage.get(layout.page) ?? []}
            results={results}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

interface PageProps extends Omit<Props, 'layouts' | 'highlights'> {
  layout: PageLayout;
  width: number;
  highlights: Highlight[];
}

function PdfPage({ doc, layout, width, highlights, results, selectedId, onSelect }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = width / layout.width;
  const height = layout.height * scale;

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(layout.page);
      if (cancelled || !canvasRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      task = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, layout.page, scale]);

  return (
    <div
      className="relative mx-auto bg-white shadow-[0_1px_0_#e4dfd3,0_10px_30px_-12px_rgba(26,26,26,0.25)]"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} style={{ width, height }} className="block" aria-label={`Page ${layout.page}`} />
      {highlights.map((h) => {
        const result = results[h.claimId];
        const color = result ? VERDICT_STYLE[result.verdict].hl : PENDING_HL;
        const selected = h.claimId === selectedId;
        return h.rects.map((r, i) => (
          <button
            key={`${h.claimId}-${i}`}
            data-claim={i === 0 ? h.claimId : undefined}
            onClick={() => onSelect(h.claimId)}
            title={result ? `${VERDICT_STYLE[result.verdict].label}: click for details` : 'Checking…'}
            className={`absolute rounded-[2px] mix-blend-multiply transition-[outline] ${
              selected ? 'outline-2 outline-pen outline-offset-1' : 'hover:outline hover:outline-ink/30'
            }`}
            style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale, background: color }}
          />
        ));
      })}
      <span className="absolute -left-7 top-1 font-serif text-xs text-muted select-none">{layout.page}</span>
    </div>
  );
}
