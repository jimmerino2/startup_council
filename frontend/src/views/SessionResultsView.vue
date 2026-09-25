<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useSessionsStore } from "../stores/sessions";
import type { PersonaVerdict } from "../stores/sessions";

const props = defineProps<{ id: string }>();
const store = useSessionsStore();

const POLL_INTERVAL_MS = 4000;
let timer: ReturnType<typeof setInterval> | undefined;

// One "busy" marker per button so a click disables only the button that was pressed.
const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);

async function run(key: string, action: () => Promise<void>) {
  busy.value = key;
  actionError.value = null;
  try {
    await action();
  } catch (err) {
    actionError.value = (err as Error).message;
  } finally {
    busy.value = null;
  }
}

const startGathering = () => run("gather", () => store.retryJudging(props.id));
const startVerdicts = () => run("verdicts", () => store.startVerdicts(props.id));
const retryEvidence = (requestId: string) => run(`evidence:${requestId}`, () => store.retryEvidence(props.id, requestId));
const retryPersona = (personaKey: string) => run(`persona:${personaKey}`, () => store.retryPersona(props.id, personaKey));
const startReview = () => run("review", () => store.startReview(props.id));
const retryReview = (personaKey: string) => run(`review:${personaKey}`, () => store.retryReview(props.id, personaKey));
const runChairman = () => run("chairman", () => store.retryChairman(props.id));

const personaLabels: Record<string, string> = {
  judge: "Judge",
  skeptic: "Skeptic",
  optimist: "Optimist",
  market_analyst: "Market Analyst",
  tech_lead: "Technical Feasibility Lead",
  vc_investor: "Reality Checker",
};

const recommendationColor: Record<string, string> = {
  fund: "var(--success)",
  iterate: "var(--warn)",
  pass: "var(--danger)",
};

const evidenceLabels: Record<string, string> = {
  pending: "queued",
  running: "working…",
  complete: "extracted",
  partial: "summary only",
  not_found: "nothing found",
  failed: "failed",
};

const sessionTitle = computed(() => (store.current?.session?.title as string) ?? "");
const status = computed(() => (store.current?.session?.status as string) ?? "");
const evidenceStatus = computed(() => (store.current?.session?.evidence_status as string) ?? "pending");
const evidenceError = computed(() => (store.current?.session?.evidence_error as string | null) ?? null);
const chairmanStatus = computed(() => (store.current?.session?.chairman_status as string) ?? "pending");
const chairmanError = computed(() => (store.current?.session?.chairman_error as string | null) ?? null);

const evidenceRequests = computed(() => store.current?.evidenceRequests ?? []);
const requesterNames = (e: { requested_by?: string[]; persona_key: string }) =>
  (e.requested_by?.length ? e.requested_by : [e.persona_key]).map((k) => personaLabels[k] ?? k).join(", ");
const documentsFor = (requestId: string) => (store.current?.evidenceDocuments ?? []).filter((d) => d.request_id === requestId);
const personaVerdicts = computed<PersonaVerdict[]>(() => store.current?.personaVerdicts ?? []);

// Once verdicts exist the evidence is locked, so retries are only offered before that.
const verdictsStarted = computed(() => personaVerdicts.value.length > 0);
const evidenceBusy = computed(() => evidenceStatus.value === "running" || evidenceRequests.value.some((r) => r.status === "pending" || r.status === "running"));
const evidenceStarted = computed(() => evidenceStatus.value !== "pending" || evidenceRequests.value.length > 0 || verdictsStarted.value);
// The stage has stopped running, whatever the outcome — used to show retry controls.
const evidenceStopped = computed(() => evidenceStarted.value && !evidenceBusy.value);
// Step 2 unlocks only once step 1 actually produced results (or was skipped) — a failed stage
// (e.g. no clerk key, or an unexpected error before any request was made) must not let it proceed.
const evidenceReady = computed(() => verdictsStarted.value || (evidenceStopped.value && ["complete", "skipped"].includes(evidenceStatus.value)));
const evidenceProblems = computed(() => evidenceRequests.value.filter((r) => r.status === "failed" || r.status === "not_found").length);

const allPersonasComplete = computed(() => personaVerdicts.value.length > 0 && personaVerdicts.value.every((v) => v.status === "complete"));
const allReviewsComplete = computed(() => allPersonasComplete.value && personaVerdicts.value.every((v) => v.review_status === "complete"));
const anyReviewRunning = computed(() => personaVerdicts.value.some((v) => v.review_status === "running"));
const anyReviewFailed = computed(() => personaVerdicts.value.some((v) => v.review_status === "failed"));
const reviewStarted = computed(() => personaVerdicts.value.some((v) => v.review_status !== "pending"));
const reviewsDone = computed(() => personaVerdicts.value.filter((v) => v.review_status === "complete").length);
const verdictsDone = computed(() => personaVerdicts.value.filter((v) => v.status === "complete").length);

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

