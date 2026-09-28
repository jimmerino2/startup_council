<script setup lang="ts">
// Obsidian-style workspace: a narrow icon ribbon, a collapsible sidebar listing sessions (like a vault's
// file explorer), and the main pane with a view header. Signed-out pages render without the chrome.
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import AppIcon from "./components/AppIcon.vue";
import { useAuthStore } from "./stores/auth";
import { useSessionsStore } from "./stores/sessions";

const auth = useAuthStore();
const sessions = useSessionsStore();
const route = useRoute();
const router = useRouter();

const SIDEBAR_KEY = "startup-council:sidebar-open";
const narrow = () => window.matchMedia("(max-width: 800px)").matches;

function readSidebarPref() {
  try {
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === null ? !narrow() : v === "1" && !narrow();
  } catch {
    return !narrow();
  }
}

const sidebarOpen = ref(readSidebarPref());
watch(sidebarOpen, (open) => {
  if (narrow()) return; // the mobile drawer shouldn't overwrite the desktop preference
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
  } catch {
    /* storage blocked: the preference just won't persist */
  }
});

const filter = ref("");
const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return q ? sessions.list.filter((s) => s.title.toLowerCase().includes(q)) : sessions.list;
});

const activeId = computed(() => (route.name === "session-results" ? String(route.params.id) : null));
const chrome = computed(() => auth.isSignedIn && route.name !== "auth");

const TITLES: Record<string, string> = {
  sessions: "Home",
  "new-session": "New Judging",
  settings: "Settings",
  about: "How It Works",
};
const viewTitle = computed(() => {
  if (route.name === "session-results") return sessions.list.find((s) => s.id === activeId.value)?.title ?? "Session";
  return TITLES[String(route.name)] ?? "";
});

onMounted(() => {
  if (auth.isSignedIn) sessions.fetchList();
});

// Refresh the list after sign-in, and when a session appears that the sidebar hasn't seen (just created).
watch(
  () => [auth.isSignedIn, activeId.value] as const,
  ([signedIn, id]) => {
    if (signedIn && (sessions.list.length === 0 || (id && !sessions.list.some((s) => s.id === id)))) sessions.fetchList();
  },
);

// On phones the sidebar is a drawer: close it after navigating. The main pane scrolls, not the window,
// so a new page also needs its scroll reset by hand.
watch(
  () => route.fullPath,
  () => {
    if (narrow()) sidebarOpen.value = false;
  },
);
watch(
  () => route.path,
  () => document.getElementById("main")?.scrollTo(0, 0),
);

async function handleSignOut() {
  await auth.signOut();
  router.push({ name: "auth" });
}

const STATUS_LABEL: Record<string, string> = { complete: "Complete", judging: "In progress", pending: "Not started" };
</script>

