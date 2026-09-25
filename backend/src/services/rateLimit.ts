// A tiny in-process limiter shared by every call to the same provider key. A council step fires many
// calls at once, and free tiers limit requests per minute, so calls are spaced out and, after a 429,
// the whole key is paused for as long as the API asks. It is per server instance, which is enough:
// each step runs inside a single function invocation.

const nextFreeAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Identifies a provider account without keeping the secret itself. */
export function limiterKey(provider: string, apiKey: string): string {
  return `${provider}:${apiKey.slice(-6)}`;
}

/** Waits for this key's next free slot, then reserves the one after it. */
export async function waitForSlot(key: string, minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const start = Math.max(now, nextFreeAt.get(key) ?? 0);
  nextFreeAt.set(key, start + minIntervalMs);
  if (start > now) await sleep(start - now);
}

/** Pauses every caller on this key for `ms` (e.g. after a 429). */
export function pauseFor(key: string, ms: number): void {
  nextFreeAt.set(key, Math.max(nextFreeAt.get(key) ?? 0, Date.now() + ms));
}

/** How long the API asked us to wait: the Retry-After header, or Gemini's "retry in 3.2s" text. */
export function retryHintMs(res: Response, body: string): number | null {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.ceil(header * 1000);
  const match = body.match(/retry in ([\d.]+)\s*s/i) ?? body.match(/"retryDelay":\s*"([\d.]+)s"/i);
  return match ? Math.ceil(Number(match[1]) * 1000) : null;
}
