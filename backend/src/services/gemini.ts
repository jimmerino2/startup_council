import { KeyLimitError, ModelCallError } from "./modelError.js";
import { limiterKey, pauseFor, retryHintMs, waitForSlot } from "./rateLimit.js";
import type { EvidenceSource } from "../types.js";

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
  }[];
  error?: { message?: string; code?: number };
}

// Mirrors openrouter.ts's retry/timeout budget so a council run fits Vercel's 300s limit.
// Extra attempts are cheap when they are 429s (we wait for the quota window), so allow one more.
const MAX_RETRIES = 3;
// Spacing between call starts on one key, and the longest quota wait worth honouring inside a step.
const MIN_INTERVAL_MS = 1500;
const MAX_QUOTA_WAIT_MS = 30_000;
const DEFAULT_QUOTA_WAIT_MS = 10_000;
const RETRY_DELAYS_MS = [2000, 5000];
const REQUEST_TIMEOUT_MS = 40000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  webSearch = false,
  failFast = false
): Promise<{ text: string; raw: unknown; sources: EvidenceSource[] }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`;

  let lastFailureMessage = "";
  const gate = limiterKey("gemini", apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLastAttempt = attempt === MAX_RETRIES;

    await waitForSlot(gate, MIN_INTERVAL_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          // Google Search grounding: citations come back in groundingMetadata.
          ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1500,
            // Gemini 2.5 models "think" before answering by default, and that
            // reasoning eats into maxOutputTokens same as OpenRouter's reasoning
            // models — with no fallback field to read it back from (unlike
            // OpenRouter's `reasoning`), a thinking-heavy answer comes back
            // empty (finishReason MAX_TOKENS) before any real text is emitted.
            // Disabling thinking keeps the budget for the actual JSON answer.
            // Only the 2.5 line supports thinking at all — 2.0 models reject
            // an unrecognized thinkingConfig field.
            ...(modelId.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      lastFailureMessage = isTimeout ? `Timed out after ${REQUEST_TIMEOUT_MS}ms` : `Network error: ${(err as Error).message}`;
      if (isLastAttempt) throw new ModelCallError(`${isTimeout ? "Timed out" : "Network error"} calling ${modelId}`, "gemini", modelId, err);
      await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body;
      try {
        detail = (JSON.parse(body) as GeminiResponse).error?.message?.trim() || body;
      } catch {
        // Not JSON; keep the raw body.
      }
      lastFailureMessage = `HTTP ${res.status}: ${detail}`;
      if (res.status === 401 || (res.status === 400 && /API key not valid|API_KEY_INVALID/i.test(body))) {
        throw new KeyLimitError(`Gemini rejected the API key (${detail})`, "gemini", modelId, "invalid");
      }
      // Prepaid credits depleted on this project — needs the user to add funds, not a wait.
      if (res.status === 402) {
        throw new KeyLimitError(`Gemini billing: prepaid credits depleted (${detail})`, "gemini", modelId, "billing");
      }
      if (res.status === 429) {
        const wait = retryHintMs(res, body);
        // "exceeded your current quota" / RESOURCE_EXHAUSTED are Google's generic 429 wording and status —
        // they appear on ordinary per-minute rate limits too, so only a literal per-day phrase counts here.
        const daily = /per.?day/i.test(body);
        // A daily cap, a wait longer than a step can afford, or another key being available: hand over
        // to the next key (or fail with the reason) instead of waiting here.
        if (daily || (wait ?? 0) > MAX_QUOTA_WAIT_MS || failFast) {
          throw new KeyLimitError(`Gemini ${daily ? "quota exhausted" : "rate limit"} for ${modelId} (${detail})`, "gemini", modelId, daily ? "quota" : "rate_limit", wait);
        }
        if (!isLastAttempt) {
          // Pause every call on this key, not just this one, then retry in turn.
          pauseFor(gate, wait ?? DEFAULT_QUOTA_WAIT_MS);
          continue;
        }
      }
      if (res.status >= 500 && !isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      throw new ModelCallError(`Gemini request failed (${res.status}) for ${modelId}: ${detail}`, "gemini", modelId);
    }

    const json = (await res.json()) as GeminiResponse;

    if (json.error) {
      lastFailureMessage = `Upstream error (${json.error.code ?? "?"}): ${json.error.message ?? "unknown"}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      throw new ModelCallError(`${modelId} failed: ${lastFailureMessage}`, "gemini", modelId, json);
    }

    const candidate = json.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) {
      const reason = candidate?.finishReason ? ` (finishReason: ${candidate.finishReason})` : "";
      lastFailureMessage = `Empty response${reason}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      throw new ModelCallError(`Empty response from ${modelId}${reason}`, "gemini", modelId, json);
    }

    const sources: EvidenceSource[] = [];
    for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
      const url = chunk.web?.uri;
      if (url && /^https?:\/\//i.test(url) && !sources.some((s) => s.url === url)) {
        sources.push({ url, title: chunk.web?.title?.trim() || url });
      }
    }

    return { text, raw: json, sources };
  }

  throw new ModelCallError(`Gemini request failed for ${modelId}: ${lastFailureMessage}`, "gemini", modelId);
}
