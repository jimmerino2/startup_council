export type PersonaKey =
  | "judge"
  | "skeptic"
  | "optimist"
  | "market_analyst"
  | "tech_lead"
  | "vc_investor";

export type RoleKey = PersonaKey | "chairman";

export type Provider = "openrouter" | "gemini" | "mistral" | "groq" | "gonka";

export interface ModelChoice {
  provider: Provider;
  modelId: string;
}

/** A user's saved model overrides and (decrypted, in-memory only) provider API keys. */
export interface UserModelSettings {
  models: Partial<Record<RoleKey, ModelChoice>>;
  openrouterApiKey?: string;
  geminiApiKey?: string;
  mistralApiKey?: string;
  groqApiKey?: string;
  gonkaApiKey?: string;
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
