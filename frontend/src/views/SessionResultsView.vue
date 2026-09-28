<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSessionsStore } from "../stores/sessions";
import type { PeerReview, PersonaVerdict } from "../stores/sessions";
import { api, type GraphData, type GraphNode } from "../lib/api";
import { personaLabel, RECOMMENDATION_COLOR, RECOMMENDATION_LABEL } from "../lib/personas";
import AppIcon, { type IconName } from "../components/AppIcon.vue";
import GraphCanvas from "../components/GraphCanvas.vue";
import PersonaAvatar from "../components/PersonaAvatar.vue";
import ScoreRing from "../components/ScoreRing.vue";

const props = defineProps<{ id: string }>();
const store = useSessionsStore();
const route = useRoute();
const router = useRouter();

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

const EVIDENCE_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Queued", tone: "" },
  running: { label: "Working…", tone: "accent" },
  complete: { label: "Extracted", tone: "success" },
  partial: { label: "Summary only", tone: "warn" },
  not_found: { label: "Nothing found", tone: "warn" },
  failed: { label: "Failed", tone: "danger" },
};

const session = computed(() => store.current?.session ?? {});
const sessionTitle = computed(() => (session.value.title as string) ?? "");
const createdAt = computed(() => (session.value.created_at as string | undefined) ?? null);
const eventType = computed(() => (session.value.event_type as string | null) ?? null);
const stageLabel = computed(() => (session.value.stage as string | null) ?? null);
const evidenceStatus = computed(() => (session.value.evidence_status as string) ?? "pending");
const evidenceError = computed(() => (session.value.evidence_error as string | null) ?? null);
/** How many personas this session runs (sessions from before persona selection have all 6). */
const personaCount = computed(() => (session.value.persona_keys as string[] | null)?.length ?? 6);
const chairmanStatus = computed(() => (session.value.chairman_status as string) ?? "pending");
const chairmanError = computed(() => (session.value.chairman_error as string | null) ?? null);
const chairman = computed(() => (chairmanStatus.value === "complete" ? (store.current?.chairmanVerdict ?? null) : null));

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const evidenceRequests = computed(() => store.current?.evidenceRequests ?? []);
const requesters = (e: { requested_by?: string[]; persona_key: string }) => (e.requested_by?.length ? e.requested_by : [e.persona_key]);
const documentsFor = (requestId: string) => (store.current?.evidenceDocuments ?? []).filter((d) => d.request_id === requestId);
const personaVerdicts = computed<PersonaVerdict[]>(() => store.current?.personaVerdicts ?? []);
const peerReviews = computed<PeerReview[]>(() => store.current?.peerReviews ?? []);

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The reviews one persona wrote, best rank first. */
const reviewsBy = (key: string) => peerReviews.value.filter((r) => r.reviewer_key === key).sort((a, b) => a.rank - b.rank);

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
const anyVerdictRunning = computed(() => personaVerdicts.value.some((v) => v.status === "pending" || v.status === "running"));
const anyVerdictFailed = computed(() => personaVerdicts.value.some((v) => v.status === "failed"));

/** Mean rank (1 = best) each persona received from the peers that ranked it. */
const averageRanking = computed(() => {
  const totals: Record<string, { sum: number; n: number }> = {};
  for (const r of peerReviews.value) {
    const t = (totals[r.reviewed_key] ??= { sum: 0, n: 0 });
    t.sum += r.rank;
    t.n += 1;
  }
  return Object.entries(totals)
    .map(([key, t]) => ({ key, avg: t.sum / t.n }))
    .sort((a, b) => a.avg - b.avg);
});
const avgRankOf = (key: string) => averageRanking.value.find((r) => r.key === key)?.avg ?? null;

// --- Stages --------------------------------------------------------------------------------------
// The four steps double as tabs. Each has a state so the stepper can show progress at a glance.

type StageState = "locked" | "ready" | "running" | "failed" | "done";
type TabKey = "evidence" | "verdicts" | "review" | "decision" | "graph";

const stages = computed<{ key: TabKey; n: number; label: string; icon: IconName; state: StageState; note: string }[]>(() => {
  const ev: StageState = evidenceBusy.value
    ? "running"
    : !evidenceStarted.value
      ? "ready"
      : evidenceReady.value
        ? "done"
        : "failed";
  const vd: StageState = !verdictsStarted.value
    ? evidenceReady.value
      ? "ready"
      : "locked"
    : anyVerdictRunning.value
      ? "running"
      : anyVerdictFailed.value
        ? "failed"
        : "done";
  const rv: StageState = !allPersonasComplete.value
    ? "locked"
    : anyReviewRunning.value
      ? "running"
      : allReviewsComplete.value
        ? "done"
        : anyReviewFailed.value
          ? "failed"
          : "ready";
  const ch: StageState = !allReviewsComplete.value
    ? "locked"
    : chairmanStatus.value === "running"
      ? "running"
      : chairmanStatus.value === "complete"
        ? "done"
        : chairmanStatus.value === "failed"
          ? "failed"
          : "ready";
  return [
    { key: "evidence", n: 1, label: "Evidence", icon: "evidence", state: ev, note: evidenceStatus.value === "skipped" ? "Skipped" : `${evidenceRequests.value.length} requests` },
    { key: "verdicts", n: 2, label: "Verdicts", icon: "users", state: vd, note: `${verdictsDone.value}/${personaCount.value} in` },
    { key: "review", n: 3, label: "Peer Review", icon: "scale", state: rv, note: `${reviewsDone.value}/${personaCount.value} in` },
    { key: "decision", n: 4, label: "Decision", icon: "gavel", state: ch, note: chairman.value ? RECOMMENDATION_LABEL[chairman.value.recommendation] : "Chairman" },
  ];
});

const STATE_LABEL: Record<StageState, string> = { locked: "Locked", ready: "Ready", running: "Running", failed: "Needs attention", done: "Done" };

/** The step that needs the user next: the first one that isn't done. */
const currentStage = computed<TabKey>(() => stages.value.find((s) => s.state !== "done")?.key ?? "decision");

