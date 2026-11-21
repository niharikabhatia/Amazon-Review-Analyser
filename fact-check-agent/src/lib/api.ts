import type {
  Claim, ClaimResult, Contradiction, Correction, Health, PageText, Settings,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function post<T>(path: string, body: unknown, settings: Settings, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) headers['X-OpenAI-Key'] = settings.apiKey.trim();
  if (settings.model) headers['X-OpenAI-Model'] = settings.model;

  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      if (res.status === 504) detail = 'The check timed out. Please try again.';
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<Health | null> {
  try {
    const res = await fetch('/api/health');
    return res.ok ? ((await res.json()) as Health) : null;
  } catch {
    return null;
  }
}

export const extractClaims = (pages: PageText[], s: Settings, signal?: AbortSignal) =>
  post<{ claims: Claim[] }>('/api/extract', { pages, max_claims: s.maxClaims }, s, signal).then((r) => r.claims);

export const verifyClaim = (claim: Claim, s: Settings, previous?: ClaimResult, signal?: AbortSignal) =>
  post<ClaimResult>('/api/verify', { claim, previous: previous ?? null }, s, signal);

export const findContradictions = (claims: Claim[], s: Settings, signal?: AbortSignal) =>
  post<{ contradictions: Contradiction[] }>('/api/consistency', { claims }, s, signal).then((r) => r.contradictions);

export const correctDocument = (claims: Claim[], results: ClaimResult[], s: Settings, signal?: AbortSignal) =>
  post<{ corrections: Correction[] }>('/api/correct', { claims, results }, s, signal).then((r) => r.corrections);
