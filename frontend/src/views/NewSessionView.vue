<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { api } from "../lib/api";
import { useSessionsStore } from "../stores/sessions";
import AppIcon from "../components/AppIcon.vue";
import FileDropZone from "../components/FileDropZone.vue";
import PersonaAvatar from "../components/PersonaAvatar.vue";
import { PERSONAS } from "../lib/personas";
import { useKeysStore } from "../stores/keys";

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

const PERSONA_OPTIONS = PERSONAS;
const MIN_PERSONAS = 2;

const EVENT_TYPES = ["Hackathon", "Investor pitch", "Grant application", "Accelerator application", "Class / competition", "Other"];
const STAGES = ["Idea only", "Prototype / MVP", "Launched, early users", "Growing / revenue"];

const router = useRouter();
const store = useSessionsStore();
// Without any API key nothing can run, so the form is replaced by a pointer to Settings (the backend refuses too).
const keys = useKeysStore();
keys.fetch();

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

function togglePersona(key: string) {
  const i = selectedPersonas.value.indexOf(key);
  if (i === -1) selectedPersonas.value.push(key);
  else selectedPersonas.value.splice(i, 1);
}

/** What still stands between the form and a submit, shown as a checklist beside the form. */
const checklist = computed(() => [
  { label: "Title", ok: !!title.value.trim() },
  { label: "Pitch", ok: !!text.pitchText.trim() && lengthState("pitchText") !== "over" },
  { label: criteriaMode.value === "structured" ? `Criteria (${totalWeight.value}% of 100%)` : "Criteria", ok: !criteriaError.value },
  { label: `Council (${selectedPersonas.value.length} members)`, ok: selectedPersonas.value.length >= MIN_PERSONAS },
]);
/** A verdict and a review per member, plus the chairman. Evidence calls depend on Settings. */
const modelCalls = computed(() => selectedPersonas.value.length * 2 + 1);

