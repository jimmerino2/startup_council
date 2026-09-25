import type { Provider } from "../types.js";
export type { Provider };

/** Why a key can't serve a call right now. */
export type KeyProblem = "rate_limit" | "quota" | "invalid" | "billing";

/** Thrown by a provider call when the API key itself is the problem, so another key can take over. */
export class KeyLimitError extends Error {
  constructor(
    message: string,
    readonly provider: Provider,
    readonly modelId: string,
    readonly problem: KeyProblem,
    readonly retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = "KeyLimitError";
  }
}

export class ModelCallError extends Error {
  constructor(message: string, readonly provider: Provider, readonly modelId: string, readonly cause?: unknown) {
    super(message);
    this.name = "ModelCallError";
  }
}
