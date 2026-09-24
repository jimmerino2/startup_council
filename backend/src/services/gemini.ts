import { ModelCallError } from "./modelError.js";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string; code?: number };
}

// Mirrors openrouter.ts's retry/timeout budget so a council run fits Vercel's 300s limit.
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [2000, 5000];
const REQUEST_TIMEOUT_MS = 40000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGemini(
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; raw: unknown }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`;

  let lastFailureMessage = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const isLastAttempt = attempt === MAX_RETRIES;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
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
      await sleep(RETRY_DELAYS_MS[attempt]);
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
      if ((res.status === 429 || res.status >= 500) && !isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`Gemini request failed (${res.status}) for ${modelId}: ${detail}`, "gemini", modelId);
    }

    const json = (await res.json()) as GeminiResponse;

    if (json.error) {
      lastFailureMessage = `Upstream error (${json.error.code ?? "?"}): ${json.error.message ?? "unknown"}`;
      if (!isLastAttempt) {
        await sleep(RETRY_DELAYS_MS[attempt]);
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
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new ModelCallError(`Empty response from ${modelId}${reason}`, "gemini", modelId, json);
    }

    return { text, raw: json };
  }

  throw new ModelCallError(`Gemini request failed for ${modelId}: ${lastFailureMessage}`, "gemini", modelId);
}
