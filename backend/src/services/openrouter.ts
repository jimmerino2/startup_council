import { ModelCallError } from "./modelError.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterMessage {
  role: "system" | "user";
  content: string;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string | null; reasoning?: string | null }; finish_reason?: string }[];
  // OpenRouter sometimes proxies an upstream provider failure as HTTP 200
  // with an `error` field instead of `choices` (e.g. provider capacity exhausted).
  error?: { message?: string; code?: number };
}

// Worst case per model: 3 attempts x 40s + 7s of backoff = 127s. Kept small so a
// full council run (personas in parallel, then chairman) fits Vercel's 300s limit.
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2000, 5000];
const REQUEST_TIMEOUT_MS = 40000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; raw: unknown }> {
  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastFailureMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLastAttempt = attempt === MAX_RETRIES;

    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.CORS_ORIGIN || "http://localhost:5173",
          "X-Title": "Startup Council",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature: 0.4,
          // Generous headroom: some free models are "reasoning" models that spend
          // tokens on a separate `reasoning` field before ever emitting `content`,
          // so a tight cap can truncate the actual answer.
          max_tokens: 4000,
        }),
        // Without this, a hung upstream connection can stall a fetch() call for
        // minutes with no error — and we'd retry that multiple times on top.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      lastFailureMessage = isTimeout ? `Timed out after ${REQUEST_TIMEOUT_MS}ms` : `Network error: ${(err as Error).message}`;
      if (isLastAttempt) throw new ModelCallError(`${isTimeout ? "Timed out" : "Network error"} calling ${modelId}`, "openrouter", modelId, err);
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    // OpenRouter's free-tier shared pool rate-limits transiently per model;
    // retrying after a short backoff usually succeeds within a few seconds.
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body;
      try {
        detail = (JSON.parse(body) as OpenRouterResponse).error?.message?.trim() || body;
      } catch {
        // Not JSON; keep the raw body.
      }
      lastFailureMessage = `HTTP ${res.status}: ${detail}`;
      if ((res.status === 429 || res.status >= 500) && !isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`OpenRouter request failed (${res.status}) for ${modelId}: ${detail}`, "openrouter", modelId);
    }

    const json = (await res.json()) as OpenRouterResponse;

    if (json.error) {
      lastFailureMessage = `Upstream error (${json.error.code ?? "?"}): ${json.error.message ?? "unknown"}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`${modelId} failed: ${lastFailureMessage}`, "openrouter", modelId, json);
    }

    const choice = json.choices?.[0];
    // Reasoning models can return the answer in `reasoning` if `content` came back
    // null (e.g. cut short by max_tokens mid-reasoning) — fall back to it.
    const text = choice?.message?.content || choice?.message?.reasoning;
    if (!text) {
      const reason = choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : "";
      lastFailureMessage = `Empty response${reason}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`Empty response from ${modelId}${reason}`, "openrouter", modelId, json);
    }

    return { text, raw: json };
  }

  // Unreachable in practice: the loop always returns or throws on its last attempt.
  throw new ModelCallError(`OpenRouter request failed for ${modelId}: ${lastFailureMessage}`, "openrouter", modelId);
}

/** Finds every top-level brace-balanced `{...}` in a string, ignoring braces inside quoted strings. */
function extractBalancedObjects(str: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        results.push(str.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return results;
}

/**
 * Extracts a JSON object from a model's text response, tolerating markdown fences
 * and stray surrounding prose. Some free models (especially "reasoning" models
 * falling back to their `reasoning` field) think out loud through several draft
 * JSON blocks before restating the real one, so we try candidates *last first*
 * (the final restatement is the intended answer) rather than assuming the first
 * balanced object we see is correct.
 */
export function extractJsonObject<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const sources = fenced ? [fenced[1], text] : [text];

  for (const source of sources) {
    const objects = extractBalancedObjects(source);
    for (let i = objects.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(objects[i]) as T;
      } catch {
        // Try the previous (earlier) candidate object.
      }
    }
  }

  throw new Error(`No valid JSON object found in model response: ${text.slice(0, 300)}`);
}