const TAB_KEYS: TabKey[] = ["evidence", "verdicts", "review", "decision", "graph"];
const tabFromUrl = () => (TAB_KEYS.includes(route.query.tab as TabKey) ? (route.query.tab as TabKey) : null);
const tab = ref<TabKey | null>(tabFromUrl());
const activeTab = computed<TabKey>(() => tab.value ?? currentStage.value);
const tabEls: (HTMLElement | null)[] = [];
const setTabEl = (i: number) => (el: unknown) => {
  tabEls[i] = el as HTMLElement | null;
};

function selectTab(key: TabKey) {
  tab.value = key;
}

// Arrow keys move between tabs (WAI-ARIA tabs pattern); focus follows selection.
function onTabKey(e: KeyboardEvent) {
  // The graph tab is disabled until there are verdicts to draw.
  const keys = verdictsStarted.value ? TAB_KEYS : TAB_KEYS.slice(0, -1);
  const i = Math.max(0, keys.indexOf(activeTab.value));
  let next = -1;
  if (e.key === "ArrowRight") next = (i + 1) % keys.length;
  else if (e.key === "ArrowLeft") next = (i - 1 + keys.length) % keys.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = keys.length - 1;
  if (next < 0) return;
  e.preventDefault();
  selectTab(keys[next]);
  nextTick(() => tabEls[next]?.focus());
}

// --- Peer review insights ------------------------------------------------------------------------

const reviewedMembers = computed(() => personaVerdicts.value.map((v) => v.persona_key));
const rankCell = (reviewer: string, reviewed: string) => peerReviews.value.find((r) => r.reviewer_key === reviewer && r.reviewed_key === reviewed) ?? null;
/** Rank 1 gets the strongest tint, the worst rank the faintest. */
const cellTint = (rank: number) => {
  const worst = Math.max(personaVerdicts.value.length - 1, 1);
  const strength = 1 - (rank - 1) / Math.max(worst - 1, 1);
  return `color-mix(in srgb, var(--accent) ${Math.round(10 + strength * 45)}%, transparent)`;
};

/**
 * Score vs peer standing: where a member's own score of the idea sits among the council, compared with where
 * peers ranked their verdict. A large gap is the interesting story (e.g. the most bullish verdict ranked last).
 */
const standings = computed(() => {
  const done = personaVerdicts.value.filter((v) => v.status === "complete" && v.score != null);
  const byScore = [...done].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((v) => v.persona_key);
  const byRank = averageRanking.value.map((r) => r.key);
  const n = done.length;
  return done.map((v) => {
    const scorePos = byScore.indexOf(v.persona_key);
    const rankPos = byRank.indexOf(v.persona_key);
    const gap = rankPos >= 0 ? rankPos - scorePos : 0;
    let flag: string | null = null;
    if (n >= 3 && rankPos >= 0 && Math.abs(gap) >= Math.ceil(n / 2)) {
      flag = gap > 0 ? "Bullish, but peers weren’t convinced" : "Cautious, and peers backed it";
    }
    return { key: v.persona_key, score: v.score as number, avgRank: avgRankOf(v.persona_key), flag };
  });
});

// --- Graph ---------------------------------------------------------------------------------------
// The council graph is rebuilt server-side from stored rows (no model calls). It only reloads when
// something it shows changes, so the layout doesn't restart on every poll.
const graph = ref<GraphData | null>(null);
const graphError = ref<string | null>(null);
const graphSignature = computed(() =>
  [
    personaVerdicts.value.map((v) => `${v.persona_key}:${v.status}:${v.review_status}`).join(","),
    store.current?.evidenceRequests.map((e) => `${e.id}:${e.status}`).join(",") ?? "",
    peerReviews.value.length,
    chairmanStatus.value,
  ].join("|"),
);

// View state lives in the URL (?tab=, ?view=list, ?detail=reviews, ?node=<id>) so it survives reloads and can be shared.
const showReviewNodes = ref(route.query.detail === "reviews");
const graphMode = ref<"graph" | "list">(route.query.view === "list" ? "list" : "graph");
const selectedNodeId = ref<string | null>(typeof route.query.node === "string" ? route.query.node : null);
watch([tab, showReviewNodes, graphMode, selectedNodeId], () => {
  const query = { ...route.query };
  const set = (key: string, value: string | null) => {
    if (value) query[key] = value;
    else delete query[key];
  };
  set("tab", tab.value);
  set("detail", showReviewNodes.value ? "reviews" : null);
  set("view", graphMode.value === "list" ? "list" : null);
  set("node", selectedNodeId.value);
  router.replace({ query });
});

/** Text equivalent of the graph: one row per member with score, average rank received and evidence asked for. */
const listRows = computed(() =>
  personaVerdicts.value.map((v) => ({
    key: v.persona_key,
    name: personaLabel(v.persona_key),
    score: v.status === "complete" ? v.score : null,
    status: v.status,
    avgRank: avgRankOf(v.persona_key),
    evidence: evidenceRequests.value.filter((e) => requesters(e).includes(v.persona_key)).length,
  })),
);
// Looked up in the current graph so the panel stays in sync when the graph reloads.
const selectedNode = computed<GraphNode | null>(() => graph.value?.nodes.find((n) => n.id === selectedNodeId.value) ?? null);
/** A member node carries no text of its own, so the panel shows that member's verdict. */
const selectedDetail = computed(() => {
  const n = selectedNode.value;
  const v = n?.kind === "persona" ? personaVerdicts.value.find((x) => `persona:${x.persona_key}` === n.id) : undefined;
  return {
    text: v?.verdict_text ?? n?.text ?? null,
    strengths: v?.strengths ?? n?.strengths ?? [],
    concerns: v?.concerns ?? n?.concerns ?? [],
  };
});
const selectedAvgRank = computed(() => (selectedNode.value?.kind === "persona" ? avgRankOf(selectedNode.value.id.split(":")[1]) : null));
const onGraphSelect = (node: GraphNode | null) => {
  selectedNodeId.value = node?.id ?? null;
};

async function loadGraph() {
  try {
    graph.value = await api.getSessionGraph(props.id, { reviewNodes: showReviewNodes.value });
    graphError.value = null;
  } catch (err) {
    graphError.value = (err as Error).message;
  }
}