<template>
  <a href="#main" class="skip-link">Skip to content</a>

  <div v-if="chrome" class="workspace" :class="{ 'sidebar-open': sidebarOpen }">
    <nav class="ribbon" aria-label="Main">
      <RouterLink to="/sessions" class="ribbon-brand" aria-label="Startup Council home" title="Home">
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="5" r="1.8" /><circle cx="16.5" cy="5" r="1.8" /><circle cx="10" cy="17" r="1.8" />
          <path d="M5 6l3 2.5M15 6l-3 2.5M10 12.6v2.6" />
        </svg>
      </RouterLink>
      <button type="button" class="ribbon-btn" :aria-label="sidebarOpen ? 'Hide sidebar' : 'Show sidebar'" :aria-expanded="sidebarOpen" aria-controls="sidebar" :title="sidebarOpen ? 'Hide sidebar' : 'Show sidebar'" @click="sidebarOpen = !sidebarOpen">
        <AppIcon name="sidebar" />
      </button>
      <RouterLink to="/sessions/new" class="ribbon-btn" aria-label="New judging" title="New judging"><AppIcon name="plus" /></RouterLink>
      <RouterLink to="/sessions" class="ribbon-btn" aria-label="Home" title="Home" exact-active-class="active"><AppIcon name="home" /></RouterLink>
      <span class="ribbon-spacer" />
      <RouterLink to="/about" class="ribbon-btn" aria-label="How it works" title="How it works" active-class="active"><AppIcon name="help" /></RouterLink>
      <RouterLink to="/settings" class="ribbon-btn" aria-label="Settings" title="Settings" active-class="active"><AppIcon name="settings" /></RouterLink>
    </nav>

    <aside id="sidebar" class="sidebar" :inert="!sidebarOpen || undefined" aria-label="Sessions">
      <div class="sidebar-head">
        <span class="vault-name" translate="no">Startup Council</span>
        <RouterLink to="/sessions/new" class="icon-btn" aria-label="New judging" title="New judging"><AppIcon name="plus" :size="16" /></RouterLink>
      </div>
      <label class="sidebar-search">
        <AppIcon name="search" :size="14" />
        <span class="sr-only">Filter sessions</span>
        <input v-model="filter" type="search" name="session-filter" autocomplete="off" spellcheck="false" placeholder="Filter sessions…" />
      </label>

      <div class="tree" role="list">
        <p class="tree-label">Sessions <span class="count">{{ sessions.list.length }}</span></p>
        <p v-if="sessions.listLoading && !sessions.list.length" class="tree-empty">Loading…</p>
        <p v-else-if="sessions.listError" class="tree-empty error-text">{{ sessions.listError }}</p>
        <p v-else-if="!sessions.list.length" class="tree-empty">No sessions yet. Press <strong>+</strong> to judge your first idea.</p>
        <p v-else-if="!filtered.length" class="tree-empty">No sessions match “{{ filter }}”.</p>
        <RouterLink
          v-for="s in filtered"
          :key="s.id"
          :to="`/sessions/${s.id}`"
          class="tree-item"
          :class="{ active: s.id === activeId }"
          role="listitem"
          :aria-current="s.id === activeId ? 'page' : undefined"
        >
          <span class="status-dot" :class="s.status" :title="STATUS_LABEL[s.status] ?? s.status" />
          <span class="tree-title">{{ s.title }}</span>
          <span class="tree-date">{{ dateFormat.format(new Date(s.created_at)) }}</span>
        </RouterLink>
      </div>

      <!-- Phones have no ribbon, so its links move into the drawer. -->
      <nav class="drawer-nav" aria-label="Main">
        <RouterLink to="/sessions/new" class="tree-item"><AppIcon name="plus" :size="16" /> New Judging</RouterLink>
        <RouterLink to="/sessions" class="tree-item"><AppIcon name="home" :size="16" /> Home</RouterLink>
        <RouterLink to="/about" class="tree-item"><AppIcon name="help" :size="16" /> How It Works</RouterLink>
        <RouterLink to="/settings" class="tree-item"><AppIcon name="settings" :size="16" /> Settings</RouterLink>
      </nav>

      <div class="sidebar-foot">
        <span class="account" :title="auth.user?.email">
          <AppIcon name="mail" :size="14" />
          <span class="account-email">{{ auth.user?.email }}</span>
        </span>
        <button type="button" class="icon-btn" aria-label="Sign out" title="Sign out" @click="handleSignOut"><AppIcon name="logout" :size="16" /></button>
      </div>
    </aside>
    <button v-if="sidebarOpen" type="button" class="scrim" aria-label="Close sidebar" tabindex="-1" @click="sidebarOpen = false" />

    <div class="pane">
      <header class="view-header">
        <button type="button" class="icon-btn menu-btn" aria-label="Show sidebar" @click="sidebarOpen = true"><AppIcon name="menu" /></button>
        <span class="view-title">{{ viewTitle }}</span>
      </header>
      <main id="main" class="view-content" tabindex="-1">
        <!-- Keyed by session id so moving between sessions in the sidebar reloads the page's data. -->
        <RouterView v-slot="{ Component, route: r }">
          <component :is="Component" :key="r.params.id ? String(r.params.id) : String(r.name)" />
        </RouterView>
      </main>
    </div>
  </div>

  <main v-else id="main" class="bare" tabindex="-1">
    <RouterView />
  </main>
