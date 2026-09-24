import type { PersonaKey, Provider, UserModelSettings } from "../types.js";
import type { ModelTarget } from "../services/modelRouter.js";

interface ProviderDefault {
  defaultModel: string;
}

interface PersonaConfig {
  key: PersonaKey;
  label: string;
  defaults: Record<Provider, ProviderDefault>;
  systemPrompt: string;
}

const RESPONSE_FORMAT_INSTRUCTIONS = `Respond with ONLY a JSON object (no markdown fences, no prose outside the JSON) matching exactly this shape:
{
  "verdict": "2-4 sentence written assessment",
  "score": <number 0-10>,
  "strengths": ["short bullet", "short bullet"],
  "concerns": ["short bullet", "short bullet"]
}`;

export const PERSONAS: PersonaConfig[] = [
  {
    key: "judge",
    label: "Judge",
    defaults: {
      openrouter: { defaultModel: "nex-agi/nex-n2.5-pro:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the neutral Judge on a startup/hackathon idea review council. Score the submission strictly against the judging criteria the user provides, criterion by criterion, then give an overall score. Be fair and rubric-driven, not swayed by enthusiasm or pessimism. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    key: "skeptic",
    label: "Skeptic",
    defaults: {
      openrouter: { defaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the Skeptic on a startup/hackathon idea review council. Actively look for reasons this idea fails: weak assumptions, market risk, execution risk, competitive threats. Be direct and critical, but fair and specific, not needlessly cruel. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    key: "optimist",
    label: "Optimist",
    defaults: {
      openrouter: { defaultModel: "dots-studio/dots-3-note-preview:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the Optimist on a startup/hackathon idea review council. Make the strongest honest case for why this idea could succeed big: the upside scenario, unlocks, and reasons momentum could compound. Stay grounded in the submission, don't invent facts not implied by it. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    key: "market_analyst",
    label: "Market Analyst",
    defaults: {
      openrouter: { defaultModel: "nex-agi/nex-n2.5-mini:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the Market Analyst on a startup/hackathon idea review council. Assess market size, competitive landscape, differentiation, and go-to-market plausibility. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    key: "tech_lead",
    label: "Technical Feasibility Lead",
    defaults: {
      openrouter: { defaultModel: "cohere/north-mini-code:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the Technical Feasibility Lead on a startup/hackathon idea review council. Assess whether this is buildable: technical complexity, dependencies, scalability risk, and whether the scope fits the team/timeframe implied by the submission. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
  {
    key: "vc_investor",
    label: "VC Investor",
    defaults: {
      openrouter: { defaultModel: "inclusionai/ling-3.0-flash-fin:free" },
      gemini: { defaultModel: "gemini-3.5-flash-lite" },
      mistral: { defaultModel: "mistral-small-latest" },
      groq: { defaultModel: "openai/gpt-oss-20b" },
      gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
    },
    systemPrompt: `You are the VC Investor on a startup/hackathon idea review council. Assess fundability: business model, unit economics plausibility, team/founder signal if present, and whether you personally would invest and why. ${RESPONSE_FORMAT_INSTRUCTIONS}`,
  },
];

export const CHAIRMAN_DEFAULTS: Record<Provider, ProviderDefault> = {
  openrouter: { defaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free" },
  gemini: { defaultModel: "gemini-3.5-flash-lite" },
  mistral: { defaultModel: "mistral-small-latest" },
  groq: { defaultModel: "openai/gpt-oss-20b" },
  gonka: { defaultModel: "zai-org/GLM-5.3-Flash" },
};

// Unlike personas (where a quorum tolerates one flaking), the chairman is a single
// required call with no redundancy — so if it fails after retries, we fall back to
// trying these OpenRouter models in order rather than failing the whole judging run.
export const CHAIRMAN_FALLBACK_MODELS = ["nex-agi/nex-n2.5-mini:free", "cohere/north-mini-code:free"];

export const CHAIRMAN_SYSTEM_PROMPT = `You are the Chairman of a startup/hackathon idea review council. You have received independent written verdicts from six council members: Judge, Skeptic, Optimist, Market Analyst, Technical Feasibility Lead, and VC Investor, followed by an anonymous peer-review round in which each member critiqued and ranked the others. Synthesize everything into one final decision. Give weight to which verdicts the peers ranked highest and to their critiques, not just the raw scores. Weigh the Judge's rubric-based score most heavily, but factor in the risks the Skeptic raised and the upside the Optimist raised. Respond with ONLY a JSON object (no markdown fences, no prose outside the JSON) matching exactly this shape:
{
  "finalVerdict": "3-6 sentence synthesis explaining the decision",
  "overallScore": <number 0-10>,
  "recommendation": "fund" | "iterate" | "pass"
}`;

function defaultModelFor(provider: Provider, defaults: Record<Provider, ProviderDefault>): string {
  return defaults[provider].defaultModel;
}

function apiKeyFor(provider: Provider, settings: UserModelSettings | undefined): string {
  if (provider === "gemini") return settings?.geminiApiKey || "";
  if (provider === "mistral") return settings?.mistralApiKey || "";
  if (provider === "groq") return settings?.groqApiKey || "";
  if (provider === "gonka") return settings?.gonkaApiKey || "";
  return settings?.openrouterApiKey || "";
}

/**
 * Resolves which provider/model/key to call for a persona. Precedence:
 * 1. The user's saved provider choice for this role, with their chosen model id
 *    or — if left as "system default" — that provider's default model.
 * 2. No saved choice at all: OpenRouter's default for this role.
 * A user override with no matching saved API key is surfaced as a normal
 * persona failure by the caller.
 */
export function resolveModelTarget(config: PersonaConfig, settings: UserModelSettings | undefined): ModelTarget {
  const override = settings?.models[config.key];
  const provider = override?.provider ?? "openrouter";
  const modelId = override?.modelId.trim() || defaultModelFor(provider, config.defaults);
  return { provider, modelId, apiKey: apiKeyFor(provider, settings) };
}

/** Primary chairman target first, then OpenRouter fallbacks, deduplicated by model id. */
export function resolveChairmanModelTargets(settings: UserModelSettings | undefined): ModelTarget[] {
  const override = settings?.models.chairman;
  const provider = override?.provider ?? "openrouter";
  const primary: ModelTarget = {
    provider,
    modelId: override?.modelId.trim() || defaultModelFor(provider, CHAIRMAN_DEFAULTS),
    apiKey: apiKeyFor(provider, settings),
  };

  const fallbacks: ModelTarget[] = CHAIRMAN_FALLBACK_MODELS.filter((m) => m !== primary.modelId).map((modelId) => ({
    provider: "openrouter",
    modelId,
    apiKey: settings?.openrouterApiKey || "",
  }));

  return [primary, ...fallbacks];
}
