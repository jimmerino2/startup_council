<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useSessionsStore } from "../stores/sessions";
import type { PersonaVerdict } from "../stores/sessions";

const props = defineProps<{ id: string }>();
const store = useSessionsStore();

const POLL_INTERVAL_MS = 4000;
let timer: ReturnType<typeof setInterval> | undefined;
const retryingPersona = ref<string | null>(null);
const retryingChairman = ref(false);
const startingJudging = ref(false);

function isInFlight() {
  const personaVerdicts = store.current?.personaVerdicts ?? [];
  const anyPersonaInFlight = personaVerdicts.some((v) => v.status === "pending" || v.status === "running");
  const chairmanInFlight = store.current?.session?.chairman_status === "running";
  return anyPersonaInFlight || chairmanInFlight;
}

onMounted(async () => {
  await store.fetchOne(props.id);
  timer = setInterval(() => {
    if (isInFlight()) store.fetchOne(props.id, { silent: true });
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => clearInterval(timer));

async function retryPersona(personaKey: string) {
  retryingPersona.value = personaKey;
  try {
    await store.retryPersona(props.id, personaKey);
  } catch (err) {
    store.error = (err as Error).message;
  } finally {
    retryingPersona.value = null;
  }
}

async function startJudging() {
  startingJudging.value = true;
  try {
    await store.retryJudging(props.id);
  } catch (err) {
    store.error = (err as Error).message;
  } finally {
    startingJudging.value = false;
  }
}

async function retryChairman() {
  retryingChairman.value = true;
  try {
    await store.retryChairman(props.id);
  } catch (err) {
    store.error = (err as Error).message;
  } finally {
    retryingChairman.value = false;
  }
}

const personaLabels: Record<string, string> = {
  judge: "Judge",
  skeptic: "Skeptic",
  optimist: "Optimist",
  market_analyst: "Market Analyst",
  tech_lead: "Technical Feasibility Lead",
  vc_investor: "VC Investor",
};

const recommendationColor: Record<string, string> = {
  fund: "var(--success)",
  iterate: "var(--warn)",
  pass: "var(--danger)",
};

const sessionTitle = computed(() => (store.current?.session?.title as string) ?? "");
const status = computed(() => (store.current?.session?.status as string) ?? "");
const chairmanStatus = computed(() => (store.current?.session?.chairman_status as string) ?? "pending");
const chairmanError = computed(() => (store.current?.session?.chairman_error as string | null) ?? null);
const personaVerdicts = computed<PersonaVerdict[]>(() => store.current?.personaVerdicts ?? []);
const allPersonasComplete = computed(() => personaVerdicts.value.length > 0 && personaVerdicts.value.every((v) => v.status === "complete"));
</script>

<template>
  <div>
    <p v-if="store.loading" class="muted">Loading…</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>

    <template v-else-if="store.current">
      <h2>{{ sessionTitle }}</h2>
      <span class="status-badge">{{ status }}</span>

      <div v-if="personaVerdicts.length === 0" class="card" style="margin-top: 1.25rem">
        <p class="muted">This session hasn't been judged yet.</p>
        <button class="btn" :disabled="startingJudging" @click="startJudging">
          {{ startingJudging ? "Starting…" : "Start judging" }}
        </button>
      </div>

      <div v-else-if="store.current.chairmanVerdict && chairmanStatus === 'complete'" class="card" style="margin-top: 1.25rem; border-width: 2px">
        <h3>
          Chairman verdict
          <span
            class="score-pill"
            :style="{ background: recommendationColor[store.current.chairmanVerdict.recommendation] ?? undefined, color: '#fff' }"
          >
            {{ store.current.chairmanVerdict.recommendation.toUpperCase() }} · {{ store.current.chairmanVerdict.overall_score }}/10
          </span>
        </h3>
        <p>{{ store.current.chairmanVerdict.final_verdict_text }}</p>
        <p class="muted">Model: {{ store.current.chairmanVerdict.model_id }}</p>
      </div>

      <div v-else class="card" style="margin-top: 1.25rem; border-width: 2px">
        <h3>Chairman verdict</h3>
        <p v-if="chairmanStatus === 'running'" class="muted">Chairman is synthesizing the final decision…</p>
        <p v-else-if="!allPersonasComplete" class="muted">
          Waiting on all 6 council members before the chairman can make a final decision.
        </p>
        <template v-else>
          <p v-if="chairmanStatus === 'failed'" class="error-text">Chairman failed: {{ chairmanError }}</p>
          <p v-else class="muted">All council members are in — ready for the chairman's final decision.</p>
          <button class="btn" :disabled="retryingChairman" @click="retryChairman">
            {{ retryingChairman ? "Running…" : chairmanStatus === "failed" ? "Retry chairman" : "Run chairman" }}
          </button>
        </template>
      </div>

      <template v-if="personaVerdicts.length > 0">
      <h3 style="margin-top: 1.5rem">Council verdicts</h3>
      <div v-for="v in personaVerdicts" :key="v.persona_key" class="card">
        <h3>
          {{ personaLabels[v.persona_key] ?? v.persona_key }}
          <span v-if="v.status === 'complete'" class="score-pill">{{ v.score }}/10</span>
          <span v-else class="status-badge">{{ v.status }}</span>
        </h3>

        <template v-if="v.status === 'complete'">
          <p>{{ v.verdict_text }}</p>
          <div v-if="v.strengths?.length">
            <strong>Strengths:</strong>
            <ul>
              <li v-for="s in v.strengths" :key="s">{{ s }}</li>
            </ul>
          </div>
          <div v-if="v.concerns?.length">
            <strong>Concerns:</strong>
            <ul>
              <li v-for="c in v.concerns" :key="c">{{ c }}</li>
            </ul>
          </div>
          <p class="muted">Model: {{ v.model_id }}</p>
        </template>
        <template v-else-if="v.status === 'failed'">
          <p class="error-text">{{ v.error_message }}</p>
          <p v-if="v.model_id" class="muted">Model: {{ v.model_id }}</p>
        </template>
        <p v-else class="muted">Finalizing Verdict…</p>

        <button
          v-if="v.status === 'failed'"
          class="btn btn-secondary"
          :disabled="retryingPersona === v.persona_key"
          @click="retryPersona(v.persona_key)"
        >
          {{ retryingPersona === v.persona_key ? "Retrying…" : "Retry" }}
        </button>
      </div>
      </template>
    </template>
  </div>
</template>
