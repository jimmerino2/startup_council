import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { encryptSecret } from "../services/crypto.js";
import { CLERK_PROVIDERS, DEFAULT_MAX_EVIDENCE, MAX_EVIDENCE_LIMIT, PERSONAS } from "../config/personas.js";
import type { ModelChoice, Provider, RoleKey } from "../types.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

const ROLE_KEYS: RoleKey[] = [...PERSONAS.map((p) => p.key), "chairman", "clerk"];
const PROVIDERS: Provider[] = ["openrouter", "gemini", "mistral", "groq", "gonka"];
const MAX_KEYS_PER_PROVIDER = 10;

interface SettingsRow {
  models: Partial<Record<RoleKey, ModelChoice>>;
  max_evidence_per_persona: number | null;
  peer_review_evidence: string | null;
  extract_evidence: boolean | null;
}

function isValidModels(value: unknown): value is Partial<Record<RoleKey, ModelChoice>> {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(([role, choice]) => {
    if (!ROLE_KEYS.includes(role as RoleKey)) return false;
    if (typeof choice !== "object" || choice === null) return false;
    const c = choice as Record<string, unknown>;
    // modelId may be "" — that means "use this provider's system default" (resolved in personas.ts).
    if (!PROVIDERS.includes(c.provider as Provider) || typeof c.modelId !== "string") return false;
    // The clerk retrieves evidence via live web search, so only providers that offer it are allowed.
    if (role === "clerk" && !CLERK_PROVIDERS.includes(c.provider as Provider)) return false;
    return true;
  });
}

const cleanName = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 40) : "");

settingsRouter.get("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const [settingsRes, keysRes] = await Promise.all([
    supabase.from("user_model_settings").select("models, max_evidence_per_persona, peer_review_evidence, extract_evidence").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("provider_api_keys")
      .select("id, provider, name, key_hint, status, limited_until, last_error")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  if (settingsRes.error) return res.status(500).json({ error: settingsRes.error.message });
  if (keysRes.error) return res.status(500).json({ error: keysRes.error.message });

  const row = settingsRes.data as SettingsRow | null;
  res.json({
    models: row?.models ?? {},
    maxEvidencePerPersona: row?.max_evidence_per_persona ?? DEFAULT_MAX_EVIDENCE,
    peerReviewEvidence: row?.peer_review_evidence === "own" ? "own" : "all",
    extractEvidence: row?.extract_evidence !== false,
    // Never includes the secret itself, only enough to tell keys apart.
    keys: (keysRes.data ?? []).map((k) => ({
      id: k.id,
      provider: k.provider,
      name: k.name,
      hint: k.key_hint,
      status: k.status,
      limitedUntil: k.limited_until,
      lastError: k.last_error,
    })),
  });
});

settingsRouter.put("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { models, maxEvidencePerPersona, peerReviewEvidence, extractEvidence } = req.body ?? {};

  if (models !== undefined && !isValidModels(models)) {
    return res.status(400).json({ error: "models must map role keys to { provider, modelId }" });
  }
  if (
    maxEvidencePerPersona !== undefined &&
    (!Number.isInteger(maxEvidencePerPersona) || maxEvidencePerPersona < 0 || maxEvidencePerPersona > MAX_EVIDENCE_LIMIT)
  ) {
    return res.status(400).json({ error: `maxEvidencePerPersona must be an integer from 0 to ${MAX_EVIDENCE_LIMIT}` });
  }
  if (peerReviewEvidence !== undefined && peerReviewEvidence !== "all" && peerReviewEvidence !== "own") {
    return res.status(400).json({ error: "peerReviewEvidence must be 'all' or 'own'" });
  }
  if (extractEvidence !== undefined && typeof extractEvidence !== "boolean") {
    return res.status(400).json({ error: "extractEvidence must be a boolean" });
  }

  const update: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (models !== undefined) update.models = models;
  if (maxEvidencePerPersona !== undefined) update.max_evidence_per_persona = maxEvidencePerPersona;
  if (peerReviewEvidence !== undefined) update.peer_review_evidence = peerReviewEvidence;
  if (extractEvidence !== undefined) update.extract_evidence = extractEvidence;

  const { error } = await supabase.from("user_model_settings").upsert(update, { onConflict: "user_id" });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

/** Adds an API key. Calls to that provider alternate between all of its usable keys. */
settingsRouter.post("/keys", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { provider, name, apiKey } = req.body ?? {};

  if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "Unknown provider" });
  const keyName = cleanName(name);
  if (!keyName) return res.status(400).json({ error: "A key name is required" });
  if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 500) return res.status(400).json({ error: "An API key is required" });

  const { count } = await supabase.from("provider_api_keys").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("provider", provider);
  if ((count ?? 0) >= MAX_KEYS_PER_PROVIDER) {
    return res.status(409).json({ error: `At most ${MAX_KEYS_PER_PROVIDER} keys per provider` });
  }

  const secret = apiKey.trim();
  const { data, error } = await supabase
    .from("provider_api_keys")
    .insert({ user_id: user.id, provider, name: keyName, key_encrypted: encryptSecret(secret), key_hint: secret.slice(-4) })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({ id: data.id });
});

/** Renames a key, enables/disables it, or replaces its secret (which also clears any limit). */
settingsRouter.patch("/keys/:id", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { name, disabled, apiKey } = req.body ?? {};

  const update: Record<string, unknown> = {};
  if (name !== undefined) {
    const keyName = cleanName(name);
    if (!keyName) return res.status(400).json({ error: "A key name is required" });
    update.name = keyName;
  }
  if (disabled !== undefined) {
    if (typeof disabled !== "boolean") return res.status(400).json({ error: "disabled must be a boolean" });
    update.status = disabled ? "disabled" : "active";
    if (!disabled) Object.assign(update, { limited_until: null, last_error: null });
  }
  if (apiKey !== undefined) {
    if (typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 500) return res.status(400).json({ error: "An API key is required" });
    const secret = apiKey.trim();
    Object.assign(update, { key_encrypted: encryptSecret(secret), key_hint: secret.slice(-4), status: "active", limited_until: null, last_error: null });
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const { data, error } = await supabase.from("provider_api_keys").update(update).eq("id", req.params.id).select("id");
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "Key not found" });
  res.json({ ok: true });
});

/** Clears every key back to active — for after fixing a billing issue, or just to retry everything. */
settingsRouter.post("/keys/activate-all", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { error } = await supabase
    .from("provider_api_keys")
    .update({ status: "active", limited_until: null, last_error: null })
    .eq("user_id", user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

settingsRouter.delete("/keys/:id", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { data, error } = await supabase.from("provider_api_keys").delete().eq("id", req.params.id).select("id");
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "Key not found" });
  res.json({ ok: true });
});
