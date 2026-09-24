import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { encryptSecret } from "../services/crypto.js";
import { PERSONAS } from "../config/personas.js";
import type { ModelChoice, Provider, RoleKey } from "../types.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

const ROLE_KEYS: RoleKey[] = [...PERSONAS.map((p) => p.key), "chairman"];
const PROVIDERS: Provider[] = ["openrouter", "gemini", "mistral", "groq", "gonka"];

interface SettingsRow {
  models: Partial<Record<RoleKey, ModelChoice>>;
  openrouter_api_key_encrypted: string | null;
  gemini_api_key_encrypted: string | null;
  mistral_api_key_encrypted: string | null;
  groq_api_key_encrypted: string | null;
  gonka_api_key_encrypted: string | null;
}

function isValidModels(value: unknown): value is Partial<Record<RoleKey, ModelChoice>> {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(([role, choice]) => {
    if (!ROLE_KEYS.includes(role as RoleKey)) return false;
    if (typeof choice !== "object" || choice === null) return false;
    const c = choice as Record<string, unknown>;
    // modelId may be "" — that means "use this provider's system default" (resolved in personas.ts).
    return PROVIDERS.includes(c.provider as Provider) && typeof c.modelId === "string";
  });
}

settingsRouter.get("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { data, error } = await supabase
    .from("user_model_settings")
    .select("models, openrouter_api_key_encrypted, gemini_api_key_encrypted, mistral_api_key_encrypted, groq_api_key_encrypted, gonka_api_key_encrypted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  const row = data as SettingsRow | null;
  res.json({
    models: row?.models ?? {},
    hasOpenRouterKey: !!row?.openrouter_api_key_encrypted,
    hasGeminiKey: !!row?.gemini_api_key_encrypted,
    hasMistralKey: !!row?.mistral_api_key_encrypted,
    hasGroqKey: !!row?.groq_api_key_encrypted,
    hasGonkaKey: !!row?.gonka_api_key_encrypted,
  });
});

settingsRouter.put("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { models, openrouterApiKey, geminiApiKey, mistralApiKey, groqApiKey, gonkaApiKey } = req.body ?? {};

  if (models !== undefined && !isValidModels(models)) {
    return res.status(400).json({ error: "models must map role keys to { provider, modelId }" });
  }

  const update: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  if (models !== undefined) update.models = models;
  // A non-empty string sets/replaces the key; an explicit empty string clears it.
  // `undefined` (field omitted) leaves the stored key untouched.
  if (typeof openrouterApiKey === "string") {
    update.openrouter_api_key_encrypted = openrouterApiKey.trim() ? encryptSecret(openrouterApiKey.trim()) : null;
  }
  if (typeof geminiApiKey === "string") {
    update.gemini_api_key_encrypted = geminiApiKey.trim() ? encryptSecret(geminiApiKey.trim()) : null;
  }

  if (typeof mistralApiKey === "string") {
    update.mistral_api_key_encrypted = mistralApiKey.trim() ? encryptSecret(mistralApiKey.trim()) : null;
  }

  if (typeof groqApiKey === "string") {
    update.groq_api_key_encrypted = groqApiKey.trim() ? encryptSecret(groqApiKey.trim()) : null;
  }

  if (typeof gonkaApiKey === "string") {
    update.gonka_api_key_encrypted = gonkaApiKey.trim() ? encryptSecret(gonkaApiKey.trim()) : null;
  }

  const { error } = await supabase.from("user_model_settings").upsert(update, { onConflict: "user_id" });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});
