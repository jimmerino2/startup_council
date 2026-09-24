<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";
import { useSessionsStore } from "../stores/sessions";

const router = useRouter();
const store = useSessionsStore();

const title = ref("");
const problemStatement = ref("");
const judgingCriteria = ref("");
const pitchText = ref("");
const sourceFiles = ref<{ filename: string; type: string }[]>([]);

const submitting = ref(false);
const error = ref<string | null>(null);
const uploadingField = ref<string | null>(null);

async function handleUpload(field: "problemStatement" | "judgingCriteria" | "pitchText", event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploadingField.value = field;
  error.value = null;
  try {
    const result = await api.extractFile(file);
    if (field === "problemStatement") problemStatement.value = result.text;
    if (field === "judgingCriteria") judgingCriteria.value = result.text;
    if (field === "pitchText") pitchText.value = result.text;
    sourceFiles.value.push({ filename: result.filename, type: result.type });
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    uploadingField.value = null;
    input.value = "";
  }
}

async function submit() {
  submitting.value = true;
  error.value = null;
  try {
    const id = await store.createAndJudge({
      title: title.value,
      problemStatement: problemStatement.value,
      judgingCriteria: judgingCriteria.value,
      pitchText: pitchText.value,
      sourceFiles: sourceFiles.value,
    });
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
      Paste text directly, or upload a PDF / DOCX / MD / TXT file to extract it. The council
      (6 personas + chairman) will run once you submit.
    </p>

    <form @submit.prevent="submit">
      <div class="field">
        <label for="title">Title</label>
        <input id="title" v-model="title" type="text" required placeholder="e.g. Hackathon Idea: FoodShare" />
      </div>

      <div class="field">
        <label for="problem">Problem statement</label>
        <textarea id="problem" v-model="problemStatement" required placeholder="Paste the problem statement…" />
        <input type="file" accept=".pdf,.docx,.md,.txt" @change="handleUpload('problemStatement', $event)" />
        <span v-if="uploadingField === 'problemStatement'" class="muted">Extracting…</span>
      </div>

      <div class="field">
        <label for="criteria">Judging criteria</label>
        <textarea id="criteria" v-model="judgingCriteria" required placeholder="Paste the judging criteria/rubric…" />
        <input type="file" accept=".pdf,.docx,.md,.txt" @change="handleUpload('judgingCriteria', $event)" />
        <span v-if="uploadingField === 'judgingCriteria'" class="muted">Extracting…</span>
      </div>

      <div class="field">
        <label for="pitch">Pitch / submission</label>
        <textarea id="pitch" v-model="pitchText" required placeholder="Paste the pitch or idea description…" />
        <input type="file" accept=".pdf,.docx,.md,.txt" @change="handleUpload('pitchText', $event)" />
        <span v-if="uploadingField === 'pitchText'" class="muted">Extracting…</span>
      </div>

      <button class="btn" type="submit" :disabled="submitting">
        {{ submitting ? "Submitting…" : "Submit to council" }}
      </button>
      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
  </div>
</template>
