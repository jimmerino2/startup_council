import { callOpenRouter } from "./openrouter.js";
import { callGemini } from "./gemini.js";
import { callOpenAICompatible, GONKA, GROQ, MISTRAL } from "./openaiCompatible.js";
import { withKeyRotation } from "./keyRotation.js";
import { ModelCallError, type Provider } from "./modelError.js";
import type { EvidenceSource, KeyEntry, KeyEvents } from "../types.js";

export interface ModelTarget {
  provider: Provider;
  modelId: string;
  /** Every key saved for the provider; calls alternate between the usable ones. */
  keys: KeyEntry[];
  keyEvents?: KeyEvents;
}

/**
 * Like callModel, but with live web search, returning the citations the provider
 * reported. Only providers whose API supports search grounding are allowed here;
 * anything else is rejected rather than silently answering without searching.
 */
export async function callModelWithSearch(
  target: ModelTarget,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; raw: unknown; sources: EvidenceSource[] }> {
  if (target.provider !== "gemini" && target.provider !== "openrouter") {
    throw new ModelCallError(`${target.provider} does not support web search; the clerk must use OpenRouter or Gemini`, target.provider, target.modelId);
  }
  return withKeyRotation(target, (apiKey, failFast) =>
    target.provider === "gemini"
      ? callGemini(target.modelId, apiKey, systemPrompt, userPrompt, true, failFast)
      : callOpenRouter(target.modelId, apiKey, systemPrompt, userPrompt, true, failFast)
  );
}

export async function callModel(target: ModelTarget, systemPrompt: string, userPrompt: string): Promise<{ text: string; raw: unknown }> {
  return withKeyRotation(target, (apiKey, failFast) => {
    switch (target.provider) {
      case "gemini":
        return callGemini(target.modelId, apiKey, systemPrompt, userPrompt, false, failFast);
      case "mistral":
        return callOpenAICompatible(MISTRAL, target.modelId, apiKey, systemPrompt, userPrompt, failFast);
      case "groq":
        return callOpenAICompatible(GROQ, target.modelId, apiKey, systemPrompt, userPrompt, failFast);
      case "gonka":
        return callOpenAICompatible(GONKA, target.modelId, apiKey, systemPrompt, userPrompt, failFast);
      default:
        return callOpenRouter(target.modelId, apiKey, systemPrompt, userPrompt, false, failFast);
    }
  });
}
