export type PersonaKey =
  | "judge"
  | "skeptic"
  | "optimist"
  | "market_analyst"
  | "tech_lead"
  | "vc_investor";

export type RoleKey = PersonaKey | "chairman" | "clerk";

export type Provider = "openrouter" | "gemini" | "mistral" | "groq" | "gonka";

export interface ModelChoice {
  provider: Provider;
  modelId: string;
}

/** One saved API key. `apiKey` is decrypted and only ever held in memory. */
export interface KeyEntry {
  id: string;
  name: string;
  apiKey: string;
  status: "active" | "limited" | "disabled";
  /** Epoch ms until which a limited key is skipped. */
  limitedUntil: number | null;
}

/** Persists key state changes (rate limit hit, key recovered) so other requests see them too. */
export interface KeyEvents {
  onLimited(key: KeyEntry, info: { status: "limited" | "disabled"; until: number | null; reason: string }): Promise<void>;
  onOk(key: KeyEntry): Promise<void>;
}

/** A user's saved model overrides and (decrypted, in-memory only) provider API keys. */
export interface UserModelSettings {
  models: Partial<Record<RoleKey, ModelChoice>>;
  /** All keys per provider; calls alternate between the usable ones. */
  keys: Partial<Record<Provider, KeyEntry[]>>;
  keyEvents?: KeyEvents;
  /** How many evidence requests each persona may file (0 disables the evidence stage). */
  maxEvidencePerPersona?: number;
  /** Whether peer reviewers see all evidence or only what they requested themselves. */
  peerReviewEvidence?: "all" | "own";
  /** Read the downloaded documents with a second clerk call (default true). */
  extractEvidence?: boolean;
}

export interface PersonaVerdict {
  personaKey: PersonaKey;
  modelId: string;
  verdict: string;
  score: number;
  strengths: string[];
  concerns: string[];
  raw: unknown;
}

export interface EvidenceSource {
  url: string;
  title: string;
}

/** What a persona asked the clerk for, and what came back. */
export interface EvidenceItem {
  /** Every persona that asked for this (near-identical requests are merged into one). */
  requestedBy: PersonaKey[];
  description: string;
  /** complete = extracted from downloaded documents; partial = search summary only. */
  status: "complete" | "partial" | "not_found";
  /** The derived, role-relevant information (never the raw document). */
  summary: string | null;
  sources: EvidenceSource[];
}

/** One persona's anonymous peer review of the other personas. */
export interface PersonaReview {
  reviewer: PersonaKey;
  critique: string;
  /** The other personas, best first. */
  ranking: PersonaKey[];
}

export interface ChairmanVerdict {
  modelId: string;
  finalVerdict: string;
  overallScore: number;
  recommendation: "fund" | "iterate" | "pass";
  raw: unknown;
}

export interface SessionInput {
  title: string;
  problemStatement: string;
  judgingCriteria: string;
  pitchText: string;
}
