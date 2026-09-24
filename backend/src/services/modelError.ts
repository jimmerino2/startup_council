import type { Provider } from "../types.js";
export type { Provider };

export class ModelCallError extends Error {
  constructor(message: string, readonly provider: Provider, readonly modelId: string, readonly cause?: unknown) {
    super(message);
    this.name = "ModelCallError";
  }
}
