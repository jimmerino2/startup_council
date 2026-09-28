<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import { useKeysStore } from "../stores/keys";
import AppIcon, { type IconName } from "../components/AppIcon.vue";
import PersonaAvatar from "../components/PersonaAvatar.vue";

// Obsidian-style settings: a section list on the left, the selected section's rows on the right.
// The open section is kept in the URL (?section=) so a reload or a shared link lands in the same place.
type Section = "keys" | "models" | "evidence";
const SECTIONS: { key: Section; label: string; icon: IconName; blurb: string }[] = [
  { key: "keys", label: "API Keys", icon: "key", blurb: "Your provider keys. Changes apply immediately." },
  { key: "models", label: "Models", icon: "cpu", blurb: "Which provider and model each council role uses." },
  { key: "evidence", label: "Evidence", icon: "evidence", blurb: "How the clerk researches before the verdicts." },
];
const route = useRoute();
const router = useRouter();
const section = ref<Section>(SECTIONS.some((s) => s.key === route.query.section) ? (route.query.section as Section) : "keys");
watch(section, (s) => router.replace({ query: { ...route.query, section: s === "keys" ? undefined : s } }));

type Provider = "openrouter" | "gemini" | "mistral" | "groq" | "gonka";

// Curated, minimal lists rather than fetching a live catalog — OpenRouter's free
// slugs are the same ones used as system defaults in backend/src/config/personas.ts.
const MODELS_BY_PROVIDER: Record<Provider, { value: string; label: string }[]> = {
  openrouter: [
    { value: "z-ai/glm-5.2:free", label: "GLM 5.2 (free)" },
    { value: "qwen/qwen3.8-27b:free", label: "Qwen 3.8 27B (free)" },
    { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)" },
    { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super (free)" },
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

const whenFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const formatWhen = (iso: string) => whenFormat.format(new Date(iso));
const KEY_TONE: Record<string, string> = { active: "success", limited: "warn", disabled: "" };

// Shared "does the user have any key" flag: it gates New Judging and the Home setup guide.
const keyStatus = useKeysStore();
// Set when the first key goes in during this visit, to point the user straight at their first judging.
const firstKeyAdded = ref(false);
watch(
  () => keys.value.length,
  (n) => {
    keyStatus.set(n);
    if (n === 0) firstKeyAdded.value = false;
  },
);

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
  const hadNone = keys.value.length === 0;
  await keyAction(`add:${provider}`, async () => {
    await api.addKey({ provider, name: name.trim(), apiKey: apiKey.trim() });
    newKey[provider] = { name: "", apiKey: "" };
  });
  if (hadNone && keys.value.length > 0) firstKeyAdded.value = true;
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
  <div class="page wide">
    <header class="page-head">
      <p class="eyebrow"><AppIcon name="settings" :size="13" /> Settings</p>
      <h1 class="page-title">Settings</h1>
    </header>

    <p v-if="loading" class="muted">Loading…</p>

    <div v-else class="settings">
      <nav class="settings-nav" aria-label="Settings sections">
        <button
          v-for="s in SECTIONS"
          :key="s.key"
          type="button"
          class="nav-item"
          :class="{ active: section === s.key }"
          :aria-current="section === s.key ? 'page' : undefined"
          @click="section = s.key"
        >
          <AppIcon :name="s.icon" :size="16" />
          {{ s.label }}
        </button>
      </nav>

      <form class="settings-body" @submit.prevent="save">
        <!-- API keys -->
        <section v-if="section === 'keys'" aria-labelledby="sec-keys">
          <header class="sec-head">
            <div>
              <h2 id="sec-keys">API Keys</h2>
              <p>
                Add as many keys as you like per provider. Calls alternate between usable keys, and a key that hits a rate limit, quota or
                billing problem is set aside until it recovers. Keys are stored encrypted.
              </p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="keyBusy === 'reactivate'" @click="keyAction('reactivate', () => api.activateAllKeys())">
              <AppIcon name="retry" :size="13" /> {{ keyBusy === "reactivate" ? "Reactivating…" : "Reactivate All Keys" }}
            </button>
          </header>
          <div v-if="firstKeyAdded" class="callout success" role="status">
            <AppIcon name="check" :size="16" />
            <p>You’re set up. <RouterLink to="/sessions/new">Start your first judging</RouterLink></p>
          </div>
          <div v-else-if="!loading && keys.length === 0" class="callout welcome">
            <AppIcon name="key" :size="16" />
            <p>
              <strong>Add your first key to start judging.</strong> OpenRouter is the easiest start: every role uses it by default, including
              the evidence clerk. Create a key at
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a>, then paste it below.
            </p>
          </div>
          <p class="note">This page doesn’t update itself while judging runs elsewhere. Reopen it for the latest status, or reactivate all keys after fixing a limit or billing issue.</p>
          <div v-if="keyError || error" class="callout danger" role="alert"><p>{{ keyError ?? error }}</p></div>

          <div v-for="provider in PROVIDER_LIST" :key="provider" class="provider">
            <div class="provider-head">
              <strong translate="no">{{ PROVIDER_LABELS[provider] }}</strong>
              <span class="tag num">{{ keysFor(provider).length }} {{ keysFor(provider).length === 1 ? "key" : "keys" }}</span>
            </div>

            <ul v-if="keysFor(provider).length" class="key-list">
              <li v-for="k in keysFor(provider)" :key="k.id" class="key-row">
                <AppIcon name="key" :size="15" class="key-icon" />
                <div class="key-info">
                  <span class="key-name">
                    {{ k.name }}
                    <code class="key-hint" translate="no">{{ k.hint ? `····${k.hint}` : "saved" }}</code>
                  </span>
                  <span v-if="recentlyLimited(k)" class="key-note">
                    Recovered. It was limited until {{ k.limitedUntil ? formatWhen(k.limitedUntil) : "recently" }}; this clears once the key is used successfully again.
                  </span>
                  <span v-if="k.lastError" class="key-note">{{ k.lastError }}</span>
                </div>
                <span :class="['tag', KEY_TONE[keyState(k)]]">
                  {{ keyState(k) === "limited" && k.limitedUntil ? `Limited until ${formatWhen(k.limitedUntil)}` : keyState(k) === "active" ? "Active" : keyState(k) === "limited" ? "Limited" : "Disabled" }}
                </span>
                <span class="key-actions">
                  <button type="button" class="btn btn-ghost btn-sm" :disabled="keyBusy === k.id" @click="toggleKey(k)">
                    {{ keyState(k) === "disabled" ? "Enable" : "Disable" }}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm" :disabled="keyBusy === k.id" :aria-label="`Delete key ${k.name}`" @click="removeKey(k)">Delete</button>
                </span>
              </li>
            </ul>

            <div class="add-key">
              <input
                v-model="newKey[provider].name"
                type="text"
                :name="`${provider}-key-name`"
                autocomplete="off"
                maxlength="40"
                placeholder="Key name, e.g. Personal…"
                :aria-label="`${PROVIDER_LABELS[provider]} key name`"
                @keydown.enter.prevent="addKey(provider)"
              />
              <input
                v-model="newKey[provider].apiKey"
                type="password"
                :name="`${provider}-api-key`"
                autocomplete="off"
                spellcheck="false"
                placeholder="Paste API key…"
                :aria-label="`${PROVIDER_LABELS[provider]} API key`"
                @keydown.enter.prevent="addKey(provider)"
              />
              <button type="button" class="btn btn-secondary btn-sm" :disabled="keyBusy === `add:${provider}`" @click="addKey(provider)">
                <AppIcon name="plus" :size="13" /> {{ keyBusy === `add:${provider}` ? "Adding…" : "Add Key" }}
              </button>
            </div>
          </div>
        </section>

        <!-- Models -->
        <section v-if="section === 'models'" aria-labelledby="sec-models">
          <header class="sec-head">
            <div>
              <h2 id="sec-models">Models</h2>
              <p>Choose a provider and model per council role. Leave the model on “system default” to use the provider’s default.</p>
            </div>
          </header>
          <div class="rows">
            <div v-for="role in ROLES" :key="role.key" class="setting-item">
              <div class="setting-info role-info">
                <PersonaAvatar :persona-key="role.key" :size="30" />
                <span class="setting-name">{{ role.label }}</span>
              </div>
              <div class="setting-control">
                <select v-model="models[role.key].provider" :aria-label="`${role.label} provider`" @change="onProviderChange(role.key)">
                  <option v-for="p in PROVIDER_LIST" :key="p" :value="p">{{ PROVIDER_LABELS[p] }}</option>
                </select>
                <select v-model="models[role.key].modelId" :aria-label="`${role.label} model`" class="model-select">
                  <option value="">Use system default</option>
                  <option v-for="opt in MODELS_BY_PROVIDER[models[role.key].provider]" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <!-- Evidence -->
        <section v-if="section === 'evidence'" aria-labelledby="sec-evidence">
          <header class="sec-head">
            <div>
              <h2 id="sec-evidence">Evidence</h2>
              <p>
                Before giving a verdict, each member can ask the clerk for public documents or data (market reports, competitor financials,
                regulations…). The clerk searches the web, and every member argues from what it retrieved.
              </p>
            </div>
          </header>
          <div class="rows">
            <div class="setting-item">
              <div class="setting-info">
                <span class="setting-name">{{ CLERK.label }}</span>
                <span class="setting-desc">Only providers with built-in web search can be the clerk. OpenRouter’s web search uses your OpenRouter credits.</span>
              </div>
              <div class="setting-control">
                <select v-model="models[CLERK.key].provider" aria-label="Clerk provider" @change="onProviderChange(CLERK.key)">
                  <option v-if="CLERK_PROVIDERS.includes('openrouter')" value="openrouter">OpenRouter (web search)</option>
                  <option v-if="CLERK_PROVIDERS.includes('gemini')" value="gemini">Gemini (Google Search)</option>
                </select>
                <select v-model="models[CLERK.key].modelId" aria-label="Clerk model" class="model-select">
                  <option value="">Use system default</option>
                  <option v-for="opt in MODELS_BY_PROVIDER[models[CLERK.key].provider]" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-info" for="max-evidence">
                <span class="setting-name">Requests per member</span>
                <span class="setting-desc">0 to {{ MAX_EVIDENCE_LIMIT }}. Set 0 to skip evidence. Each request is one search call, plus downloads and one extraction call.</span>
              </label>
              <div class="setting-control">
                <input id="max-evidence" v-model.number="maxEvidencePerPersona" class="num-input" type="number" inputmode="numeric" name="max-evidence" min="0" :max="MAX_EVIDENCE_LIMIT" step="1" />
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-info" for="extract-evidence">
                <span class="setting-name">Read the downloaded documents</span>
                <span class="setting-desc">
                  A second clerk call per request. Turn it off to save calls: the search summary is used as is, so the evidence is the model’s
                  summary rather than facts pulled from the page.
                </span>
              </label>
              <div class="setting-control">
                <input id="extract-evidence" v-model="extractEvidence" class="switch" type="checkbox" role="switch" name="extract-evidence" />
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-info" for="review-evidence">
                <span class="setting-name">Evidence during peer review</span>
                <span class="setting-desc">Pick the cheaper option if free models time out or truncate during peer review.</span>
              </label>
              <div class="setting-control">
                <select id="review-evidence" v-model="peerReviewEvidence" name="review-evidence">
                  <option value="all">Everyone sees all evidence</option>
                  <option value="own">Only their own requests (cheaper)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <footer v-if="section !== 'keys'" class="save-bar">
          <span v-if="error" class="error-text" role="alert">{{ error }}</span>
          <span v-else-if="saved" class="saved" role="status"><AppIcon name="check" :size="14" /> Saved</span>
          <span v-else class="muted">Model and evidence changes apply to the next run.</span>
          <button class="btn" type="submit" :disabled="saving">{{ saving ? "Saving…" : "Save Settings" }}</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}
.settings-nav {
  position: sticky;
  top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-soft);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.nav-item:hover {
  background: var(--hover);
  color: var(--fg);
}
.nav-item.active {
  background: var(--accent-soft);
  color: var(--fg);
  font-weight: 600;
}
.settings-body {
  min-width: 0;
  max-width: 820px;
}
.sec-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.9rem;
  margin-bottom: 0.9rem;
  border-bottom: 1px solid var(--border);
}
.sec-head h2 {
  margin: 0;
  font-size: 1.2rem;
}
.sec-head p {
  margin: 0.3rem 0 0;
  max-width: 62ch;
  color: var(--muted);
  font-size: 0.88rem;
}
.sec-head .btn {
  flex-shrink: 0;
}
.note {
  margin: 0 0 1rem;
  font-size: 0.8rem;
  color: var(--muted);
}
.callout {
  margin-bottom: 1rem;
}

/* --- Keys --- */
.provider {
  margin-bottom: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.provider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.key-list {
  display: flex;
  flex-direction: column;
  margin: 0 0 0.75rem;
  padding: 0;
  list-style: none;
}
.key-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--border);
}
.key-icon {
  color: var(--muted);
}
.key-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.key-name {
  font-size: 0.9rem;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.key-hint {
  margin-left: 0.4rem;
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--muted);
}
.key-note {
  font-size: 0.76rem;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.key-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}
.add-key {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto;
  gap: 0.5rem;
}
.add-key input {
  min-width: 0;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}

/* --- Rows --- */
.rows {
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.role-info {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.setting-control select {
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}
.model-select {
  width: 13rem;
}
.num-input {
  width: 5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
label.setting-info {
  cursor: pointer;
}

.save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  backdrop-filter: blur(6px);
  font-size: 0.85rem;
}
.saved {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--success);
  font-weight: 600;
}

@media (max-width: 800px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
  .nav-item {
    white-space: nowrap;
  }
}
@media (max-width: 600px) {
  .sec-head {
    flex-direction: column;
  }
  .key-row {
    flex-wrap: wrap;
  }
  .key-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .add-key {
    grid-template-columns: minmax(0, 1fr);
  }
  .setting-control {
    flex-wrap: wrap;
  }
  .model-select,
  .setting-control select {
    width: 100%;
  }
}
</style>
