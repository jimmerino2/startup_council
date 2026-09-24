import { ModelCallError } from "./modelError.js";
import type { Provider } from "../types.js";

interface ProviderConfig {
  name: string;
  provider: Provider;
  url: string;
  /** Minimum gap between request starts, to stay under free-tier per-second limits. */
  minIntervalMs: number;
  /** Send response_format json_object; off where the endpoint may not support it (the prompt still demands JSON). */
  jsonMode: boolean;
}

export const MISTRAL: ProviderConfig = {
  name: "Mistral",
  provider: "mistral",
  url: "https://api.mistral.ai/v1/chat/completions",
  minIntervalMs: 1100,
  jsonMode: true,
};

export const GROQ: ProviderConfig = {
  name: "Groq",
  provider: "groq",
  url: "https://api.groq.com/openai/v1/chat/completions",
  minIntervalMs: 500,
  jsonMode: true,
};

export const GONKA: ProviderConfig = {
  name: "Gonkarouter",
  provider: "gonka",
  url: "https://api.gonkarouter.io/v1/chat/completions",
  minIntervalMs: 500,
  jsonMode: false,
};

interface ChatResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  message?: string;
  error?: { message?: string };
}

// Same retry/timeout budget as the other providers so a council run fits Vercel's 300s limit.
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2000, 5000];
const MAX_RETRY_AFTER_MS = 10000;
const REQUEST_TIMEOUT_MS = 40000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Slots are reserved synchronously, so parallel callers queue up in order
// (per server instance) instead of all hitting the provider at once.
const nextSlotAt = new Map<string, number>();
async function waitForSlot(cfg: ProviderConfig) {
  const now = Date.now();
  const start = Math.max(now, nextSlotAt.get(cfg.provider) ?? 0);
  nextSlotAt.set(cfg.provider, start + cfg.minIntervalMs);
  if (start > now) await sleep(start - now);
}

function errorDetail(body: string): string {
  try {
    const json = JSON.parse(body) as ChatResponse;
    return (json.message ?? json.error?.message)?.trim() || body;
  } catch {
    return body;
  }
}

function retryDelay(res: Response, attempt: number): number {
  const retryAfter = Number(res.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
  return RETRY_DELAYS_MS[attempt];
}

export async function callOpenAICompatible(
  cfg: ProviderConfig,
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; raw: unknown }> {
  let lastFailureMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLastAttempt = attempt === MAX_RETRIES;
    await waitForSlot(cfg);

    let res: Response;
    try {
      res = await fetch(cfg.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 1500,
          ...(cfg.jsonMode ? { response_format: { type: "json_object" } } : {}),
          // gpt-oss models reason before answering; keep it short so the JSON fits in max_tokens.
          ...(modelId.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      lastFailureMessage = isTimeout ? `Timed out after ${REQUEST_TIMEOUT_MS}ms` : `Network error: ${(err as Error).message}`;
      if (isLastAttempt) throw new ModelCallError(`${isTimeout ? "Timed out" : "Network error"} calling ${modelId}`, cfg.provider, modelId, err);
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    if (!res.ok) {
      const detail = errorDetail(await res.text().catch(() => ""));
      lastFailureMessage = `HTTP ${res.status}: ${detail}`;
      if ((res.status === 429 || res.status >= 500) && !isLastAttempt) {
        await sleep(retryDelay(res, attempt));
        continue;
      }
      throw new ModelCallError(`${cfg.name} request failed (${res.status}) for ${modelId}: ${detail}`, cfg.provider, modelId);
    }

    const json = (await res.json()) as ChatResponse;
    const choice = json.choices?.[0];
    const text = choice?.message?.content;
    if (!text) {
      const reason = choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : "";
      lastFailureMessage = `Empty response${reason}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`Empty response from ${modelId}${reason}`, cfg.provider, modelId, json);
    }

    return { text, raw: json };
  }

  throw new ModelCallError(`${cfg.name} request failed for ${modelId}: ${lastFailureMessage}`, cfg.provider, modelId);
}
