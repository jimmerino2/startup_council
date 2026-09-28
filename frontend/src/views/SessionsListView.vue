<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import { useKeysStore } from "../stores/keys";
import { useSessionsStore } from "../stores/sessions";

const store = useSessionsStore();
const keys = useKeysStore();
onMounted(() => {
  store.fetchList();
  keys.fetch(); // cheap, and catches a key added or removed in another tab
});

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const stats = computed(() => [
  { label: "Sessions", value: store.list.length },
  { label: "Complete", value: store.list.filter((s) => s.status === "complete").length },
  { label: "In progress", value: store.list.filter((s) => s.status === "judging").length },
]);

const STATUS: Record<string, { label: string; tone: string }> = {
  complete: { label: "Complete", tone: "success" },
  judging: { label: "In progress", tone: "accent" },
  pending: { label: "Not started", tone: "" },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, tone: "" };

const PIPELINE = [
  { icon: "evidence", label: "Evidence" },
  { icon: "users", label: "Verdicts" },
  { icon: "scale", label: "Peer review" },
  { icon: "gavel", label: "Decision" },
] as const;
</script>

<template>
  <div class="page">
    <header class="page-head">
      <p class="eyebrow">Workspace</p>
      <h1 class="page-title">Your Council</h1>
      <p class="lede">Every idea you’ve put in front of the council. Open one to follow its evidence, verdicts, peer review and final call.</p>
    </header>

    <!-- No API key yet: nothing can run, so the first thing Home shows is how to get set up. -->
    <section v-if="keys.missing" class="setup" aria-labelledby="setup-heading">
      <div class="setup-head">
        <span class="setup-icon"><AppIcon name="key" :size="20" /></span>
        <div>
          <h2 id="setup-heading">Add an API key to get started</h2>
          <p>
            The council runs on AI models from providers like OpenRouter or Gemini, billed to your own key. Add one before starting your
            first judging.
          </p>
        </div>
      </div>
      <ol class="setup-steps">
        <li class="current">
          <span class="step-n" aria-hidden="true">1</span>
          <div>
            <strong>Add an API key in Settings</strong>
            <span>

              OpenRouter is the easiest start: every role uses it by default, including the evidence clerk, and it offers free models.
              Its web search for evidence uses your OpenRouter credits.
            </span>
            <div class="setup-actions">
              <RouterLink to="/settings?section=keys" class="btn"><AppIcon name="key" :size="14" /> Add an API Key</RouterLink>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
                Get an OpenRouter key <AppIcon name="external" :size="13" />
              </a>
            </div>
          </div>
        </li>
        <li>
          <span class="step-n" aria-hidden="true"><AppIcon name="lock" :size="11" /></span>
          <div>
            <strong>Judge your first idea</strong>
            <span>Unlocks once a key is saved.</span>
          </div>
        </li>
      </ol>
    </section>

    <RouterLink v-else to="/sessions/new" class="new-card">
      <span class="new-icon"><AppIcon name="plus" :size="22" /></span>
      <span class="new-copy">
        <strong>Judge a new idea</strong>
        <span>Paste a pitch, set the rubric, pick your council.</span>
      </span>
      <ol class="mini-pipeline" aria-label="What happens">
        <li v-for="(p, i) in PIPELINE" :key="p.label">
          <AppIcon :name="p.icon" :size="15" />
          <span>{{ p.label }}</span>
          <AppIcon v-if="i < PIPELINE.length - 1" name="chevron" :size="12" class="sep" />
        </li>
      </ol>
    </RouterLink>

    <dl v-if="store.list.length" class="stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <dt>{{ s.label }}</dt>
        <dd class="num">{{ s.value }}</dd>
      </div>
    </dl>

    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" class="section-title">Recent sessions</h2>

      <p v-if="store.listLoading && !store.list.length" class="muted">Loading…</p>
      <div v-else-if="store.listError" class="callout danger">
        <p>Couldn’t load your sessions: {{ store.listError }}. <button type="button" class="link-btn" @click="store.fetchList()">Try again</button></p>
      </div>
      <div v-else-if="!store.list.length" class="empty-state">
        <AppIcon name="graph" :size="28" />
        <p><strong>No sessions yet.</strong></p>
        <p v-if="keys.missing">Add an API key above, and your sessions will show up here.</p>
        <template v-else>
          <p>Your first judging takes a few minutes. You’ll be able to check and retry every step along the way.</p>
          <RouterLink to="/sessions/new" class="btn">Start Your First Judging</RouterLink>
        </template>
      </div>

      <ul v-else class="grid">
        <li v-for="s in store.list" :key="s.id">
          <RouterLink :to="`/sessions/${s.id}`" class="session-card">
            <span class="card-top">
              <AppIcon name="file" :size="16" />
              <span :class="['tag', statusOf(s.status).tone]">
                <span v-if="s.status === 'judging'" class="pulse" aria-hidden="true" />
                {{ statusOf(s.status).label }}
              </span>
            </span>
            <strong class="card-title">{{ s.title }}</strong>
            <span class="card-date num">{{ dateFormat.format(new Date(s.created_at)) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.setup {
  margin-bottom: 2rem;
  padding: 1.25rem 1.4rem;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--surface);
}
.setup-head {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}
.setup-head h2 {
  margin: 0;
  font-size: 1.15rem;
}
.setup-head p {
  margin: 0.3rem 0 0;
  max-width: 60ch;
  color: var(--fg-soft);
  font-size: 0.9rem;
}
.setup-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-fg);
}
.setup-steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.setup-steps li {
  display: flex;
  gap: 0.8rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  opacity: 0.6;
}
.setup-steps li.current {
  opacity: 1;
  border-color: var(--border-strong);
}
.setup-steps li > div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.setup-steps li span:not(.step-n) {
  color: var(--fg-soft);
  font-size: 0.86rem;
}
.step-n {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1.5px solid var(--border-strong);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--muted);
}
.current .step-n {
  border-color: var(--accent);
  color: var(--accent);
}
.setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.6rem;
}
.new-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1rem;
  align-items: center;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1.5rem;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--surface);
  color: var(--fg);
  transition: border-color 150ms ease, transform 150ms ease;
}
.new-card:hover {
  border-color: var(--accent);
  color: var(--fg);
  text-decoration: none;
  transform: translateY(-1px);
}
.new-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--accent);
  color: var(--accent-fg);
  grid-row: span 2;
}
.new-copy {
  display: flex;
  flex-direction: column;
}
.new-copy strong {
  font-size: 1.05rem;
}
.new-copy span {
  color: var(--fg-soft);
  font-size: 0.88rem;
}
.mini-pipeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.76rem;
  color: var(--muted);
}
.mini-pipeline li {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.sep {
  opacity: 0.6;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0 0 2rem;
}
.stat {
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.stat dt {
  font-size: 0.78rem;
  color: var(--muted);
}
.stat dd {
  margin: 0.1rem 0 0;
  font-size: 1.6rem;
  font-weight: 700;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.session-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--fg);
  transition: border-color 150ms ease, background-color 150ms ease;
}
.session-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-raised);
  color: var(--fg);
  text-decoration: none;
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
}
.card-title {
  font-size: 0.98rem;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.card-date {
  margin-top: auto;
  font-size: 0.78rem;
  color: var(--muted);
}

@media (max-width: 600px) {
  .new-card {
    grid-template-columns: 1fr;
  }
  .new-icon {
    grid-row: auto;
  }
  .stats {
    gap: 0.5rem;
  }
  .stat dd {
    font-size: 1.3rem;
  }
}
</style>
