<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { api } from "../lib/api";

type Provider = "openrouter" | "gemini" | "mistral" | "groq" | "gonka";

// Curated, minimal lists rather than fetching a live catalog — OpenRouter's free
// slugs are the same ones used as system defaults in backend/src/config/personas.ts.
const MODELS_BY_PROVIDER: Record<Provider, { value: string; label: string }[]> = {
  openrouter: [
    { value: "nex-agi/nex-n2.5-pro:free", label: "Nex N2.5 Pro (free)" },
    { value: "nex-agi/nex-n2.5-mini:free", label: "Nex N2.5 Mini (free)" },
    { value: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (free)" },
    { value: "dots-studio/dots-3-note-preview:free", label: "Dots 3 Note Preview (free)" },
    { value: "cohere/north-mini-code:free", label: "North Mini Code (free)" },
    { value: "inclusionai/ling-3.0-flash-fin:free", label: "Ling 3.0 Flash Fin (free)" },
  ],
  gemini: [
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  ],
  mistral: [
    { value: "mistral-small-latest", label: "Mistral Small" },
    { value: "mistral-medium-latest", label: "Mistral Medium" },
    { value: "mistral-large-latest", label: "Mistral Large" },
    { value: "open-mistral-nemo", label: "Mistral Nemo" },
  ],
  groq: [
    { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
    { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
    { value: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
  ],
  gonka: [{ value: "zai-org/GLM-5.3-Flash", label: "GLM 5.3 Flash" }],
};

function onProviderChange(roleKey: string) {
  // Switching provider invalidates the previous model id (different catalog) —
  // reset to "use system default" rather than silently keeping a mismatched id.
  models[roleKey].modelId = "";
}

const ROLES: { key: string; label: string }[] = [
  { key: "judge", label: "Judge" },
  { key: "skeptic", label: "Skeptic" },
  { key: "optimist", label: "Optimist" },
  { key: "market_analyst", label: "Market Analyst" },
  { key: "tech_lead", label: "Technical Lead" },
  { key: "vc_investor", label: "VC Investor" },
  { key: "chairman", label: "Chairman" },
];

const models = reactive<Record<string, { provider: Provider; modelId: string }>>({});
const openrouterApiKey = ref("");
const geminiApiKey = ref("");
const mistralApiKey = ref("");
const groqApiKey = ref("");
const gonkaApiKey = ref("");
const hasOpenRouterKey = ref(false);
const hasGeminiKey = ref(false);
const hasMistralKey = ref(false);
const hasGroqKey = ref(false);
const hasGonkaKey = ref(false);

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);

for (const role of ROLES) {
  models[role.key] = { provider: "openrouter", modelId: "" };
}

onMounted(async () => {
  try {
    const settings = await api.getSettings();
    for (const role of ROLES) {
      const existing = settings.models[role.key];
      if (existing) models[role.key] = { provider: existing.provider, modelId: existing.modelId };
    }
    hasOpenRouterKey.value = settings.hasOpenRouterKey;
    hasGeminiKey.value = settings.hasGeminiKey;
    hasMistralKey.value = settings.hasMistralKey;
    hasGroqKey.value = settings.hasGroqKey;
    hasGonkaKey.value = settings.hasGonkaKey;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
});

async function save() {
  saving.value = true;
  error.value = null;
  saved.value = false;
  try {
    // Save the provider choice even when the model is left at "system default"
    // (empty modelId) — the backend resolves that to the chosen provider's own
    // default, so the provider pick isn't silently discarded.
    const modelsToSave: Record<string, { provider: Provider; modelId: string }> = {};
    for (const role of ROLES) {
      const choice = models[role.key];
      modelsToSave[role.key] = { provider: choice.provider, modelId: choice.modelId.trim() };
    }

    const payload: Parameters<typeof api.saveSettings>[0] = { models: modelsToSave };
    // Only send a key field if the user typed something into it, so leaving it
    // blank doesn't wipe an already-saved key.
    if (openrouterApiKey.value) payload.openrouterApiKey = openrouterApiKey.value;
    if (geminiApiKey.value) payload.geminiApiKey = geminiApiKey.value;
    if (mistralApiKey.value) payload.mistralApiKey = mistralApiKey.value;
    if (groqApiKey.value) payload.groqApiKey = groqApiKey.value;
    if (gonkaApiKey.value) payload.gonkaApiKey = gonkaApiKey.value;

    await api.saveSettings(payload);
    if (openrouterApiKey.value) hasOpenRouterKey.value = true;
    if (geminiApiKey.value) hasGeminiKey.value = true;
    if (mistralApiKey.value) hasMistralKey.value = true;
    if (groqApiKey.value) hasGroqKey.value = true;
    if (gonkaApiKey.value) hasGonkaKey.value = true;
    openrouterApiKey.value = "";
    geminiApiKey.value = "";
    mistralApiKey.value = "";
    groqApiKey.value = "";
    gonkaApiKey.value = "";
    saved.value = true;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <h2>Model settings</h2>
    <p class="muted">
      Choose a provider and model per council role. Leave a role blank to use the system default.
    </p>

    <div v-if="loading" class="muted">Loading…</div>
    <form v-else @submit.prevent="save">
      <div class="card">
        <h3>API keys</h3>
        <div class="field">
          <label for="openrouter-key">OpenRouter API key</label>
          <input
            id="openrouter-key"
            v-model="openrouterApiKey"
            type="password"
            :placeholder="hasOpenRouterKey ? '••••••••••••••••' : 'sk-or-...'"
          />
        </div>
        <div class="field">
          <label for="gemini-key">Gemini API key</label>
          <input
            id="gemini-key"
            v-model="geminiApiKey"
            type="password"
            :placeholder="hasGeminiKey ? '••••••••••••••••' : 'AIza...'"
          />
        </div>
        <div class="field">
          <label for="mistral-key">Mistral API key</label>
          <input
            id="mistral-key"
            v-model="mistralApiKey"
            type="password"
            :placeholder="hasMistralKey ? '••••••••••••••••' : 'Mistral API key'"
          />
        </div>
        <div class="field">
          <label for="groq-key">Groq API key</label>
          <input
            id="groq-key"
            v-model="groqApiKey"
            type="password"
            :placeholder="hasGroqKey ? '••••••••••••••••' : 'gsk_...'"
          />
        </div>
        <div class="field">
          <label for="gonka-key">Gonkarouter API key</label>
          <input
            id="gonka-key"
            v-model="gonkaApiKey"
            type="password"
            :placeholder="hasGonkaKey ? '••••••••••••••••' : 'sk-...'"
          />
        </div>
      </div>

      <div class="card">
        <h3>Models per role</h3>
        <div v-for="role in ROLES" :key="role.key" class="role-row">
          <span>{{ role.label }}</span>
          <select v-model="models[role.key].provider" @change="onProviderChange(role.key)">
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Gemini</option>
            <option value="mistral">Mistral</option>
            <option value="groq">Groq</option>
            <option value="gonka">Gonkarouter</option>
          </select>
          <select v-model="models[role.key].modelId">
            <option value="">Use system default</option>
            <option v-for="opt in MODELS_BY_PROVIDER[models[role.key].provider]" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <button class="btn" type="submit" :disabled="saving">{{ saving ? "Saving…" : "Save settings" }}</button>
      <span v-if="saved" class="muted"> Saved.</span>
      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
  </div>
</template>
