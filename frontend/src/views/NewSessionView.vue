<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";
import { useSessionsStore } from "../stores/sessions";
import FileDropZone from "../components/FileDropZone.vue";

type Field = "problemStatement" | "judgingCriteria" | "pitchText";
type Attached = { filename: string; type: string; text: string };
type Criterion = { name: string; description: string; weight: number | null };

const DRAFT_KEY = "startup-council:new-session-draft";

const CRITERIA_PRESET: Criterion[] = [
  { name: "Innovation", description: "How novel and differentiated is the idea?", weight: 25 },
  { name: "Feasibility", description: "Can the team realistically build and ship it?", weight: 25 },
  { name: "Impact", description: "How large is the problem and the potential benefit?", weight: 25 },
  { name: "Presentation", description: "How clear and convincing is the pitch?", weight: 25 },
];

const textFields: { key: Field; id: string; label: string; placeholder: string; required: boolean }[] = [
  { key: "pitchText", id: "pitch", label: "Pitch / submission", placeholder: "Paste the pitch or idea description…", required: true },
  {
    key: "problemStatement",
    id: "problem",
    label: "Problem statement / challenge (optional)",
    placeholder: "Paste the problem statement or challenge brief, if there is one…",
    required: false,
  },
];

const PERSONA_OPTIONS = [
  { key: "judge", label: "Judge", hint: "Scores strictly against your rubric" },
  { key: "skeptic", label: "Skeptic", hint: "Hunts for reasons it fails" },
  { key: "optimist", label: "Optimist", hint: "Makes the case for the upside" },
  { key: "market_analyst", label: "Market Analyst", hint: "Market size, demand, competition" },
  { key: "tech_lead", label: "Technical Feasibility Lead", hint: "Can it actually be built?" },
  { key: "vc_investor", label: "Reality Checker", hint: "Investor-style reality check" },
];
const MIN_PERSONAS = 2;

const EVENT_TYPES = ["Hackathon", "Investor pitch", "Grant application", "Accelerator application", "Class / competition", "Other"];
const STAGES = ["Idea only", "Prototype / MVP", "Launched, early users", "Growing / revenue"];

const router = useRouter();
const store = useSessionsStore();

const title = ref("");
const text = reactive<Record<Field, string>>({ problemStatement: "", judgingCriteria: "", pitchText: "" });
const attached = reactive<Record<Field, Attached[]>>({ problemStatement: [], judgingCriteria: [], pitchText: [] });
const eventType = ref("");
const stage = ref("");
const links = ref("");
const titleAuto = ref(true);
const selectedPersonas = ref<string[]>(PERSONA_OPTIONS.map((p) => p.key));
const criteriaMode = ref<"structured" | "text">("structured");
const criteria = ref<Criterion[]>([{ name: "", description: "", weight: null }]);

const submitting = ref(false);
const error = ref<string | null>(null);
const uploadingField = ref<Field | null>(null);
const hasDraft = ref(false);

// --- Draft persistence -------------------------------------------------------

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    title.value = d.title ?? "";
    titleAuto.value = !title.value.trim();
    eventType.value = d.eventType ?? "";
    stage.value = d.stage ?? "";
    links.value = d.links ?? "";
    if (Array.isArray(d.personas)) {
      const valid = PERSONA_OPTIONS.map((p) => p.key).filter((k) => d.personas.includes(k));
      if (valid.length) selectedPersonas.value = valid;
    }
    Object.assign(text, d.text ?? {});
    Object.assign(attached, d.attached ?? {});
    if (d.criteriaMode === "text" || d.criteriaMode === "structured") criteriaMode.value = d.criteriaMode;
    if (Array.isArray(d.criteria) && d.criteria.length) criteria.value = d.criteria;
    hasDraft.value = isDirty();
  } catch {
    /* corrupt or unavailable storage: start blank */
  }
}

function isDirty() {
  return (
    !!title.value.trim() ||
    !!eventType.value ||
    !!stage.value ||
    !!links.value.trim() ||
    selectedPersonas.value.length !== PERSONA_OPTIONS.length ||
    Object.values(text).some((t) => t.trim()) ||
    criteria.value.some((c) => c.name.trim() || c.description.trim() || c.weight !== null)
  );
}