const linkList = computed(() =>
  links.value
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean),
);

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const id = await store.create({
      title: title.value,
      problemStatement: text.problemStatement,
      eventType: eventType.value || undefined,
      stage: stage.value || undefined,
      links: linkList.value,
      criteria: criteriaMode.value === "structured" ? namedCriteria.value : undefined,
      judgingCriteria: finalCriteria.value,
      pitchText: text.pitchText,
      sourceFiles: sourceFiles.value,
      personas: selectedPersonas.value,
    });
    clearDraftStorage();
    router.push(`/sessions/${id}`);
  } catch (err) {
    error.value = (err as Error).message;
    keys.fetch(); // if the refusal was "no API keys" (e.g. deleted in another tab), this swaps in the setup panel
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="page wide">
    <header class="page-head">
      <p class="eyebrow"><AppIcon name="plus" :size="13" /> New judging</p>
      <h1 class="page-title">Put an idea before the council</h1>
      <p class="lede">Paste text, or drop a PDF, DOCX, MD or TXT file onto any text box. Nothing runs until you submit, and you can check and retry every step.</p>
      <p v-if="hasDraft" class="draft-note">
        <AppIcon name="check" :size="13" /> Draft saved in this browser.
        <button type="button" class="link-btn" @click="discardDraft">Discard Draft</button>
      </p>
    </header>

    <section v-if="keys.missing" class="gate" aria-labelledby="gate-heading">
      <span class="gate-icon"><AppIcon name="lock" :size="22" /></span>
      <h2 id="gate-heading">Add an API key first</h2>
      <p>
        The council runs on AI models billed to your own key, and you haven’t added one yet. Add a key in Settings, then come back here.
        OpenRouter is the easiest start, since every role uses it by default.
      </p>
      <p v-if="hasDraft" class="gate-note"><AppIcon name="check" :size="13" /> Your draft is saved and will be here when you return.</p>
      <div class="gate-actions">
        <RouterLink to="/settings?section=keys" class="btn btn-lg"><AppIcon name="key" :size="16" /> Add an API Key</RouterLink>
        <RouterLink to="/about" class="btn btn-ghost btn-lg">How It Works</RouterLink>
      </div>
    </section>

    <div v-else class="layout">
      <form id="new-session-form" class="form" novalidate @submit.prevent="submit">
        <!-- 1. Pitch -->
        <section class="block" aria-labelledby="sec-pitch">
          <header class="block-head">
            <span class="block-n" aria-hidden="true">1</span>
            <div>
              <h2 id="sec-pitch">The pitch</h2>
              <p>What the council will judge.</p>
            </div>
          </header>

          <div class="field">
            <label for="title">Title</label>
            <input
              id="title"
              v-model="title"
              class="title-input"
              type="text"
              name="title"
              autocomplete="off"
              required
              placeholder="e.g. FoodShare: surplus meals for students…"
              @input="titleAuto = false"
            />
            <span v-if="titleAuto && title" class="hint"><AppIcon name="sparkle" :size="12" /> Suggested from your pitch. Edit it to use your own.</span>
          </div>

          <div class="field">
            <label for="pitch">Pitch or submission</label>
            <FileDropZone label="Pitch or submission" :accept="ACCEPT" :busy="uploadingField === 'pitchText'" @files="handleFiles('pitchText', $event)">
              <textarea id="pitch" v-model="text.pitchText" name="pitch" class="tall" required placeholder="Paste the pitch or idea description…" />
              <template #aside>
                <span class="count num" :class="lengthState('pitchText')">{{ text.pitchText.length.toLocaleString() }} chars</span>
              </template>
            </FileDropZone>
            <span v-if="lengthMessage('pitchText')" class="length-msg" :class="lengthState('pitchText')" role="status">{{ lengthMessage("pitchText") }}</span>
            <ul v-if="attached.pitchText.length" class="chips">
              <li v-for="(file, i) in attached.pitchText" :key="i" class="chip">
                <AppIcon name="file" :size="12" />{{ file.filename }}
                <button type="button" :aria-label="`Remove ${file.filename}`" @click="removeFile('pitchText', i)"><AppIcon name="x" :size="12" /></button>
              </li>
            </ul>
          </div>
        </section>

        <!-- 2. Criteria -->
        <section class="block" aria-labelledby="sec-criteria">
          <header class="block-head">
            <span class="block-n" aria-hidden="true">2</span>
            <div>
              <h2 id="sec-criteria">Judging criteria</h2>
              <p>Build a weighted rubric, or paste the one you were given.</p>
            </div>
            <div class="mode-toggle" role="group" aria-label="Criteria input">
              <button type="button" :aria-pressed="criteriaMode === 'structured'" @click="switchCriteriaMode('structured')">Rubric</button>
              <button type="button" :aria-pressed="criteriaMode === 'text'" @click="switchCriteriaMode('text')">Paste or Upload</button>
            </div>
          </header>

          <template v-if="criteriaMode === 'structured'">
            <div class="rubric">
              <div class="rubric-head" aria-hidden="true">
                <span>Criterion</span>
                <span>What the council looks for</span>
                <span>Weight</span>
                <span />
              </div>
              <div v-for="(c, i) in criteria" :key="i" class="criteria-row">
                <input v-model="c.name" type="text" :name="`criterion-${i}`" autocomplete="off" placeholder="e.g. Innovation…" :aria-label="`Criterion ${i + 1} name`" />
                <input v-model="c.description" type="text" :name="`criterion-${i}-desc`" autocomplete="off" placeholder="Optional description…" :aria-label="`Criterion ${i + 1} description`" />
                <div class="weight">
                  <input v-model.number="c.weight" type="number" inputmode="numeric" min="0" max="100" step="1" placeholder="0" :aria-label="`Criterion ${i + 1} weight percent`" />
                  <span aria-hidden="true">%</span>
                </div>
                <button type="button" class="remove" :aria-label="`Remove criterion ${i + 1}`" @click="removeCriterion(i)"><AppIcon name="x" :size="14" /></button>
              </div>
            </div>
            <div class="weight-meter" :class="{ ok: totalWeight === 100, over: totalWeight > 100 }">
              <span class="meter" aria-hidden="true"><span :style="{ width: `${Math.min(totalWeight, 100)}%` }" /></span>
              <span class="num total">{{ totalWeight }}% of 100%</span>
            </div>
            <div class="criteria-actions">
              <button type="button" class="btn btn-secondary btn-sm" @click="addCriterion"><AppIcon name="plus" :size="13" /> Add Criterion</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="applyPreset">Use Preset</button>
              <button type="button" class="btn btn-ghost btn-sm" @click="evenWeights">Even Out Weights</button>
            </div>
          </template>

          <template v-else>
            <FileDropZone label="Judging criteria" :accept="ACCEPT" :busy="uploadingField === 'judgingCriteria'" @files="handleFiles('judgingCriteria', $event)">
              <textarea id="criteria" v-model="text.judgingCriteria" name="criteria" aria-label="Judging criteria" placeholder="Paste the judging criteria or rubric…" />
              <template #aside>
                <span class="count num" :class="lengthState('judgingCriteria')">{{ text.judgingCriteria.length.toLocaleString() }} chars</span>
              </template>
            </FileDropZone>
            <span v-if="lengthMessage('judgingCriteria')" class="length-msg" :class="lengthState('judgingCriteria')" role="status">{{ lengthMessage("judgingCriteria") }}</span>
            <ul v-if="attached.judgingCriteria.length" class="chips">
              <li v-for="(file, i) in attached.judgingCriteria" :key="i" class="chip">
                <AppIcon name="file" :size="12" />{{ file.filename }}
                <button type="button" :aria-label="`Remove ${file.filename}`" @click="removeFile('judgingCriteria', i)"><AppIcon name="x" :size="12" /></button>
              </li>
            </ul>
          </template>
          <span v-if="criteriaError" class="field-error" role="status">{{ criteriaError }}</span>
        </section>

        <!-- 3. Council -->
        <section class="block" aria-labelledby="sec-council">
          <header class="block-head">
            <span class="block-n" aria-hidden="true">3</span>
            <div>
              <h2 id="sec-council">The council</h2>
              <p>{{ selectedPersonas.length }} of {{ PERSONA_OPTIONS.length }} members. The chairman always runs.</p>
            </div>
          </header>

          <fieldset class="personas">
            <legend class="sr-only">Council members</legend>
            <label v-for="p in PERSONA_OPTIONS" :key="p.key" class="persona-card" :class="{ on: selectedPersonas.includes(p.key) }">
              <input type="checkbox" class="sr-only" :value="p.key" :checked="selectedPersonas.includes(p.key)" @change="togglePersona(p.key)" />
              <PersonaAvatar :persona-key="p.key" :size="34" />
              <span class="pc-text">
                <strong>{{ p.label }}</strong>
                <span>{{ p.hint }}</span>
              </span>
              <span class="pc-check" aria-hidden="true"><AppIcon name="check" :size="12" /></span>
            </label>
          </fieldset>
          <span v-if="selectedPersonas.length < MIN_PERSONAS" class="field-error" role="status">Pick at least {{ MIN_PERSONAS }} members, since they peer-review each other.</span>
          <span v-else class="hint">Fewer members means fewer model calls and a faster, cheaper run.</span>
        </section>

        <!-- 4. Context -->
        <details class="block context" :open="!!(eventType || stage || links || text.problemStatement)">
          <summary class="block-head">
            <span class="block-n" aria-hidden="true">4</span>
            <div>
              <h2>Context <span class="optional">Optional</span></h2>
              <p>The brief, the event and links help the council judge fairly.</p>
            </div>
            <AppIcon name="chevron" :size="16" class="chev" />
          </summary>

          <div class="field">
            <label for="problem">Problem statement or challenge brief</label>
            <FileDropZone label="Problem statement" :accept="ACCEPT" :busy="uploadingField === 'problemStatement'" @files="handleFiles('problemStatement', $event)">
              <textarea id="problem" v-model="text.problemStatement" name="problem" placeholder="Paste the problem statement or challenge brief, if there is one…" />
              <template #aside>
                <span class="count num" :class="lengthState('problemStatement')">{{ text.problemStatement.length.toLocaleString() }} chars</span>
              </template>
            </FileDropZone>
            <span v-if="lengthMessage('problemStatement')" class="length-msg" :class="lengthState('problemStatement')" role="status">{{ lengthMessage("problemStatement") }}</span>
            <ul v-if="attached.problemStatement.length" class="chips">
              <li v-for="(file, i) in attached.problemStatement" :key="i" class="chip">
                <AppIcon name="file" :size="12" />{{ file.filename }}
                <button type="button" :aria-label="`Remove ${file.filename}`" @click="removeFile('problemStatement', i)"><AppIcon name="x" :size="12" /></button>
              </li>
            </ul>
          </div>
          <div class="context-grid">
            <div class="field">
              <label for="event-type">Event type</label>
              <select id="event-type" v-model="eventType" name="event-type">
                <option value="">Not specified</option>
                <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label for="stage">Stage</label>
              <select id="stage" v-model="stage" name="stage">
                <option value="">Not specified</option>
                <option v-for="st in STAGES" :key="st" :value="st">{{ st }}</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="links">Links (demo, deck, repo)</label>
            <textarea id="links" v-model="links" name="links" class="short" autocomplete="off" spellcheck="false" placeholder="https://… one per line, or comma-separated" />
          </div>
        </details>
      </form>

      <aside class="summary" aria-label="Submission summary">
        <div class="summary-card">
          <p class="section-title">Ready to submit?</p>
          <ul class="checklist">
            <li v-for="c in checklist" :key="c.label" :class="{ ok: c.ok }">
              <span class="tick" aria-hidden="true"><AppIcon v-if="c.ok" name="check" :size="11" /></span>
              {{ c.label }}
              <span class="sr-only">{{ c.ok ? "done" : "missing" }}</span>
            </li>
          </ul>
          <p class="estimate">
            <AppIcon name="cpu" :size="14" />
            <span>About <strong class="num">{{ modelCalls }}</strong> model calls, plus evidence searches.</span>
          </p>
          <button class="btn btn-lg submit" type="submit" form="new-session-form" :disabled="!canSubmit">
            {{ submitting ? "Submitting…" : "Submit to Council" }}
          </button>
          <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  max-width: 560px;
  margin: 2rem auto 0;
  padding: 2.25rem 2rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  text-align: center;
}
.gate-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent);
}
.gate h2 {
  margin: 0.4rem 0 0;
  font-size: 1.3rem;
}
.gate p {
  margin: 0;
  color: var(--fg-soft);
}
.gate-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}
.gate-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.8rem;
}
.draft-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.75rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 2rem;
  align-items: start;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

