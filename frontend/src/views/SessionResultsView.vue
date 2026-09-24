<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useSessionsStore } from "../stores/sessions";

const props = defineProps<{ id: string }>();
const store = useSessionsStore();

const POLL_INTERVAL_MS = 4000;
let timer: ReturnType<typeof setInterval> | undefined;

function isInFlight() {
  const s = store.current?.session?.status;
  return s === "pending" || s === "judging";
}

onMounted(async () => {
  await store.fetchOne(props.id);
  timer = setInterval(() => {
    if (isInFlight()) store.fetchOne(props.id, { silent: true });
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => clearInterval(timer));

async function retry() {
  try {
    await store.retryJudging(props.id);
  } catch (err) {
    store.error = (err as Error).message;
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
</script>

<template>
  <div>
    <p v-if="store.loading" class="muted">Loading…</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>

    <template v-else-if="store.current">
      <h2>{{ sessionTitle }}</h2>
      <span class="status-badge">{{ status }}</span>

      <div v-if="store.current.chairmanVerdict" class="card" style="margin-top: 1.25rem; border-width: 2px">
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
      <p v-else-if="status === 'judging' || status === 'pending'" class="muted">
        Council is deliberating… this usually takes 30–120 seconds. This page updates automatically.
      </p>
      <div v-else-if="status === 'error'">
        <p class="error-text">Judging failed (free models are sometimes overloaded).</p>
        <button class="btn" @click="retry">Retry judging</button>
      </div>

      <h3 style="margin-top: 1.5rem">Council verdicts</h3>
      <div v-for="v in store.current.personaVerdicts" :key="v.persona_key" class="card">
        <h3>
          {{ personaLabels[v.persona_key] ?? v.persona_key }}
          <span class="score-pill">{{ v.score }}/10</span>
        </h3>
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
      </div>
    </template>
  </div>
</template>
