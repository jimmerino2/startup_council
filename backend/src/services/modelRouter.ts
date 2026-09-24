import { callOpenRouter } from "./openrouter.js";
import { callGemini } from "./gemini.js";
import { callOpenAICompatible, GONKA, GROQ, MISTRAL } from "./openaiCompatible.js";
import { ModelCallError, type Provider } from "./modelError.js";

export interface ModelTarget {
  provider: Provider;
  modelId: string;
  apiKey: string;
}

export async function callModel(target: ModelTarget, systemPrompt: string, userPrompt: string): Promise<{ text: string; raw: unknown }> {
  if (!target.apiKey) {
    throw new ModelCallError(`No API key configured for ${target.provider}`, target.provider, target.modelId);
  }

  switch (target.provider) {
    case "gemini":
      return callGemini(target.modelId, target.apiKey, systemPrompt, userPrompt);
    case "mistral":
      return callOpenAICompatible(MISTRAL, target.modelId, target.apiKey, systemPrompt, userPrompt);
    case "groq":
      return callOpenAICompatible(GROQ, target.modelId, target.apiKey, systemPrompt, userPrompt);
    case "gonka":
      return callOpenAICompatible(GONKA, target.modelId, target.apiKey, systemPrompt, userPrompt);
    default:
      return callOpenRouter(target.modelId, target.apiKey, systemPrompt, userPrompt);
  }
}
