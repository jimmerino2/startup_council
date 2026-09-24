import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "./crypto.js";
import type { UserModelSettings } from "../types.js";

/** Loads and decrypts a user's saved model settings; undefined if they haven't set any. */
export async function loadUserModelSettings(supabase: SupabaseClient, userId: string): Promise<UserModelSettings | undefined> {
  const { data, error } = await supabase
    .from("user_model_settings")
    .select("models, openrouter_api_key_encrypted, gemini_api_key_encrypted, mistral_api_key_encrypted, groq_api_key_encrypted, gonka_api_key_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return undefined;

  return {
    models: data.models ?? {},
    openrouterApiKey: data.openrouter_api_key_encrypted ? decryptSecret(data.openrouter_api_key_encrypted) : undefined,
    geminiApiKey: data.gemini_api_key_encrypted ? decryptSecret(data.gemini_api_key_encrypted) : undefined,
    mistralApiKey: data.mistral_api_key_encrypted ? decryptSecret(data.mistral_api_key_encrypted) : undefined,
    groqApiKey: data.groq_api_key_encrypted ? decryptSecret(data.groq_api_key_encrypted) : undefined,
    gonkaApiKey: data.gonka_api_key_encrypted ? decryptSecret(data.gonka_api_key_encrypted) : undefined,
  };
}