function isInFlight() {
  const anyPersonaInFlight = personaVerdicts.value.some((v) => v.status === "pending" || v.status === "running");
  return anyPersonaInFlight || anyReviewRunning.value || chairmanStatus.value === "running" || evidenceBusy.value;
}

onMounted(async () => {
  await store.fetchOne(props.id);
  timer = setInterval(() => {
    if (isInFlight()) store.fetchOne(props.id, { silent: true });
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div>
    <p v-if="store.loading" class="muted">Loading…</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>

    <template v-else-if="store.current">
      <h2>{{ sessionTitle }}</h2>
      <span class="status-badge">{{ status }}</span>
      <p v-if="actionError" class="error-text">{{ actionError }}</p>

      <!-- Step 1 -->
      <div class="card" style="margin-top: 1.25rem">
        <h3>
          Step 1 · Gather evidence
          <span v-if="evidenceStarted" class="status-badge">{{ evidenceBusy ? "running" : evidenceStatus }}</span>
        </h3>
        <p class="muted">Each council member lists the documents it needs, and the clerk finds, downloads and reads them.</p>

        <template v-if="!evidenceStarted">
          <button class="btn" :disabled="busy === 'gather'" @click="startGathering">
            {{ busy === "gather" ? "Starting…" : "Start gathering evidence" }}
          </button>
        </template>
        <template v-else>
          <p v-if="evidenceBusy" class="muted">Working… requests are searched, downloaded and read in parallel.</p>
          <p v-if="evidenceError" class="error-text">{{ evidenceError }}</p>
          <p v-if="evidenceStatus === 'skipped'" class="muted">Evidence gathering is turned off in Settings (0 requests per persona).</p>
          <p v-else-if="evidenceStatus === 'complete' && evidenceRequests.length === 0 && !evidenceError" class="muted">
            No council member asked for outside evidence.
          </p>

          <div v-for="e in evidenceRequests" :key="e.id" class="evidence-item" style="margin-top: 0.75rem">
            <strong>{{ requesterNames(e) }}</strong>
            <template v-if="e.kind === 'document'"> asked for: {{ e.description }}</template>
            <template v-else> could not list its requests</template>
            <span class="status-badge">{{ evidenceLabels[e.status] ?? e.status }}</span>

            <p v-if="e.summary" style="margin: 0.25rem 0">{{ e.summary }}</p>
            <p v-if="e.note" class="muted" style="margin: 0.25rem 0">{{ e.note }}</p>
            <p v-if="e.error_message" class="error-text" style="margin: 0.25rem 0">{{ e.error_message }}</p>

            <ul v-if="e.sources?.length">
              <li v-for="src in e.sources" :key="src.url">
                <a :href="src.url" target="_blank" rel="noopener noreferrer">{{ src.title }}</a>
                <span v-for="d in documentsFor(e.id).filter((x) => x.url === src.url || x.title === src.title)" :key="d.id" class="muted">
                  · {{ d.fetch_status === "fetched" ? "downloaded" : `not downloaded: ${d.error_message}` }}
                </span>
              </li>
            </ul>

            <button
              v-if="!verdictsStarted && e.status !== 'complete' && e.status !== 'running' && e.status !== 'pending'"
              class="btn btn-secondary"
              :disabled="busy === `evidence:${e.id}`"
              @click="retryEvidence(e.id)"
            >
              {{ busy === `evidence:${e.id}` ? "Retrying…" : "Retry" }}
            </button>
          </div>

          <div v-if="!verdictsStarted && evidenceStopped" style="margin-top: 0.75rem">
            <button v-if="evidenceStatus === 'failed' && evidenceRequests.length === 0" class="btn btn-secondary" :disabled="busy === 'gather'" @click="startGathering">
              {{ busy === "gather" ? "Starting…" : "Run step 1 again" }}
            </button>
            <p v-if="evidenceProblems > 0" class="muted">
              {{ evidenceProblems }} request(s) came back empty or failed. Retry them above before continuing, or they'll be
              missing from the evidence the council argues from.
            </p>
          </div>
        </template>
      </div>

      <!-- Step 2 -->
      <div class="card">
        <h3>Step 2 · Initial verdicts</h3>
        <p v-if="!evidenceReady && !verdictsStarted" class="muted">Available once step 1 has finished successfully.</p>
        <template v-else-if="!verdictsStarted">
          <p class="muted">Each council member scores the submission using the evidence it requested. This makes 6 model calls.</p>
          <button class="btn" :disabled="busy === 'verdicts'" @click="startVerdicts">
            {{ busy === "verdicts" ? "Starting…" : "Proceed to initial verdicts" }}
          </button>
        </template>
        <p v-else class="muted">{{ verdictsDone }}/6 verdicts complete.</p>
      </div>

      <template v-if="verdictsStarted">
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
              <button class="btn btn-secondary" :disabled="busy === `review:${v.persona_key}`" @click="retryReview(v.persona_key)">
                {{ busy === `review:${v.persona_key}` ? "Retrying…" : "Retry review" }}
              </button>
            </template>
            <p v-else-if="v.review_status === 'running'" class="muted" style="margin-top: 0.75rem">Reviewing the other verdicts…</p>
          </template>
          <template v-else-if="v.status === 'failed'">
            <p class="error-text">{{ v.error_message }}</p>
            <p v-if="v.model_id" class="muted">Model: {{ v.model_id }}</p>
            <button class="btn btn-secondary" :disabled="busy === `persona:${v.persona_key}`" @click="retryPersona(v.persona_key)">
              {{ busy === `persona:${v.persona_key}` ? "Retrying…" : "Retry" }}
            </button>
          </template>
          <p v-else class="muted">Finalizing verdict…</p>
        </div>
      </template>

      <!-- Step 3 -->
      <div class="card">
        <h3>Step 3 · Anonymous peer review</h3>
        <p v-if="!allPersonasComplete" class="muted">Available once all 6 initial verdicts are in.</p>
        <p v-else-if="anyReviewRunning" class="muted">Council members are reviewing each other's verdicts anonymously… ({{ reviewsDone }}/6 done)</p>
        <template v-else-if="allReviewsComplete">
          <p class="muted">All 6 reviews are in. Average rank from peers (1 = best):</p>
          <ol>
            <li v-for="r in averageRanking" :key="r.key">{{ personaLabels[r.key] ?? r.key }}: {{ r.avg.toFixed(1) }}</li>
          </ol>
        </template>
        <template v-else>
          <p v-if="anyReviewFailed" class="error-text">Some reviews failed. Retry them on their cards, or run the remaining ones again.</p>
          <p v-else class="muted">
            Each member reads the others' verdicts with names hidden, along with the evidence, then critiques and ranks them. This makes 6 more model calls.
          </p>
          <button class="btn" :disabled="busy === 'review'" @click="startReview">
            {{ busy === "review" ? "Starting…" : reviewStarted ? "Run remaining reviews" : "Proceed to peer review" }}
          </button>
        </template>
      </div>

      <!-- Step 4 -->
      <div class="card" style="border-width: 2px">
        <h3>
          Step 4 · Chairman verdict
          <span
            v-if="store.current.chairmanVerdict && chairmanStatus === 'complete'"
            class="score-pill"
            :style="{ background: recommendationColor[store.current.chairmanVerdict.recommendation] ?? undefined, color: '#fff' }"
          >
            {{ store.current.chairmanVerdict.recommendation.toUpperCase() }} · {{ store.current.chairmanVerdict.overall_score }}/10
          </span>
        </h3>
        <template v-if="store.current.chairmanVerdict && chairmanStatus === 'complete'">
          <p>{{ store.current.chairmanVerdict.final_verdict_text }}</p>
          <p class="muted">Model: {{ store.current.chairmanVerdict.model_id }}</p>
        </template>
        <p v-else-if="chairmanStatus === 'running'" class="muted">Chairman is synthesizing the final decision…</p>
        <p v-else-if="!allReviewsComplete" class="muted">
          Available once all verdicts and peer reviews are complete.
        </p>
        <template v-else>
          <p v-if="chairmanStatus === 'failed'" class="error-text">Chairman failed: {{ chairmanError }}</p>
          <p v-else class="muted">Everything is in. The chairman weighs the verdicts, evidence and peer reviews into a final call.</p>
          <button class="btn" :disabled="busy === 'chairman'" @click="runChairman">
            {{ busy === "chairman" ? "Running…" : chairmanStatus === "failed" ? "Retry chairman" : "Run chairman" }}
          </button>
        </template>
      </div>
    </template>
  </div>
</template>
