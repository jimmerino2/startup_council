import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "./crypto.js";
import type { KeyEntry, KeyEvents, Provider, UserModelSettings } from "../types.js";

/** Loads a user's model settings and every saved API key (decrypted, in memory only). Undefined if they have neither. */
export async function loadUserModelSettings(supabase: SupabaseClient, userId: string): Promise<UserModelSettings | undefined> {
  const [settingsRes, keysRes] = await Promise.all([
    supabase
      .from("user_model_settings")
      .select("models, max_evidence_per_persona, peer_review_evidence, extract_evidence")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("provider_api_keys").select("id, provider, name, key_encrypted, status, limited_until").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);

  const data = settingsRes.data;
  const keys: Partial<Record<Provider, KeyEntry[]>> = {};
  for (const row of keysRes.data ?? []) {
    let apiKey: string;
    try {
      apiKey = decryptSecret(row.key_encrypted);
    } catch {
      continue; // e.g. the encryption secret changed; that key is unusable
    }
    (keys[row.provider as Provider] ??= []).push({
      id: row.id,
      name: row.name,
      apiKey,
      status: row.status,
      limitedUntil: row.limited_until ? Date.parse(row.limited_until) : null,
    });
  }

  if (!data && Object.keys(keys).length === 0) return undefined;

  // Persist key state so a key parked by one request is skipped by every other request too.
  const keyEvents: KeyEvents = {
    async onLimited(key, { status, until, reason }) {
      await supabase
        .from("provider_api_keys")
        .update({ status, limited_until: until ? new Date(until).toISOString() : null, last_error: reason.slice(0, 500) })
        .eq("id", key.id);
    },
    async onOk(key) {
      await supabase.from("provider_api_keys").update({ status: "active", limited_until: null, last_error: null }).eq("id", key.id);
    },
  };

  return {
    models: data?.models ?? {},
    keys,
    keyEvents,
    maxEvidencePerPersona: data?.max_evidence_per_persona ?? undefined,
    peerReviewEvidence: data?.peer_review_evidence === "own" ? "own" : "all",
    extractEvidence: data?.extract_evidence !== false,
  };
}
