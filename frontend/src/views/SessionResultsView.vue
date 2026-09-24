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
const startingReview = ref(false);
const retryingReview = ref<string | null>(null);

function isInFlight() {
  const personaVerdicts = store.current?.personaVerdicts ?? [];
  const anyPersonaInFlight = personaVerdicts.some((v) => v.status === "pending" || v.status === "running");
  const chairmanInFlight = store.current?.session?.chairman_status === "running";
  const anyReviewInFlight = personaVerdicts.some((v) => v.review_status === "running");
  return anyPersonaInFlight || anyReviewInFlight || chairmanInFlight;
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

async function startReview() {
  startingReview.value = true;
  try {
    await store.startReview(props.id);
  } catch (err) {
    store.error = (err as Error).message;
  } finally {
    startingReview.value = false;
  }
}

async function retryReview(personaKey: string) {
  retryingReview.value = personaKey;
  try {
    await store.retryReview(props.id, personaKey);
  } catch (err) {
    store.error = (err as Error).message;
  } finally {
    retryingReview.value = null;
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
const allReviewsComplete = computed(() => allPersonasComplete.value && personaVerdicts.value.every((v) => v.review_status === "complete"));
const anyReviewRunning = computed(() => personaVerdicts.value.some((v) => v.review_status === "running"));
const anyReviewFailed = computed(() => personaVerdicts.value.some((v) => v.review_status === "failed"));
const reviewStarted = computed(() => personaVerdicts.value.some((v) => v.review_status !== "pending"));
const reviewsDone = computed(() => personaVerdicts.value.filter((v) => v.review_status === "complete").length);

/** Mean rank (1 = best) each persona received from the peers that ranked it. */
const averageRanking = computed(() => {
  const totals: Record<string, { sum: number; n: number }> = {};
  for (const v of personaVerdicts.value) {
    (v.review_ranking ?? []).forEach((key, i) => {
      const t = (totals[key] ??= { sum: 0, n: 0 });
      t.sum += i + 1;
      t.n += 1;
    });
  }
  return Object.entries(totals)
    .map(([key, t]) => ({ key, avg: t.sum / t.n }))
    .sort((a, b) => a.avg - b.avg);
});
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

      <template v-else>
      <div class="card" style="margin-top: 1.25rem">
        <h3>Step 2 · Anonymous peer review</h3>
        <p v-if="!allPersonasComplete" class="muted">Waiting on all 6 council verdicts (step 1) before peer review can start.</p>
        <p v-else-if="anyReviewRunning" class="muted">Council members are reviewing each other's verdicts anonymously… ({{ reviewsDone }}/6 done)</p>
        <template v-else-if="allReviewsComplete">
          <p class="muted">All 6 reviews are in. Average rank from peers (1 = best):</p>
          <ol>
            <li v-for="r in averageRanking" :key="r.key">{{ personaLabels[r.key] ?? r.key }} — {{ r.avg.toFixed(1) }}</li>
          </ol>
        </template>
        <template v-else>
          <p v-if="anyReviewFailed" class="error-text">Some reviews failed — retry them below, or run the remaining ones again.</p>
          <p v-else class="muted">
            Each member will read the others' verdicts with names hidden, critique them and rank them. This makes 6 more model calls.
          </p>
          <button class="btn" :disabled="startingReview" @click="startReview">
            {{ startingReview ? "Starting…" : reviewStarted ? "Run remaining reviews" : "Proceed to peer review" }}
          </button>
        </template>
      </div>

      <div class="card" style="border-width: 2px">
        <h3>Step 3 · Chairman verdict</h3>
        <p v-if="chairmanStatus === 'running'" class="muted">Chairman is synthesizing the final decision…</p>
        <p v-else-if="!allReviewsComplete" class="muted">
          The chairman can make the final decision once all council verdicts and peer reviews are complete.
        </p>
        <template v-else>
          <p v-if="chairmanStatus === 'failed'" class="error-text">Chairman failed: {{ chairmanError }}</p>
          <p v-else class="muted">Peer review is done — ready for the chairman's final decision.</p>
          <button class="btn" :disabled="retryingChairman" @click="retryChairman">
            {{ retryingChairman ? "Running…" : chairmanStatus === "failed" ? "Retry chairman" : "Run chairman" }}
          </button>
        </template>
      </div>
      </template>

      <template v-if="personaVerdicts.length > 0">
      <h3 style="margin-top: 1.5rem">Step 1 · Council verdicts</h3>
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
          <div v-if="v.review_status === 'complete'" class="muted" style="margin-top: 0.75rem">
            <strong>Peer review by this member:</strong> {{ v.review_critique }}
            <div>Ranking: {{ v.review_ranking.map((k) => personaLabels[k] ?? k).join(" > ") }}</div>
          </div>
          <template v-else-if="v.review_status === 'failed'">
            <p class="error-text">Review failed: {{ v.review_error }}</p>
            <button class="btn btn-secondary" :disabled="retryingReview === v.persona_key" @click="retryReview(v.persona_key)">
              {{ retryingReview === v.persona_key ? "Retrying…" : "Retry review" }}
            </button>
          </template>
          <p v-else-if="v.review_status === 'running'" class="muted" style="margin-top: 0.75rem">Reviewing the other verdicts…</p>
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