/* --- Numbered blocks --- */
.block {
  padding: 1.25rem 1.4rem 1.4rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.block-head {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  margin-bottom: 1.1rem;
}
.block-head > div:not(.mode-toggle) {
  flex: 1;
  min-width: 0;
}
.block-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
.block-head p {
  margin: 0.15rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}
.block-n {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
}
.optional {
  margin-left: 0.35rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--muted);
}
.context:not([open]) .block-head {
  margin-bottom: 0;
}
.context summary {
  cursor: pointer;
  list-style: none;
}
.context summary::-webkit-details-marker {
  display: none;
}
.chev {
  margin-top: 0.3rem;
  color: var(--muted);
  transition: transform 150ms ease;
}
.context[open] .chev {
  transform: rotate(90deg);
}
.field:last-child {
  margin-bottom: 0;
}
.title-input {
  font-size: 1.1rem;
  font-weight: 600;
  padding: 0.65rem 0.8rem;
}
textarea.tall {
  min-height: 220px;
}
textarea.short {
  min-height: 64px;
}
.hint {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--muted);
}
.field-error {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: var(--danger);
}
.count {
  font-size: 0.78rem;
  color: var(--muted);
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
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.15rem 0.2rem 0.15rem 0.6rem;
  font-size: 0.78rem;
  background: var(--bg);
  overflow-wrap: anywhere;
}
.chip button,
.remove {
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0.25rem;
  transition: color 120ms ease, background-color 120ms ease;
}
.chip button:hover,
.remove:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