</template>

<style scoped>
.workspace {
  --ribbon-w: 48px;
  --sidebar-w: 272px;
  display: grid;
  grid-template-columns: var(--ribbon-w) 0 minmax(0, 1fr);
  position: relative;
  height: 100dvh;
  overflow: hidden;
  transition: grid-template-columns 180ms ease;
}
.workspace.sidebar-open {
  grid-template-columns: var(--ribbon-w) var(--sidebar-w) minmax(0, 1fr);
}

/* --- Ribbon --- */
.ribbon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0 12px;
  background: var(--chrome);
  border-right: 1px solid var(--border);
  z-index: 30;
}
.ribbon-brand {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 10px;
  color: var(--accent);
}
.ribbon-brand svg {
  width: 20px;
  height: 20px;
}
.ribbon-spacer {
  flex: 1;
}
.ribbon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.ribbon-btn:hover,
.ribbon-btn.active {
  background: var(--hover);
  color: var(--fg);
  text-decoration: none;
}

/* --- Sidebar --- */
.sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--chrome);
  border-right: 1px solid var(--border);
  z-index: 20;
}
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 6px 16px;
}
.vault-name {
  font-weight: 650;
  font-size: 0.9rem;
  white-space: nowrap;
}
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 10px 8px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--muted);
}
.sidebar-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.sidebar-search input {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
  border: none;
  background: transparent;
  font-size: 0.82rem;
  box-shadow: none;
}
.sidebar-search input:focus-visible {
  outline: none;
  box-shadow: none;
}
.tree {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 6px 12px;
}
.tree-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 10px 4px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.count {
  font-variant-numeric: tabular-nums;
}
.tree-empty {
  margin: 6px 10px;
  font-size: 0.8rem;
  color: var(--muted);
}
.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 5px;
  color: var(--fg-soft);
  font-size: 0.84rem;
  transition: background-color 100ms ease, color 100ms ease;
}
.tree-item:hover {
  background: var(--hover);
  color: var(--fg);
  text-decoration: none;
}
.tree-item.active {
  background: var(--accent-soft);
  color: var(--fg);
}
.tree-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-date {
  font-size: 0.72rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--muted);
}
.status-dot.complete {
  background: var(--success);
}
.status-dot.judging {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.sidebar-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 10px 14px;
  border-top: 1px solid var(--border);
}
.account {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--muted);
  font-size: 0.78rem;
}
.account-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.icon-btn:hover {
  background: var(--hover);
  color: var(--fg);
  text-decoration: none;
}

/* --- Main pane --- */
.pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.view-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  height: 40px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  position: relative;
}
.view-title {
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.84rem;
  color: var(--fg-soft);
}
.menu-btn {
  display: none;
  position: absolute;
  left: 8px;
}
.view-content {
  /* Positioned so absolutely placed descendants (e.g. .sr-only inputs) are laid out and clipped here.
     Otherwise they're placed against the page, poke out below the workspace and make the window scroll. */
  position: relative;
  flex: 1;
  overflow-y: auto;
  scroll-padding-top: 1rem;
}
.scrim {
  display: none;
}
.bare {
  min-height: 100dvh;
}
.drawer-nav {
  display: none;
  flex-direction: column;
  padding: 6px;
  border-top: 1px solid var(--border);
}

@media (max-width: 800px) {
  .workspace,
  .workspace.sidebar-open {
    grid-template-columns: minmax(0, 1fr);
  }
  .ribbon {
    display: none;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(300px, 85vw);
    transform: translateX(-100%);
    transition: transform 180ms ease;
    box-shadow: var(--shadow);
  }
  .sidebar-open .sidebar {
    transform: none;
  }
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 15;
    border: none;
    background: rgb(0 0 0 / 0.45);
  }
  .menu-btn {
    display: grid;
  }
  .drawer-nav {
    display: flex;
  }
}
</style>
