import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageText } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const MAX_PAGES = 25;
export const MAX_FILE_MB = 20;

export type { PDFDocumentProxy };

/** One positioned run of text on a page, in PDF user-space units. */
export interface TextRun {
  str: string;
  x: number;
  y: number; // baseline, PDF coordinates (origin bottom-left)
  width: number;
  height: number;
  start: number; // offset of this run inside the page's joined text
}

export interface PageLayout {
  page: number;
  width: number;
  height: number;
  text: string; // runs joined with spaces/newlines (what the API sees)
  runs: TextRun[];
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  try {
    return await pdfjs.getDocument({ data }).promise;
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === 'PasswordException') throw new Error('This PDF is password-protected.');
    throw new Error('This file could not be read as a PDF.');
  }
}

/** Extract positioned text for each page (used for both the API and highlighting). */
export async function readLayouts(doc: PDFDocumentProxy): Promise<PageLayout[]> {
  const layouts: PageLayout[] = [];
  const count = Math.min(doc.numPages, MAX_PAGES);
  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const runs: TextRun[] = [];
    let text = '';
    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const item = raw as TextItem;
      if (item.str) {
        runs.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || Math.abs(item.transform[3]),
          start: text.length,
        });
        text += item.str;
      }
      text += item.hasEOL ? '\n' : item.str && !item.str.endsWith(' ') ? ' ' : '';
    }
    layouts.push({ page: n, width: viewport.width, height: viewport.height, text, runs });
  }
  return layouts;
}

export const toPageTexts = (layouts: PageLayout[]): PageText[] =>
  layouts.map((l) => ({ page: l.page, text: l.text.replace(/[ \t]+/g, ' ').trim() }));
