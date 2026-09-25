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
  { key: "vc_investor", label: "Reality Checker" },
  { key: "chairman", label: "Chairman" },
];

// The clerk retrieves evidence through live web search, so it can only use providers whose API offers it.
const CLERK = { key: "clerk", label: "Evidence clerk" };
const CLERK_PROVIDERS: Provider[] = ["openrouter", "gemini"];
const ALL_ROLES = [...ROLES, CLERK];
const MAX_EVIDENCE_LIMIT = 5;
const maxEvidencePerPersona = ref(1);
const extractEvidence = ref(true);
const peerReviewEvidence = ref<"all" | "own">("all");

const models = reactive<Record<string, { provider: Provider; modelId: string }>>({});
type KeyInfo = Awaited<ReturnType<typeof api.getSettings>>["keys"][number];
const keys = ref<KeyInfo[]>([]);
const PROVIDER_LABELS: Record<Provider, string> = {
  openrouter: "OpenRouter",
  gemini: "Gemini",
  mistral: "Mistral",
  groq: "Groq",
  gonka: "Gonkarouter",
};
const PROVIDER_LIST = Object.keys(PROVIDER_LABELS) as Provider[];
const newKey = reactive<Record<Provider, { name: string; apiKey: string }>>({
  openrouter: { name: "", apiKey: "" },
  gemini: { name: "", apiKey: "" },
  mistral: { name: "", apiKey: "" },
  groq: { name: "", apiKey: "" },
  gonka: { name: "", apiKey: "" },
});
const keyBusy = ref<string | null>(null);
const keyError = ref<string | null>(null);

const keysFor = (provider: Provider) => keys.value.filter((k) => k.provider === provider);

/** A limited key whose time has passed is usable again, even before a real call formally clears it. */
function keyState(k: KeyInfo): "active" | "limited" | "disabled" {
  if (k.status === "disabled") return "disabled";
  if (k.limitedUntil && Date.parse(k.limitedUntil) > Date.now()) return "limited";
  return "active";
}

/** True once a limit has passed but the key hasn't been called again yet, so the server row still says "limited". */
function recentlyLimited(k: KeyInfo): boolean {
  return k.status === "limited" && keyState(k) === "active";
}

const formatWhen = (iso: string) => new Date(iso).toLocaleString();

async function reloadKeys() {
  keys.value = (await api.getSettings()).keys;
}

async function keyAction(id: string, action: () => Promise<unknown>) {
  keyBusy.value = id;
  keyError.value = null;
  try {
    await action();
    await reloadKeys();
  } catch (err) {
    keyError.value = (err as Error).message;
  } finally {
    keyBusy.value = null;
  }
}

async function addKey(provider: Provider) {
  const { name, apiKey } = newKey[provider];
  if (!name.trim() || !apiKey.trim()) {
    keyError.value = "Give the key a name and paste the key.";
    return;
  }
  await keyAction(`add:${provider}`, async () => {
    await api.addKey({ provider, name: name.trim(), apiKey: apiKey.trim() });
    newKey[provider] = { name: "", apiKey: "" };
  });
}

const toggleKey = (k: KeyInfo) => keyAction(k.id, () => api.updateKey(k.id, { disabled: keyState(k) !== "disabled" }));
const removeKey = (k: KeyInfo) => {
  if (window.confirm(`Delete the key "${k.name}"?`)) return keyAction(k.id, () => api.deleteKey(k.id));
};

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);

for (const role of ALL_ROLES) {
  models[role.key] = { provider: "openrouter", modelId: "" };
}