function saveDraft() {
  try {
    if (!isDirty()) {
      localStorage.removeItem(DRAFT_KEY);
      hasDraft.value = false;
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: title.value,
        eventType: eventType.value,
        stage: stage.value,
        links: links.value,
        personas: selectedPersonas.value,
        text,
        attached,
        criteriaMode: criteriaMode.value,
        criteria: criteria.value,
      }),
    );
    hasDraft.value = true;
  } catch {
    /* storage full or blocked: draft just won't persist */
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
  hasDraft.value = false;
}

function discardDraft() {
  if (!window.confirm("Discard everything you've entered?")) return;
  title.value = "";
  titleAuto.value = true;
  eventType.value = "";
  stage.value = "";
  links.value = "";
  selectedPersonas.value = PERSONA_OPTIONS.map((p) => p.key);
  for (const f of Object.keys(text) as Field[]) {
    text[f] = "";
    attached[f] = [];
  }
  criteria.value = [{ name: "", description: "", weight: null }];
  criteriaMode.value = "structured";
  error.value = null;
  clearDraftStorage();
}

loadDraft();
watch([title, eventType, stage, links, selectedPersonas, text, attached, criteriaMode, criteria], saveDraft, { deep: true });

// --- Title suggestion --------------------------------------------------------

function suggestTitle(): string {
  const firstLine = text.pitchText
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/[*_`]/g, "").trim())
    .find((l) => l.length > 0);
  if (firstLine) {
    if (firstLine.length <= 60) return firstLine;
    const cut = firstLine.slice(0, 60);
    return cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : 60).trim();
  }
  const file = attached.pitchText[0]?.filename;
  return file ? file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() : "";
}

// Keep suggesting until the user types their own title.
watch(
  () => [text.pitchText, attached.pitchText.length],
  () => {
    if (titleAuto.value) title.value = suggestTitle();
  },
);

// --- Structured criteria -----------------------------------------------------

const totalWeight = computed(() => criteria.value.reduce((sum, c) => sum + (Number(c.weight) || 0), 0));
const namedCriteria = computed(() => criteria.value.filter((c) => c.name.trim()));

const serializedCriteria = computed(() =>
  namedCriteria.value
    .map((c, i) => {
      const weight = c.weight !== null && c.weight !== undefined ? ` (weight ${c.weight}%)` : "";
      const desc = c.description.trim() ? `: ${c.description.trim()}` : "";
      return `${i + 1}. ${c.name.trim()}${weight}${desc}`;
    })
    .join("\n"),
);

const criteriaError = computed<string | null>(() => {
  if (criteriaMode.value === "text") {
    return text.judgingCriteria.trim() ? null : "Enter or upload the judging criteria.";
  }
  if (!namedCriteria.value.length) return "Add at least one named criterion.";
  if (totalWeight.value !== 100) return `Weights must add up to 100% (currently ${totalWeight.value}%).`;
  return null;
});

const finalCriteria = computed(() =>
  criteriaMode.value === "structured" ? serializedCriteria.value : text.judgingCriteria,
);

function addCriterion() {
  criteria.value.push({ name: "", description: "", weight: null });
}

function removeCriterion(i: number) {
  criteria.value.splice(i, 1);
  if (!criteria.value.length) addCriterion();
}

function applyPreset() {
  if (namedCriteria.value.length && !window.confirm("Replace the current criteria with the preset?")) return;
  criteria.value = CRITERIA_PRESET.map((c) => ({ ...c }));
}

function evenWeights() {
  const rows = criteria.value.filter((c) => c.name.trim());
  if (!rows.length) return;
  const base = Math.floor(100 / rows.length);
  let remainder = 100 - base * rows.length;
  for (const r of rows) {
    r.weight = base + (remainder-- > 0 ? 1 : 0);
  }
}

function switchCriteriaMode(mode: "structured" | "text") {
  if (mode === criteriaMode.value) return;
  // Carry structured rows into the text box so nothing typed is lost.
  if (mode === "text" && !text.judgingCriteria.trim() && serializedCriteria.value) {
    text.judgingCriteria = serializedCriteria.value;
  }
  criteriaMode.value = mode;
}

// --- Uploads -----------------------------------------------------------------

// Matches the backend multer limit (kept under Vercel's ~4.5MB body cap).
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXT = [".pdf", ".docx", ".md", ".txt"];
const ACCEPT = ALLOWED_EXT.join(",");

function appendText(field: Field, extra: string) {
  const current = text[field].replace(/\s+$/, "");
  text[field] = current ? `${current}\n\n${extra}` : extra;
}

/** Validates and extracts one file into a field. Returns false (with `error` set) if it was rejected. */
async function uploadOne(field: Field, file: File): Promise<boolean> {
  const lower = file.name.toLowerCase();
  if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
    error.value = `${file.name}: unsupported file type. Use ${ALLOWED_EXT.join(", ")}.`;
    return false;
  }
  if (file.size === 0) {
    error.value = `${file.name} is empty.`;
    return false;
  }
  if (file.size > MAX_FILE_BYTES) {
    error.value = `${file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB. Split it or paste the relevant part.`;
    return false;
  }

  try {
    const result = await api.extractFile(file);
    if (!result.text.trim()) {
      error.value = `No text could be extracted from ${result.filename} (scanned PDFs need OCR).`;
      return false;
    }
    if (field === "judgingCriteria" && criteriaMode.value === "structured") {
      switchCriteriaMode("text");
    }
    appendText(field, result.text);
    attached[field].push({ filename: result.filename, type: result.type, text: result.text });
    return true;
  } catch (err) {
    error.value = (err as Error).message;
    return false;
  }
}

/** Handles files from the picker or a drop, one at a time so the text is appended in order. */
async function handleFiles(field: Field, files: File[]) {
  if (uploadingField.value) return;
  error.value = null;
  uploadingField.value = field;
  try {
    for (const file of files) {
      if (!(await uploadOne(field, file))) break;
    }
  } finally {
    uploadingField.value = null;
  }
}

function removeFile(field: Field, index: number) {
  const [file] = attached[field].splice(index, 1);
  if (!file) return;
  // Remove the text this file contributed, if the user hasn't edited it away.
  const at = text[field].indexOf(file.text);
  if (at !== -1) {
    text[field] = (text[field].slice(0, at) + text[field].slice(at + file.text.length))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}

const sourceFiles = computed(() =>
  (Object.values(attached) as Attached[][]).flat().map(({ filename, type }) => ({ filename, type })),
);

// --- Length limits -----------------------------------------------------------
// Every field is sent to each council persona, the peer review, and the chairman, so long text is costly
// and can exceed model context windows.

const WARN_CHARS = 20_000;
const MAX_CHARS = 60_000;

function lengthState(field: Field): "ok" | "warn" | "over" {
  const n = text[field].length;
  if (n > MAX_CHARS) return "over";
  return n > WARN_CHARS ? "warn" : "ok";
}

function lengthMessage(field: Field): string | null {
  const state = lengthState(field);
  if (state === "over") {
    return `Too long (max ${MAX_CHARS.toLocaleString()} characters). Trim it before submitting.`;
  }
  if (state === "warn") {
    return `Long input (over ${WARN_CHARS.toLocaleString()} characters) — the council will be slower and costlier. Consider trimming.`;
  }
  return null;
}

const anyOverLimit = computed(() =>
  (["problemStatement", "pitchText"] as Field[]).some((f) => lengthState(f) === "over") ||
  (criteriaMode.value === "text" && lengthState("judgingCriteria") === "over"),
);

// --- Submit ------------------------------------------------------------------

const canSubmit = computed(
  () =>
    !submitting.value &&
    !uploadingField.value &&
    !anyOverLimit.value &&
    selectedPersonas.value.length >= MIN_PERSONAS &&
    !!title.value.trim() &&
    !!text.pitchText.trim() &&
    !criteriaError.value,
);

/** Optional context and the problem statement are stored together in the problem statement column. */
const composedProblem = computed(() => {
  const lines: string[] = [];
  if (eventType.value) lines.push(`- Event type: ${eventType.value}`);
  if (stage.value) lines.push(`- Stage: ${stage.value}`);
  const linkList = links.value.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
  if (linkList.length) lines.push(`- Links: ${linkList.join(", ")}`);

  const parts: string[] = [];
  if (lines.length) parts.push(`Context:\n${lines.join("\n")}`);
  if (text.problemStatement.trim()) parts.push(text.problemStatement.trim());
  return parts.join("\n\n") || "Not provided.";
});

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const id = await store.create({
      title: title.value,
      problemStatement: composedProblem.value,
      judgingCriteria: finalCriteria.value,
      pitchText: text.pitchText,
      sourceFiles: sourceFiles.value,
      personas: selectedPersonas.value,
    });
    clearDraftStorage();
    router.push(`/sessions/${id}`);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div>
    <h2>New judging session</h2>
    <p class="muted">
      Paste text directly, or upload PDF / DOCX / MD / TXT files to extract it. Uploads are added to
      what you've already typed. The council will run once you submit.
    </p>
    <p v-if="hasDraft" class="muted draft-note">
      Draft saved in this browser.
      <button type="button" class="link-btn" @click="discardDraft">Discard draft</button>
    </p>

    <form @submit.prevent="submit">
      <div class="field">
        <label for="title">Title</label>
        <input
          id="title"
          v-model="title"
          type="text"
          required
          placeholder="e.g. Hackathon Idea: FoodShare"
          @input="titleAuto = false"
        />
        <span v-if="titleAuto && title" class="muted hint">Suggested from your pitch. Edit it to use your own.</span>
      </div>

      <!-- Problem statement + Pitch share the same text+upload layout -->
      <div v-for="f in textFields" :key="f.key" class="field">
        <label :for="f.id">{{ f.label }}</label>
        <FileDropZone :label="f.label" :accept="ACCEPT" :busy="uploadingField === f.key" @files="handleFiles(f.key, $event)">
          <textarea :id="f.id" v-model="text[f.key]" :required="f.required" :placeholder="f.placeholder" />
          <template #aside>
            <span class="muted count" :class="lengthState(f.key)">{{ text[f.key].length.toLocaleString() }} chars</span>
          </template>
        </FileDropZone>
        <span v-if="lengthMessage(f.key)" class="length-msg" :class="lengthState(f.key)" role="status">{{ lengthMessage(f.key) }}</span>
        <ul v-if="attached[f.key].length" class="chips">
          <li v-for="(file, i) in attached[f.key]" :key="i" class="chip">
            {{ file.filename }}
            <button type="button" :aria-label="`Remove ${file.filename}`" @click="removeFile(f.key, i)">×</button>
          </li>
        </ul>
      </div>

      <details class="field context" :open="!!(eventType || stage || links)">
        <summary>Optional context</summary>
        <div class="context-grid">
          <div class="field">
            <label for="event-type">Event type</label>
            <select id="event-type" v-model="eventType">
              <option value="">Not specified</option>
              <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="field">
            <label for="stage">Stage</label>
            <select id="stage" v-model="stage">
              <option value="">Not specified</option>
              <option v-for="s in STAGES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="links">Links (demo, deck, repo)</label>
          <textarea id="links" v-model="links" class="short" placeholder="One per line, or comma-separated" />
        </div>
      </details>

      <fieldset class="field personas">
        <legend>Council members ({{ selectedPersonas.length }} of {{ PERSONA_OPTIONS.length }})</legend>
        <label v-for="p in PERSONA_OPTIONS" :key="p.key" class="persona-option">
          <input v-model="selectedPersonas" type="checkbox" :value="p.key" />
          <span><strong>{{ p.label }}</strong> <span class="muted">{{ p.hint }}</span></span>
        </label>
        <span v-if="selectedPersonas.length < MIN_PERSONAS" class="error-text" role="status">Pick at least {{ MIN_PERSONAS }} members, since they peer-review each other.</span>
        <span v-else class="muted hint">Fewer members means fewer model calls and a faster, cheaper run. The chairman always runs.</span>
      </fieldset>

      <div class="field">
        <div class="criteria-head">
          <label id="criteria-label">Judging criteria</label>
          <div class="mode-toggle" role="group" aria-labelledby="criteria-label">
            <button type="button" :class="{ active: criteriaMode === 'structured' }" @click="switchCriteriaMode('structured')">Rubric</button>
            <button type="button" :class="{ active: criteriaMode === 'text' }" @click="switchCriteriaMode('text')">Paste / upload</button>
          </div>
        </div>

        <template v-if="criteriaMode === 'structured'">
          <div class="criteria-rows">
            <div v-for="(c, i) in criteria" :key="i" class="criteria-row">
              <input v-model="c.name" type="text" placeholder="Criterion" :aria-label="`Criterion ${i + 1} name`" />
              <input v-model="c.description" type="text" placeholder="What does the council look for? (optional)" :aria-label="`Criterion ${i + 1} description`" />
              <div class="weight">
                <input v-model.number="c.weight" type="number" min="0" max="100" step="1" placeholder="0" :aria-label="`Criterion ${i + 1} weight percent`" />
                <span>%</span>
              </div>
              <button type="button" class="remove" :aria-label="`Remove criterion ${i + 1}`" @click="removeCriterion(i)">×</button>
            </div>
          </div>
          <div class="criteria-actions">
            <button type="button" class="btn btn-secondary small" @click="addCriterion">+ Add criterion</button>
            <button type="button" class="btn btn-secondary small" @click="applyPreset">Use preset</button>
            <button type="button" class="btn btn-secondary small" @click="evenWeights">Even out weights</button>
            <span class="total" :class="{ ok: totalWeight === 100, bad: totalWeight !== 100 }">Total: {{ totalWeight }}%</span>
          </div>
        </template>

        <template v-else>
          <FileDropZone label="Judging criteria" :accept="ACCEPT" :busy="uploadingField === 'judgingCriteria'" @files="handleFiles('judgingCriteria', $event)">
            <textarea id="criteria" v-model="text.judgingCriteria" placeholder="Paste the judging criteria/rubric…" />
            <template #aside>
              <span class="muted count" :class="lengthState('judgingCriteria')">{{ text.judgingCriteria.length.toLocaleString() }} chars</span>
            </template>
          </FileDropZone>
          <span v-if="lengthMessage('judgingCriteria')" class="length-msg" :class="lengthState('judgingCriteria')" role="status">{{ lengthMessage('judgingCriteria') }}</span>
          <ul v-if="attached.judgingCriteria.length" class="chips">
            <li v-for="(file, i) in attached.judgingCriteria" :key="i" class="chip">
              {{ file.filename }}
              <button type="button" :aria-label="`Remove ${file.filename}`" @click="removeFile('judgingCriteria', i)">×</button>
            </li>
          </ul>
        </template>
        <span v-if="criteriaError" class="error-text" role="status">{{ criteriaError }}</span>
      </div>

      <button class="btn" type="submit" :disabled="!canSubmit">
        {{ submitting ? "Submitting…" : "Submit to council" }}
      </button>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    </form>
  </div>
</template>

<style scoped>
.personas {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.9rem 0.8rem;
  margin-inline: 0;
}
.personas legend {
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0 0.3rem;
}
.persona-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-weight: 400 !important;
  cursor: pointer;
}
.persona-option input {
  margin-top: 0.25rem;
}
.hint {
  font-size: 0.8rem;
}
.context summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
.context-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
textarea.short {
  min-height: 60px;
}
@media (max-width: 600px) {
  .context-grid {
    grid-template-columns: 1fr;
  }
}
.draft-note {
  font-size: 0.85rem;
}
.count {
  font-size: 0.8rem;
}
.count.warn,
.length-msg.warn {
  color: var(--warn);
}
.count.over,
.length-msg.over {
  color: var(--danger);
}
.length-msg {
  font-size: 0.8rem;
}
.chips {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.15rem 0.3rem 0.15rem 0.7rem;
  font-size: 0.8rem;
}
.chip button,
.remove {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.1rem 0.4rem;
}
.chip button:hover,
.remove:hover {
  color: var(--danger);
}
.criteria-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.mode-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.mode-toggle button {
  background: none;
  border: none;
  color: var(--fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.7rem;
}
.mode-toggle button.active {
  background: var(--accent);
  color: #fff;
}
.criteria-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.criteria-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto auto;
  gap: 0.5rem;
  align-items: center;
}
.criteria-row input[type="text"] {
  width: 100%;
  min-width: 0;
}
.weight {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.weight input {
  width: 4.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.6rem 0.5rem;
  font: inherit;
  background: var(--bg);
  color: var(--fg);
}
.criteria-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn.small {
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
}
.total {
  margin-left: auto;
  font-weight: 600;
  font-size: 0.85rem;
}
.total.ok {
  color: var(--success);
}
.total.bad {
  color: var(--warn);
}
@media (max-width: 600px) {
  .criteria-row {
    grid-template-columns: 1fr auto auto;
  }
  .criteria-row input[type="text"]:nth-child(2) {
    grid-column: 1 / -1;
    order: 4;
  }
}
</style>
