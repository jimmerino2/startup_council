import { KeyLimitError, ModelCallError } from "./modelError.js";
import type { KeyEntry, KeyEvents, Provider } from "../types.js";

export interface KeyedTarget {
  provider: Provider;
  modelId: string;
  keys: KeyEntry[];
  keyEvents?: KeyEvents;
}

// Rotates through a provider's usable keys, so load is spread across them and a key that hits a
// limit is parked until it recovers. The cursor is per server instance, which is enough for spreading.
const cursor = new Map<Provider, number>();
const DEFAULT_RATE_LIMIT_MS = 60_000;
// Small margin so a key isn't retried a hair before its window really reopens.
const LIMIT_MARGIN_MS = 1_000;

function isUsable(key: KeyEntry, now: number): boolean {
  return key.status !== "disabled" && (key.limitedUntil ?? 0) <= now;
}

function nextMidnightIn(timeZone: string, now: number): number {
  const pseudoNow = new Date(new Date(now).toLocaleString("en-US", { timeZone }));
  const offset = pseudoNow.getTime() - now;
  const pseudoMidnight = new Date(pseudoNow);
  pseudoMidnight.setHours(24, 0, 0, 0);
  return pseudoMidnight.getTime() - offset;
}

/** When a daily/credit quota is expected to reset: Gemini resets at midnight Pacific, the others at midnight UTC. */
export function quotaResetAt(provider: Provider, now = Date.now()): number {
  if (provider === "gemini") return nextMidnightIn("America/Los_Angeles", now);
  return (Math.floor(now / 86_400_000) + 1) * 86_400_000;
}

async function persist(action: Promise<void> | undefined) {
  try {
    await action;
  } catch (err) {
    console.error("Could not save API key state:", err instanceof Error ? err.message : err);
  }
}

async function parkKey(target: KeyedTarget, key: KeyEntry, err: KeyLimitError) {
  if (err.problem === "invalid" || err.problem === "billing") {
    // Both need the user to act (fix the key, or add funds) — waiting won't fix either, so disable
    // rather than leave it in rotation to fail again on every call.
    key.status = "disabled";
    key.limitedUntil = null;
    await persist(target.keyEvents?.onLimited(key, { status: "disabled", until: null, reason: err.message }));
    return;
  }
  const until = err.problem === "quota" ? quotaResetAt(target.provider) : Date.now() + (err.retryAfterMs ?? DEFAULT_RATE_LIMIT_MS) + LIMIT_MARGIN_MS;
  key.status = "limited";
  key.limitedUntil = until;
  await persist(target.keyEvents?.onLimited(key, { status: "limited", until, reason: err.message }));
}

function describeKey(key: KeyEntry, now: number): string {
  if (key.status === "disabled") return `${key.name} (disabled)`;
  if ((key.limitedUntil ?? 0) > now) return `${key.name} (limited until ${new Date(key.limitedUntil!).toISOString()})`;
  return `${key.name} (active)`;
}

function noKeyAvailable(target: KeyedTarget, last: KeyLimitError | null, now: number): ModelCallError {
  const parked = target.keys.filter((k) => k.status !== "disabled" && (k.limitedUntil ?? 0) > now);
  const next = parked.length > 0 ? new Date(Math.min(...parked.map((k) => k.limitedUntil ?? 0))).toISOString() : null;
  const perKey = target.keys.map((k) => describeKey(k, now)).join(", ");
  const summary = next
    ? `All ${target.keys.length} ${target.provider} API key(s) are rate-limited or disabled; the next one is available at ${next}. Keys: ${perKey}.`
    : `All ${target.keys.length} ${target.provider} API key(s) are disabled or invalid. Re-enable or add a key in Settings. Keys: ${perKey}.`;
  return new ModelCallError(last ? `${summary} Last error: ${last.message}` : summary, target.provider, target.modelId);
}

/**
 * Runs `run` with one of the provider's usable keys. If that key reports a rate limit, exhausted
 * quota or invalid key, it is parked (persisted, so other requests skip it too) and the next key
 * is tried. `failFast` tells the provider call to give up on a 429 straight away instead of
 * waiting, which is only sensible when another key is available to take over.
 */
export async function withKeyRotation<T>(target: KeyedTarget, run: (apiKey: string, failFast: boolean) => Promise<T>): Promise<T> {
  if (target.keys.length === 0) {
    throw new ModelCallError(`No API key configured for ${target.provider}. Add one in Settings.`, target.provider, target.modelId);
  }

  const tried = new Set<string>();
  let lastLimit: KeyLimitError | null = null;

  for (;;) {
    const now = Date.now();
    const usable = target.keys.filter((k) => isUsable(k, now) && !tried.has(k.id));
    if (usable.length === 0) throw noKeyAvailable(target, lastLimit, now);

    const n = cursor.get(target.provider) ?? 0;
    cursor.set(target.provider, n + 1);
    const key = usable[n % usable.length];

    try {
      const result = await run(key.apiKey, usable.length > 1);
      if (key.status === "limited") {
        key.status = "active";
        key.limitedUntil = null;
        await persist(target.keyEvents?.onOk(key));
      }
      return result;
    } catch (err) {
      if (!(err instanceof KeyLimitError)) {
        // Not classified as a key problem (e.g. this was the only usable key, so the provider call
        // exhausted its own retries) — name the key so a repeated failure is easy to tell apart from
        // "the wrong key was reused" versus "every key independently hit its own limit".
        if (err instanceof ModelCallError) throw new ModelCallError(`[key: ${key.name}] ${err.message}`, err.provider, err.modelId, err.cause);
        throw err;
      }
      lastLimit = err;
      tried.add(key.id);
      console.warn(`${target.provider} key "${key.name}" hit a ${err.problem} (${err.message}); parking it and trying the next key.`);
      await parkKey(target, key, err);
    }
  }
}
