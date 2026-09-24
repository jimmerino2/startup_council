export type PersonaKey =
  | "judge"
  | "skeptic"
  | "optimist"
  | "market_analyst"
  | "tech_lead"
  | "vc_investor";

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