/* --- Criteria --- */
.mode-toggle {
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}
.mode-toggle button {
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.7rem;
  transition: background-color 120ms ease, color 120ms ease;
}
.mode-toggle button:hover {
  color: var(--fg);
}
.mode-toggle button[aria-pressed="true"] {
  background: var(--hover);
  color: var(--fg);
}
.rubric {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.rubric-head,
.criteria-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) 5.5rem 2rem;
  gap: 0.5rem;
  align-items: center;
}
.rubric-head {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}
.criteria-row input[type="text"] {
  width: 100%;
  min-width: 0;
}
.weight {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--muted);
}
.weight input {
  width: 100%;
  min-width: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.weight-meter {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.9rem 0 0.75rem;
}
.meter {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--hover);
  overflow: hidden;
}
.meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--warn);
  transition: width 200ms ease, background-color 200ms ease;
}
.weight-meter.ok .meter span {
  background: var(--success);
}
.weight-meter.over .meter span {
  background: var(--danger);
}
.total {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--warn);
}
.weight-meter.ok .total {
  color: var(--success);
}
.weight-meter.over .total {
  color: var(--danger);
}
.criteria-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

/* --- Council --- */
.personas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.5rem;
  margin: 0 0 0.6rem;
  padding: 0;
  border: none;
}
.persona-card {
  position: relative; /* keeps the visually hidden checkbox inside its card, so focusing it scrolls to the card */
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  cursor: pointer;
  opacity: 0.6;
  transition: border-color 120ms ease, background-color 120ms ease, opacity 120ms ease;
}
.persona-card:hover {
  border-color: var(--border-strong);
  opacity: 0.85;
}
.persona-card.on {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  background: var(--accent-soft);
  opacity: 1;
}
.persona-card:has(:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.pc-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.pc-text strong {
  font-size: 0.88rem;
}
.pc-text span {
  font-size: 0.76rem;
  color: var(--muted);
}
.pc-check {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 5px;
  border: 1.5px solid var(--border-strong);
  color: transparent;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.persona-card.on .pc-check {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.context-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

/* --- Summary --- */
.summary {
  position: sticky;
  top: 1.5rem;
}
.summary-card {
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.checklist {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.88rem;
  color: var(--muted);
}
.checklist li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.checklist li.ok {
  color: var(--fg);
}
.tick {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px dashed var(--border-strong);
  color: #0d1f13;
}
.checklist li.ok .tick {
  border: none;
  background: var(--success);
}
.estimate {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0 0 1rem;
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  background: var(--bg);
  color: var(--fg-soft);
  font-size: 0.8rem;
}
.estimate .app-icon {
  margin-top: 0.15rem;
  color: var(--muted);
}
.submit {
  width: 100%;
}
.summary-card .error-text {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .summary {
    position: static;
  }
}
@media (max-width: 600px) {
  .block {
    padding: 1rem;
  }
  .block-head {
    flex-wrap: wrap;
  }
  .context-grid {
    grid-template-columns: 1fr;
  }
  .rubric-head {
    display: none;
  }
  .criteria-row {
    grid-template-columns: minmax(0, 1fr) 5rem 2rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .criteria-row input[type="text"]:nth-child(2) {
    grid-column: 1 / -1;
    order: 4;
  }
}
</style>