watch(showReviewNodes, loadGraph);
watch(graphSignature, () => {
  if (personaVerdicts.value.length > 0) loadGraph();
});

function isInFlight() {
  return anyVerdictRunning.value || anyReviewRunning.value || chairmanStatus.value === "running" || evidenceBusy.value;
}

onMounted(async () => {
  // A tiny graph is harder to use than a table, so phones start on the list unless the URL says otherwise.
  if (!route.query.view && window.matchMedia("(max-width: 480px)").matches) graphMode.value = "list";
  await store.fetchOne(props.id);
  if (personaVerdicts.value.length > 0) loadGraph();
  timer = setInterval(() => {
    if (isInFlight()) store.fetchOne(props.id, { silent: true });
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="page wide">
    <p v-if="store.loading" class="muted">Loading…</p>
    <div v-else-if="store.error" class="callout danger">
      <p>Couldn’t load this session: {{ store.error }}. Reload the page to try again.</p>
    </div>

    <template v-else-if="store.current">
      <!-- Header -->
      <header class="session-head">
        <div class="head-main">
          <p class="eyebrow"><AppIcon name="file" :size="13" /> Judging session</p>
          <h1 class="page-title">{{ sessionTitle }}</h1>
          <ul class="meta">
            <li v-if="createdAt" class="num">{{ dateFormat.format(new Date(createdAt)) }}</li>
            <li>{{ personaCount }} members</li>
            <li v-if="eventType">{{ eventType }}</li>
            <li v-if="stageLabel">{{ stageLabel }}</li>
          </ul>
        </div>

        <div v-if="chairman" class="verdict-chip" :style="{ '--rec': RECOMMENDATION_COLOR[chairman.recommendation] }">
          <ScoreRing :score="chairman.overall_score" :size="52" :color="RECOMMENDATION_COLOR[chairman.recommendation]" label="Overall score" />
          <span class="chip-text">
            <span class="verdict-kicker">Council says</span>
            <strong class="verdict-word">{{ RECOMMENDATION_LABEL[chairman.recommendation] }}</strong>
          </span>
        </div>
      </header>

      <div v-if="actionError" class="callout danger action-error" role="alert">
        <AppIcon name="alert" :size="16" />
        <p>{{ actionError }}</p>
      </div>

      <!-- Stepper tabs -->
      <div class="stepper" role="tablist" aria-label="Session stages" @keydown="onTabKey">
        <button
          v-for="(s, i) in stages"
          :id="`tab-${s.key}`"
          :key="s.key"
          :ref="setTabEl(i)"
          type="button"
          role="tab"
          class="step"
          :class="[s.state, { active: activeTab === s.key, current: currentStage === s.key }]"
          :aria-selected="activeTab === s.key"
          :aria-controls="`panel-${s.key}`"
          :tabindex="activeTab === s.key ? 0 : -1"
          @click="selectTab(s.key)"
        >
          <span class="step-badge" aria-hidden="true">
            <AppIcon v-if="s.state === 'done'" name="check" :size="14" />
            <AppIcon v-else-if="s.state === 'locked'" name="lock" :size="12" />
            <AppIcon v-else-if="s.state === 'failed'" name="alert" :size="13" />
            <span v-else>{{ s.n }}</span>
          </span>
          <span class="step-text">
            <span class="step-label">{{ s.label }}</span>
            <span class="step-note">{{ STATE_LABEL[s.state] }} · {{ s.note }}</span>
          </span>
          <span v-if="i < stages.length - 1" class="step-line" aria-hidden="true" />
        </button>
        <button
          id="tab-graph"
          :ref="setTabEl(4)"
          type="button"
          role="tab"
          class="step graph-tab"
          :class="{ active: activeTab === 'graph' }"
          :aria-selected="activeTab === 'graph'"
          aria-controls="panel-graph"
          :tabindex="activeTab === 'graph' ? 0 : -1"
          :disabled="!verdictsStarted"
          @click="selectTab('graph')"
        >
          <span class="step-badge" aria-hidden="true"><AppIcon name="graph" :size="14" /></span>
          <span class="step-text">
            <span class="step-label">Graph</span>
            <span class="step-note">{{ verdictsStarted ? "Explore" : "After verdicts" }}</span>
          </span>
        </button>
      </div>

      <!-- 1. Evidence -->
      <section v-if="activeTab === 'evidence'" id="panel-evidence" role="tabpanel" aria-labelledby="tab-evidence" class="tab-panel">
        <div class="stage-intro">
          <div>
            <h2 class="panel-title">Gather evidence</h2>
            <p class="muted">Each council member lists the documents it needs, and the clerk finds, downloads and reads them.</p>
          </div>
          <button v-if="!evidenceStarted" type="button" class="btn" :disabled="busy === 'gather'" @click="startGathering">
            <AppIcon name="play" :size="14" /> {{ busy === "gather" ? "Starting…" : "Start Gathering Evidence" }}
          </button>
          <button
            v-else-if="!verdictsStarted && evidenceStopped && evidenceStatus === 'failed' && evidenceRequests.length === 0"
            type="button"
            class="btn btn-secondary"
            :disabled="busy === 'gather'"
            @click="startGathering"
          >
            <AppIcon name="retry" :size="14" /> {{ busy === "gather" ? "Starting…" : "Run Step 1 Again" }}
          </button>
          <button v-else-if="evidenceReady && !verdictsStarted" type="button" class="btn" @click="selectTab('verdicts')">
            Continue to Verdicts <AppIcon name="chevron" :size="14" />
          </button>
        </div>

        <div v-if="evidenceBusy" class="callout" role="status"><p>Working… requests are searched, downloaded and read in parallel.</p></div>
        <div v-if="evidenceError" class="callout danger"><p>{{ evidenceError }}</p></div>
        <div v-if="evidenceStatus === 'skipped'" class="callout"><p>Evidence gathering is turned off in Settings (0 requests per persona).</p></div>
        <div v-else-if="evidenceStatus === 'complete' && evidenceRequests.length === 0 && !evidenceError" class="empty-state">
          <p>No council member asked for outside evidence.</p>
        </div>
        <div v-if="!verdictsStarted && evidenceStopped && evidenceProblems > 0" class="callout warn">
          <p>{{ evidenceProblems }} request(s) came back empty or failed. Retry them before continuing, or they’ll be missing from the evidence the council argues from.</p>
        </div>

        <div v-if="!evidenceStarted" class="empty-state">
          <AppIcon name="evidence" :size="28" />
          <p>Nothing gathered yet. Start step 1 and each member will ask for the facts it needs.</p>
        </div>

        <ul v-else class="evidence-list">
          <li v-for="e in evidenceRequests" :key="e.id" class="evidence-card" :class="e.status">
            <div class="evidence-top">
              <span class="avatars">
                <PersonaAvatar v-for="k in requesters(e)" :key="k" :persona-key="k" :size="24" />
              </span>
              <span class="requested-by">{{ requesters(e).map(personaLabel).join(", ") }}</span>
              <span :class="['tag', EVIDENCE_STATUS[e.status]?.tone]">
                <span v-if="e.status === 'running'" class="pulse" aria-hidden="true" />
                {{ EVIDENCE_STATUS[e.status]?.label ?? e.status }}
              </span>
            </div>
            <p class="evidence-ask">
              <template v-if="e.kind === 'document'">{{ e.description }}</template>
              <template v-else>Couldn’t list its requests.</template>
            </p>
            <p v-if="e.summary" class="evidence-summary">{{ e.summary }}</p>
            <p v-if="e.note" class="muted">{{ e.note }}</p>
            <p v-if="e.error_message" class="error-text">{{ e.error_message }}</p>

            <ul v-if="e.sources?.length" class="sources">
              <li v-for="src in e.sources" :key="src.url">
                <a :href="src.url" target="_blank" rel="noopener noreferrer">
                  <AppIcon name="external" :size="12" />
                  <span class="src-title">{{ src.title }}</span>
                  <span class="src-domain">{{ domainOf(src.url) }}</span>
                </a>
                <span v-for="d in documentsFor(e.id).filter((x) => x.url === src.url || x.title === src.title)" :key="d.id" class="src-state" :class="d.fetch_status">
                  {{ d.fetch_status === "fetched" ? "Downloaded" : `Not downloaded: ${d.error_message}` }}
                </span>
              </li>
            </ul>

            <button
              v-if="!verdictsStarted && e.status !== 'complete' && e.status !== 'running' && e.status !== 'pending'"
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="busy === `evidence:${e.id}`"
              @click="retryEvidence(e.id)"
            >
              <AppIcon name="retry" :size="13" /> {{ busy === `evidence:${e.id}` ? "Retrying…" : "Retry" }}
            </button>
          </li>
        </ul>
      </section>

      <!-- 2. Verdicts -->
      <section v-if="activeTab === 'verdicts'" id="panel-verdicts" role="tabpanel" aria-labelledby="tab-verdicts" class="tab-panel">
        <div class="stage-intro">
          <div>
            <h2 class="panel-title">Initial verdicts</h2>
            <p class="muted">Each member scores the submission independently, using the evidence it requested.</p>
          </div>
          <button v-if="evidenceReady && !verdictsStarted" type="button" class="btn" :disabled="busy === 'verdicts'" @click="startVerdicts">
            <AppIcon name="play" :size="14" /> {{ busy === "verdicts" ? "Starting…" : "Get Initial Verdicts" }}
          </button>
          <button v-else-if="allPersonasComplete && !reviewStarted" type="button" class="btn" @click="selectTab('review')">
            Continue to Peer Review <AppIcon name="chevron" :size="14" />
          </button>
        </div>

        <div v-if="!evidenceReady && !verdictsStarted" class="empty-state">
          <AppIcon name="lock" :size="24" />
          <p>Available once step 1 has finished successfully.</p>
          <button type="button" class="btn btn-secondary btn-sm" @click="selectTab('evidence')">Go to Evidence</button>
        </div>
        <div v-else-if="!verdictsStarted" class="empty-state">
          <AppIcon name="users" :size="28" />
          <p>This makes {{ personaCount }} model calls, one per member.</p>
        </div>

        <template v-else>
          <div class="progress" role="progressbar" :aria-valuenow="verdictsDone" aria-valuemin="0" :aria-valuemax="personaCount" aria-label="Verdicts complete">
            <span :style="{ width: `${(verdictsDone / personaCount) * 100}%` }" />
          </div>

          <div class="verdict-grid">
            <article v-for="v in personaVerdicts" :key="v.persona_key" class="verdict-card" :class="v.status">
              <header class="verdict-head">
                <PersonaAvatar :persona-key="v.persona_key" :size="36" />
                <div class="verdict-who">
                  <h3>{{ personaLabel(v.persona_key) }}</h3>
                  <span v-if="v.model_id" class="model" translate="no">{{ v.model_id }}</span>
                </div>
                <ScoreRing v-if="v.status === 'complete'" :score="v.score" :size="44" :label="`${personaLabel(v.persona_key)} score`" />
                <span v-else-if="v.status === 'failed'" class="tag danger">Failed</span>
                <span v-else class="tag accent"><span class="pulse" aria-hidden="true" />Thinking…</span>
              </header>

              <template v-if="v.status === 'complete'">
                <p class="verdict-text">{{ v.verdict_text }}</p>
                <div v-if="v.strengths?.length || v.concerns?.length" class="pro-con">
                  <div v-if="v.strengths?.length">
                    <h4 class="pc-title pro">Strengths</h4>
                    <ul>
                      <li v-for="s in v.strengths" :key="s">{{ s }}</li>
                    </ul>
                  </div>
                  <div v-if="v.concerns?.length">
                    <h4 class="pc-title con">Concerns</h4>
                    <ul>
                      <li v-for="c in v.concerns" :key="c">{{ c }}</li>
                    </ul>
                  </div>
                </div>
              </template>
              <template v-else-if="v.status === 'failed'">
                <p class="error-text">{{ v.error_message }}</p>
                <button type="button" class="btn btn-secondary btn-sm" :disabled="busy === `persona:${v.persona_key}`" @click="retryPersona(v.persona_key)">
                  <AppIcon name="retry" :size="13" /> {{ busy === `persona:${v.persona_key}` ? "Retrying…" : "Retry" }}
                </button>
              </template>
              <div v-else class="skeleton" aria-hidden="true"><span /><span /><span /></div>
            </article>
          </div>
        </template>
      </section>

      <!-- 3. Peer review -->
      <section v-if="activeTab === 'review'" id="panel-review" role="tabpanel" aria-labelledby="tab-review" class="tab-panel">
        <div class="stage-intro">
          <div>
            <h2 class="panel-title">Anonymous peer review</h2>
            <p class="muted">Each member reads the others’ verdicts with names hidden, then critiques and ranks them.</p>
          </div>
          <button v-if="allPersonasComplete && !anyReviewRunning && !allReviewsComplete" type="button" class="btn" :disabled="busy === 'review'" @click="startReview">
            <AppIcon :name="reviewStarted ? 'retry' : 'play'" :size="14" />
            {{ busy === "review" ? "Starting…" : reviewStarted ? "Run Remaining Reviews" : "Start Peer Review" }}
          </button>
          <button v-else-if="allReviewsComplete && chairmanStatus === 'pending'" type="button" class="btn" @click="selectTab('decision')">
            Continue to Decision <AppIcon name="chevron" :size="14" />
          </button>
        </div>

        <div v-if="!allPersonasComplete" class="empty-state">
          <AppIcon name="lock" :size="24" />
          <p>Available once all {{ personaCount }} initial verdicts are in.</p>
        </div>
        <template v-else>
          <div v-if="anyReviewRunning" class="callout" role="status">
            <p>Council members are reviewing each other’s verdicts anonymously… ({{ reviewsDone }}/{{ personaCount }} done)</p>
          </div>
          <div v-else-if="anyReviewFailed" class="callout danger">
            <p>Some reviews failed. Retry them below, or run the remaining ones again.</p>
          </div>
          <div v-else-if="!reviewStarted" class="empty-state">
            <AppIcon name="scale" :size="28" />
            <p>This makes {{ personaCount }} more model calls, one per member.</p>
          </div>

          <div v-if="peerReviews.length" class="review-layout">
            <div class="panel">
              <div class="panel-head">
                <h3 class="panel-title">Ranking matrix</h3>
                <span class="muted small">Rows ranked columns · 1 = best</span>
              </div>
              <div class="matrix-wrap">
                <table class="matrix">
                  <caption class="sr-only">How each reviewer ranked each other member’s verdict. 1 is best.</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span class="sr-only">Reviewer</span></th>
                      <th v-for="k in reviewedMembers" :key="k" scope="col" :title="personaLabel(k)">
                        <PersonaAvatar :persona-key="k" :size="26" />
                        <span class="sr-only">{{ personaLabel(k) }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="reviewer in reviewedMembers" :key="reviewer">
                      <th scope="row">
                        <span class="row-head"><PersonaAvatar :persona-key="reviewer" :size="22" />{{ personaLabel(reviewer) }}</span>
                      </th>
                      <td v-for="k in reviewedMembers" :key="k" class="num">
                        <span v-if="k === reviewer" class="self" aria-label="Own verdict, not ranked">—</span>
                        <span v-else-if="rankCell(reviewer, k)" class="rank" :style="{ background: cellTint(rankCell(reviewer, k)!.rank) }" :title="rankCell(reviewer, k)!.critique ?? undefined">
                          {{ rankCell(reviewer, k)!.rank }}
                        </span>
                        <span v-else class="self">·</span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Average</th>
                      <td v-for="k in reviewedMembers" :key="k" class="num avg">{{ avgRankOf(k)?.toFixed(1) ?? "–" }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head">
                <h3 class="panel-title">Score vs. peer standing</h3>
              </div>
              <p class="muted small">How bullish each member was, against how convincing peers found their verdict. Big gaps are worth a closer read.</p>
              <ul class="standings">
                <li v-for="s in standings" :key="s.key" :class="{ flagged: s.flag }">
                  <span class="st-name"><PersonaAvatar :persona-key="s.key" :size="22" />{{ personaLabel(s.key) }}</span>
                  <span class="st-bar" aria-hidden="true"><span :style="{ width: `${s.score * 10}%` }" /></span>
                  <span class="st-score num">{{ s.score }}/10</span>
                  <span class="st-rank num">{{ s.avgRank != null ? `#${s.avgRank.toFixed(1)}` : "–" }}</span>
                  <span v-if="s.flag" class="st-flag"><AppIcon name="alert" :size="12" /> {{ s.flag }}</span>
                </li>
              </ul>
            </div>
          </div>

          <h3 v-if="reviewStarted" class="section-title critiques-title">Critiques by reviewer</h3>
          <div class="critique-list">
            <details v-for="v in personaVerdicts.filter((x) => x.review_status !== 'pending')" :key="v.persona_key" class="critique" :open="v.review_status === 'failed'">
              <summary>
                <PersonaAvatar :persona-key="v.persona_key" :size="24" />
                <span class="crit-name">{{ personaLabel(v.persona_key) }}’s review</span>
                <span v-if="v.review_status === 'running'" class="tag accent"><span class="pulse" aria-hidden="true" />Reviewing…</span>
                <span v-else-if="v.review_status === 'failed'" class="tag danger">Failed</span>
                <span v-else class="tag">{{ reviewsBy(v.persona_key).length }} ranked</span>
                <AppIcon name="chevron" :size="14" class="chev" />
              </summary>
              <template v-if="v.review_status === 'complete'">
                <ol class="crit-items">
                  <li v-for="r in reviewsBy(v.persona_key)" :key="r.reviewed_key">
                    <span class="crit-rank num">#{{ r.rank }}</span>
                    <div>
                      <strong>{{ personaLabel(r.reviewed_key) }}</strong>
                      <p v-if="r.critique">{{ r.critique }}</p>
                    </div>
                  </li>
                </ol>
              </template>
              <div v-else-if="v.review_status === 'failed'" class="crit-failed">
                <p class="error-text">{{ v.review_error }}</p>
                <button type="button" class="btn btn-secondary btn-sm" :disabled="busy === `review:${v.persona_key}`" @click="retryReview(v.persona_key)">
                  <AppIcon name="retry" :size="13" /> {{ busy === `review:${v.persona_key}` ? "Retrying…" : "Retry Review" }}
                </button>
              </div>
            </details>
          </div>
        </template>
      </section>

      <!-- 4. Decision -->
      <section v-if="activeTab === 'decision'" id="panel-decision" role="tabpanel" aria-labelledby="tab-decision" class="tab-panel">
        <div v-if="chairman" class="decision" :style="{ '--rec': RECOMMENDATION_COLOR[chairman.recommendation] }">
          <div class="decision-hero">
            <ScoreRing :score="chairman.overall_score" :size="96" :color="RECOMMENDATION_COLOR[chairman.recommendation]" label="Overall score" />
            <div>
              <p class="eyebrow">Chairman’s decision</p>
              <p class="decision-word">{{ RECOMMENDATION_LABEL[chairman.recommendation] }}</p>
              <p class="muted small" translate="no">{{ chairman.model_id }}</p>
            </div>
          </div>
          <p class="decision-text">{{ chairman.final_verdict_text }}</p>

          <h3 class="section-title">How the council voted</h3>
          <ul class="scoreboard">
            <li v-for="v in personaVerdicts" :key="v.persona_key">
              <PersonaAvatar :persona-key="v.persona_key" :size="28" />
              <span class="sb-name">{{ personaLabel(v.persona_key) }}</span>
              <span class="sb-bar" aria-hidden="true"><span :style="{ width: `${(v.score ?? 0) * 10}%` }" /></span>
              <span class="num sb-score">{{ v.score ?? "–" }}/10</span>
            </li>
          </ul>
          <button type="button" class="btn btn-secondary" @click="selectTab('graph')"><AppIcon name="graph" :size="14" /> Explore the Council Graph</button>
        </div>

        <template v-else>
          <div class="stage-intro">
            <div>
              <h2 class="panel-title">Chairman’s decision</h2>
              <p class="muted">The chairman weighs the verdicts, evidence and peer reviews into a final call: Fund, Iterate or Pass.</p>
            </div>
            <button v-if="allReviewsComplete && chairmanStatus !== 'running'" type="button" class="btn" :disabled="busy === 'chairman'" @click="runChairman">
              <AppIcon :name="chairmanStatus === 'failed' ? 'retry' : 'gavel'" :size="14" />
              {{ busy === "chairman" ? "Running…" : chairmanStatus === "failed" ? "Retry Chairman" : "Ask the Chairman" }}
            </button>
          </div>
          <div v-if="chairmanStatus === 'running'" class="callout" role="status"><p>The chairman is weighing everything…</p></div>
          <div v-else-if="chairmanStatus === 'failed'" class="callout danger"><p>Chairman failed: {{ chairmanError }}</p></div>
          <div v-if="!allReviewsComplete" class="empty-state">
            <AppIcon name="lock" :size="24" />
            <p>Available once all verdicts and peer reviews are complete.</p>
          </div>
        </template>
      </section>

      <!-- Graph -->
      <section v-if="activeTab === 'graph'" id="panel-graph" role="tabpanel" aria-labelledby="tab-graph" class="tab-panel">
        <div class="stage-intro">
          <div>
            <h2 class="panel-title">Council graph</h2>
            <p class="muted">Purple dots are members (bigger = higher score); lines are peer rankings (thicker = ranked higher). Hover to preview, click to read.</p>
          </div>
          <div class="segmented" role="group" aria-label="Graph view">
            <button type="button" :aria-pressed="graphMode === 'graph'" @click="graphMode = 'graph'">Graph</button>
            <button type="button" :aria-pressed="graphMode === 'list'" @click="graphMode = 'list'">List</button>
          </div>
        </div>

        <div v-if="graphError" class="callout danger"><p>Couldn’t load the graph: {{ graphError }}. Reload the page to try again.</p></div>
        <div v-else class="graph-layout">
          <template v-if="graphMode === 'graph'">
            <GraphCanvas v-if="graph" v-model:review-nodes="showReviewNodes" :graph="graph" :selected-id="selectedNodeId" :height="560" @select="onGraphSelect" />
            <p v-else class="muted graph-loading">Loading graph…</p>
          </template>
          <div v-else class="panel table-wrap">
            <table class="list-table">
              <caption class="sr-only">Council members with score, average peer rank and evidence requested</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col" class="num">Score</th>
                  <th scope="col" class="num">Avg. Rank</th>
                  <th scope="col" class="num">Evidence</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in listRows" :key="r.key">
                  <th scope="row">
                    <button type="button" class="link-btn member-link" @click="selectedNodeId = `persona:${r.key}`">
                      <PersonaAvatar :persona-key="r.key" :size="22" />{{ r.name }}
                    </button>
                  </th>
                  <td class="num">{{ r.score != null ? `${r.score}/10` : r.status }}</td>
                  <td class="num">{{ r.avgRank != null ? r.avgRank.toFixed(1) : "–" }}</td>
                  <td class="num">{{ r.evidence }}</td>
                </tr>
              </tbody>
            </table>
            <p class="muted small">Average rank comes from the anonymous peer review; 1 is best.</p>
          </div>

          <aside class="node-detail" aria-live="polite" aria-label="Selected node">
            <template v-if="!selectedNode">
              <p class="detail-kicker">Nothing selected</p>
              <p class="muted">
                Select a member, a verdict, the chairman or a review to read it here. Look for members whose own score and peer rank disagree: that’s
                usually where the interesting story is.
              </p>
            </template>
            <template v-else>
              <p class="detail-kicker">{{ selectedNode.kind.replace("_", " ") }}</p>
              <h3 class="detail-title">{{ selectedNode.title ?? selectedNode.label }}</h3>
              <dl class="facts">
                <template v-if="selectedNode.score != null">
                  <dt>Score</dt>
                  <dd>{{ selectedNode.score }}/10</dd>
                </template>
                <template v-if="selectedAvgRank != null">
                  <dt>Avg. peer rank</dt>
                  <dd>{{ selectedAvgRank.toFixed(1) }}</dd>
                </template>
                <template v-if="selectedNode.rank">
                  <dt>Rank given</dt>
                  <dd>#{{ selectedNode.rank }}</dd>
                </template>
                <template v-if="selectedNode.recommendation">
                  <dt>Recommendation</dt>
                  <dd>
                    <span class="tag" :style="{ borderColor: RECOMMENDATION_COLOR[selectedNode.recommendation], color: RECOMMENDATION_COLOR[selectedNode.recommendation] }">
                      {{ RECOMMENDATION_LABEL[selectedNode.recommendation] ?? selectedNode.recommendation }}
                    </span>
                  </dd>
                </template>
              </dl>
              <p v-if="selectedNode.subtitle" class="muted">{{ selectedNode.subtitle }}</p>
              <p v-if="selectedDetail.text" class="detail-text">{{ selectedDetail.text }}</p>
              <p v-else-if="selectedNode.kind === 'persona' || selectedNode.kind === 'chairman' || selectedNode.kind === 'verdict'" class="muted">No verdict yet.</p>
              <p v-else-if="selectedNode.kind === 'review'" class="muted">No critique recorded for this review.</p>
              <div v-if="selectedDetail.strengths.length">
                <h4 class="pc-title pro">Strengths</h4>
                <ul>
                  <li v-for="s in selectedDetail.strengths" :key="s">{{ s }}</li>
                </ul>
              </div>
              <div v-if="selectedDetail.concerns.length">
                <h4 class="pc-title con">Concerns</h4>
                <ul>
                  <li v-for="c in selectedDetail.concerns" :key="c">{{ c }}</li>
                </ul>
              </div>
              <div class="detail-actions">
                <button v-if="selectedNode.kind === 'persona' || selectedNode.kind === 'verdict'" type="button" class="btn btn-secondary btn-sm" @click="selectTab('verdicts')">
                  Open in Verdicts
                </button>
                <button type="button" class="btn btn-ghost btn-sm" @click="selectedNodeId = null">Clear Selection</button>
              </div>
            </template>
          </aside>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.small {
  font-size: 0.8rem;
}

/* --- Header --- */
.session-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.head-main {
  min-width: 0;
}
.head-main .page-title {
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
  font-size: 0.84rem;
}
.meta li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
/* Dots sit before each item (not between), so a wrapped line never starts with a stray separator. */
.meta li + li::before {
  content: "";
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--border-strong);
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.verdict-chip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
  padding: 0.6rem 1rem 0.6rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--rec) 45%, var(--border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--rec) 10%, var(--surface));
}
.chip-text {
  display: flex;
  flex-direction: column;
}
.verdict-kicker {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.verdict-word {
  font-size: 1.35rem;
  color: var(--rec);
}
.action-error {
  margin-bottom: 1rem;
}

/* --- Stepper --- */
.stepper {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--chrome);
  overflow-x: auto;
}
.step {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1 1 0;
  min-width: 150px;
  padding: 0.55rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--fg-soft);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.step:hover:not(:disabled) {
  background: var(--hover);
  color: var(--fg);
}
.step.active {
  background: var(--surface-raised);
  border-color: var(--border-strong);
  color: var(--fg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
}
.step:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.graph-tab {
  flex: 0 1 auto;
  min-width: 120px;
  margin-left: auto;
}
.step-badge {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
}
.step.ready .step-badge,
.step.current .step-badge {
  border-color: var(--accent);
  color: var(--accent);
}
.step.running .step-badge {
  border-color: var(--accent);
  color: var(--accent);
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}
.step.running .step-badge > * {
  animation: spin 1s linear infinite reverse;
}
.step.done .step-badge {
  background: var(--success);
  border-color: var(--success);
  color: #0d1f13;
}
.step.failed .step-badge {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}
.step-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.step-label {
  font-weight: 600;
  font-size: 0.88rem;
}
.step-note {
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step.failed .step-note {
  color: var(--danger);
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* --- Panels shared --- */
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.stage-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
.stage-intro .panel-title {
  font-size: 1.15rem;
  margin-bottom: 0.2rem;
}
.stage-intro p {
  margin: 0;
  max-width: 64ch;
}
.stage-intro .btn {
  flex-shrink: 0;
}

/* --- Evidence --- */
.evidence-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.evidence-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.evidence-card.failed {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}
.evidence-card > .btn {
  align-self: flex-start;
}
.evidence-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.avatars {
  display: flex;
}
.avatars > * + * {
  margin-left: -6px;
}
.requested-by {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.evidence-ask {
  margin: 0;
  font-weight: 600;
  font-size: 0.93rem;
  overflow-wrap: anywhere;
}
.evidence-summary {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-soft);
  overflow-wrap: anywhere;
}
.evidence-card p {
  margin: 0;
}
.sources {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0.6rem 0 0;
  border-top: 1px solid var(--border);
  list-style: none;
  font-size: 0.8rem;
}
.sources a {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}
.src-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.src-domain {
  flex-shrink: 0;
  color: var(--muted);
}
.src-state {
  display: block;
  padding-left: 1.1rem;
  color: var(--muted);
  font-size: 0.74rem;
}
.src-state.failed {
  color: var(--warn);
}

/* --- Verdicts --- */
.progress {
  height: 4px;
  border-radius: 999px;
  background: var(--hover);
  overflow: hidden;
}
.progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
  transition: width 400ms ease;
}
.verdict-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.75rem;
}
.verdict-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.verdict-card.failed {
  border-color: color-mix(in srgb, var(--danger) 40%, var(--border));
}
.verdict-card > .btn {
  align-self: flex-start;
}
.verdict-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.verdict-who {
  flex: 1;
  min-width: 0;
}
.verdict-who h3 {
  margin: 0;
  font-size: 0.98rem;
}
.model {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.verdict-text {
  margin: 0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.pro-con {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}
.pro-con ul,
.node-detail ul {
  margin: 0.3rem 0 0;
  padding-left: 1.05rem;
  font-size: 0.84rem;
  color: var(--fg-soft);
}
.pro-con li + li {
  margin-top: 0.25rem;
}
.pc-title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.pc-title.pro {
  color: var(--success);
}
.pc-title.con {
  color: var(--warn);
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.skeleton span {
  height: 10px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--hover), var(--surface-raised), var(--hover));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton span:nth-child(2) {
  width: 85%;
}
.skeleton span:nth-child(3) {
  width: 60%;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* --- Peer review --- */
.review-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}
.review-layout .panel + .panel {
  margin-top: 0;
}
.matrix-wrap {
  overflow-x: auto;
}
.matrix {
  border-collapse: separate;
  border-spacing: 4px;
  font-size: 0.84rem;
}
.matrix th {
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}
.matrix thead th {
  text-align: center;
}
.row-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding-right: 0.5rem;
}
.matrix td {
  text-align: center;
}
.rank,
.self {
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  margin: 0 auto;
  border-radius: 6px;
  font-weight: 650;
}
.self {
  color: var(--muted);
  background: var(--hover);
  opacity: 0.5;
}
.matrix tfoot th {
  color: var(--muted);
  padding-top: 0.35rem;
}
.avg {
  padding-top: 0.35rem;
  color: var(--fg);
  font-weight: 650;
}
.standings {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.84rem;
}
.standings li {
  display: grid;
  grid-template-columns: minmax(0, 10rem) 1fr auto auto;
  align-items: center;
  gap: 0.6rem;
}
.st-name {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-bar,
.sb-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--hover);
  overflow: hidden;
}
.st-bar span,
.sb-bar span {
  display: block;
  height: 100%;
  background: var(--graph-persona);
  border-radius: inherit;
}
.st-score {
  width: 3.2rem;
  text-align: right;
}
.st-rank {
  width: 2.8rem;
  text-align: right;
  color: var(--muted);
}
.st-flag {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: -0.3rem;
  padding-left: 1.85rem;
  color: var(--warn);
  font-size: 0.76rem;
}
.critiques-title {
  margin: 0.5rem 0 0;
}
.critique-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.critique {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.critique summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.9rem;
  cursor: pointer;
  list-style: none;
  border-radius: 10px;
}
.critique summary::-webkit-details-marker {
  display: none;
}
.critique summary:hover {
  background: var(--hover);
}
.crit-name {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
}
.chev {
  color: var(--muted);
  transition: transform 150ms ease;
}
.critique[open] .chev {
  transform: rotate(90deg);
}
.crit-items {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0.25rem 0.9rem 0.9rem;
  list-style: none;
}
.crit-items li {
  display: flex;
  gap: 0.7rem;
  font-size: 0.87rem;
}
.crit-items p {
  margin: 0.15rem 0 0;
  color: var(--fg-soft);
}
.crit-rank {
  flex-shrink: 0;
  width: 2rem;
  color: var(--accent);
  font-weight: 700;
}
.crit-failed {
  padding: 0 0.9rem 0.9rem;
}
.crit-failed p {
  margin: 0 0 0.5rem;
}

/* --- Decision --- */
.decision {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 820px;
}
.decision > .btn {
  align-self: flex-start;
}
.decision-hero {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid color-mix(in srgb, var(--rec) 45%, var(--border));
  border-radius: 14px;
  background: radial-gradient(circle at 0% 50%, color-mix(in srgb, var(--rec) 16%, transparent), transparent 60%), var(--surface);
}
.decision-hero p {
  margin: 0;
}
.decision-hero .eyebrow {
  color: var(--muted);
}
.decision-word {
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--rec);
}
.decision-text {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.scoreboard {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: -0.5rem 0 0;
  padding: 0;
  list-style: none;
}
.scoreboard li {
  display: grid;
  grid-template-columns: auto minmax(0, 13rem) 1fr 3.5rem;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.88rem;
}
.sb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-score {
  text-align: right;
  font-weight: 650;
}

/* --- Graph --- */
.segmented {
  display: flex;
  flex-shrink: 0;
  padding: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.segmented button {
  padding: 0.3rem 0.8rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.segmented button:hover,
.segmented button[aria-pressed="true"] {
  background: var(--hover);
  color: var(--fg);
}
.graph-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}
.graph-loading {
  display: grid;
  place-items: center;
  height: 560px;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--graph-bg);
}
.node-detail {
  max-height: 560px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1rem 1.1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.9rem;
}
.detail-kicker {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--accent);
}
.detail-title {
  margin: 0 0 0.6rem;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.detail-text {
  overflow-wrap: anywhere;
}
.node-detail > div {
  margin-bottom: 0.75rem;
}
.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.75rem;
  margin: 0 0 0.75rem;
  font-variant-numeric: tabular-nums;
}
.facts dt {
  color: var(--muted);
}
.facts dd {
  margin: 0;
}
.table-wrap {
  overflow-x: auto;
}
.list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.list-table th,
.list-table td {
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.list-table thead th {
  color: var(--muted);
  font-weight: 500;
  font-size: 0.8rem;
}
.list-table .num {
  text-align: right;
}
.member-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--fg);
  font-weight: 550;
}

/* --- Responsive --- */
@media (max-width: 1100px) {
  .review-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 960px) {
  .graph-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .node-detail {
    max-height: none;
  }
}
@media (max-width: 700px) {
  .session-head,
  .stage-intro {
    flex-direction: column;
    align-items: stretch;
  }
  .verdict-chip {
    align-self: flex-start;
  }
  .stage-intro .btn {
    align-self: flex-start;
  }
  /* Phones: a compact, scrollable strip of badge + label; the state is still in the badge icon. */
  .step,
  .graph-tab {
    flex: 0 0 auto;
    min-width: 0;
    margin-left: 0;
  }
  .step-label {
    white-space: nowrap;
  }
  .step-note {
    display: none;
  }
  .verdict-grid,
  .evidence-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .pro-con {
    grid-template-columns: 1fr;
  }
  .scoreboard li {
    grid-template-columns: auto minmax(0, 1fr) 3.5rem;
  }
  .sb-bar {
    display: none;
  }
  .decision-word {
    font-size: 1.9rem;
  }
}
</style>
