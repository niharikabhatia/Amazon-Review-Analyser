// Mirrors factcheck/models.py

export type Verdict = 'Verified' | 'Inaccurate' | 'False' | 'Error';

export interface PageText {
  page: number;
  text: string;
}

export interface Source {
  title: string;
  url: string;
}

export interface Claim {
  id: number;
  text: string;
  quote: string;
  category: string;
  page: number | null;
  search_query: string;
}

export interface ClaimResult {
  claim_id: number;
  verdict: Verdict;
  correct_fact: string;
  explanation: string;
  evidence_quote: string;
  confidence: number;
  sources: Source[];
  second_opinion: boolean;
  needs_second_opinion?: boolean;
}

export interface Contradiction {
  claim_ids: number[];
  explanation: string;
}

export interface Correction {
  claim_id: number;
  original: string;
  corrected: string;
}

/** Per-claim progress shown while the check runs. */
export type ClaimStatus = 'queued' | 'checking' | 'rechecking' | 'done';

export type Stage = 'idle' | 'reading' | 'extracting' | 'verifying' | 'reviewing' | 'done' | 'error';

export interface Settings {
  apiKey: string;
  model: string;
  maxClaims: number;
}

export interface Health {
  ok: boolean;
  default_model: string;
  models: string[];
  server_key: boolean;
}