onMounted(async () => {
  try {
    const settings = await api.getSettings();
    for (const role of ALL_ROLES) {
      const existing = settings.models[role.key];
      if (existing) models[role.key] = { provider: existing.provider, modelId: existing.modelId };
    }
    maxEvidencePerPersona.value = settings.maxEvidencePerPersona;
    peerReviewEvidence.value = settings.peerReviewEvidence;
    extractEvidence.value = settings.extractEvidence;
    keys.value = settings.keys;
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
    for (const role of ALL_ROLES) {
      const choice = models[role.key];
      modelsToSave[role.key] = { provider: choice.provider, modelId: choice.modelId.trim() };
    }

    const payload: Parameters<typeof api.saveSettings>[0] = {
      models: modelsToSave,
      peerReviewEvidence: peerReviewEvidence.value,
      extractEvidence: extractEvidence.value,
      maxEvidencePerPersona: Math.max(0, Math.min(MAX_EVIDENCE_LIMIT, Math.trunc(Number(maxEvidencePerPersona.value) || 0))),
    };
    await api.saveSettings(payload);
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
        <h3>
          API keys
          <button type="button" class="btn btn-secondary" :disabled="keyBusy === 'reactivate'" @click="keyAction('reactivate', () => api.activateAllKeys())">
            {{ keyBusy === "reactivate" ? "Reactivating…" : "Reactivate all keys" }}
          </button>
        </h3>
        <p class="muted">
          Add as many keys as you like per provider. Calls alternate between the usable keys, and a key that hits a rate limit,
          quota or billing problem is set aside until it recovers, so the others keep working. Keys are stored encrypted and
          changes here apply immediately. This page doesn't auto-update while judging runs elsewhere, so reopen it to see the
          latest status, or use "Reactivate all keys" after fixing a rate limit or billing issue to clear every key back to active
          without waiting.
        </p>
        <p v-if="keyError" class="error-text">{{ keyError }}</p>

        <div v-for="provider in PROVIDER_LIST" :key="provider" style="margin-top: 1rem">
          <strong>{{ PROVIDER_LABELS[provider] }}</strong>
          <p v-if="keysFor(provider).length === 0" class="muted" style="margin: 0.25rem 0">No keys yet.</p>

          <div v-for="k in keysFor(provider)" :key="k.id" class="role-row" style="align-items: flex-start">
            <span>
              {{ k.name }}
              <span class="muted">{{ k.hint ? `····${k.hint}` : "saved" }}</span>
            </span>
            <span>
              <span class="status-badge">
                {{ keyState(k) === "limited" && k.limitedUntil ? `limited until ${formatWhen(k.limitedUntil)}` : keyState(k) }}
              </span>
              <span v-if="recentlyLimited(k)" class="muted" style="display: block; font-size: 0.85em">
                Recovered — was limited until {{ k.limitedUntil ? formatWhen(k.limitedUntil) : "recently" }}. Stays until this key is used successfully again.
              </span>
              <span v-if="k.lastError" class="muted" style="display: block; font-size: 0.85em">{{ k.lastError }}</span>
            </span>
            <span>
              <button type="button" class="btn btn-secondary" :disabled="keyBusy === k.id" @click="toggleKey(k)">
                {{ keyState(k) === "disabled" ? "Enable" : "Disable" }}
              </button>
              <button type="button" class="btn btn-secondary" :disabled="keyBusy === k.id" @click="removeKey(k)">Delete</button>
            </span>
          </div>

          <div class="role-row">
            <input v-model="newKey[provider].name" type="text" placeholder="Key name (e.g. Personal)" maxlength="40" @keydown.enter.prevent="addKey(provider)" />
            <input v-model="newKey[provider].apiKey" type="password" placeholder="API key" autocomplete="off" @keydown.enter.prevent="addKey(provider)" />
            <button type="button" class="btn btn-secondary" :disabled="keyBusy === `add:${provider}`" @click="addKey(provider)">
              {{ keyBusy === `add:${provider}` ? "Adding…" : "Add key" }}
            </button>
          </div>
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

      <div class="card">
        <h3>Evidence</h3>
        <p class="muted">
          Before giving a verdict, each council member can ask the clerk to find public documents or data (market reports,
          competitor financials, regulations…). The clerk searches the web and every persona argues from what it retrieved.
        </p>
        <div class="role-row">
          <span>{{ CLERK.label }}</span>
          <select v-model="models[CLERK.key].provider" @change="onProviderChange(CLERK.key)">
            <option v-if="CLERK_PROVIDERS.includes('openrouter')" value="openrouter">OpenRouter (web search)</option>
            <option v-if="CLERK_PROVIDERS.includes('gemini')" value="gemini">Gemini (Google Search)</option>
          </select>
          <select v-model="models[CLERK.key].modelId">
            <option value="">Use system default</option>
            <option v-for="opt in MODELS_BY_PROVIDER[models[CLERK.key].provider]" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <p class="muted">
          Only providers with built-in web search can be the clerk. OpenRouter's web search uses your OpenRouter credits.
        </p>
        <div class="field">
          <label for="max-evidence">Evidence requests per persona (0–{{ MAX_EVIDENCE_LIMIT }})</label>
          <input id="max-evidence" v-model.number="maxEvidencePerPersona" type="number" min="0" :max="MAX_EVIDENCE_LIMIT" step="1" />
          <p class="muted">Set to 0 to skip evidence gathering. Each request is one search call plus downloads and one extraction call.</p>
        </div>
        <div class="field">
          <label>
            <input v-model="extractEvidence" type="checkbox" />
            Read the downloaded documents (a second clerk call per request)
          </label>
          <p class="muted">
            Turn this off to save calls: the clerk's search summary is used as-is and nothing is downloaded. It is faster and
            cheaper, but the evidence is the model's own summary, not facts pulled from the page.
          </p>
        </div>
        <div class="field">
          <label for="review-evidence">Evidence visible during peer review</label>
          <select id="review-evidence" v-model="peerReviewEvidence">
            <option value="all">Everyone sees all evidence (best, larger prompts)</option>
            <option value="own">Each reviewer sees only the evidence they requested (cheaper)</option>
          </select>
          <p class="muted">Choose the cheaper option if your free models time out or truncate during peer review.</p>
        </div>
      </div>

      <button class="btn" type="submit" :disabled="saving">{{ saving ? "Saving…" : "Save settings" }}</button>
      <span v-if="saved" class="muted"> Saved.</span>
      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
  </div>
</template>
