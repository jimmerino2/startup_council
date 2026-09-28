<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import HeroGraph from "../components/HeroGraph.vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const email = ref("");
const sent = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    await auth.signInWithMagicLink(email.value);
    sent.value = true;
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth">
    <section class="auth-panel">
      <RouterLink to="/about" class="brand">
        <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="5" r="1.8" /><circle cx="16.5" cy="5" r="1.8" /><circle cx="10" cy="17" r="1.8" />
          <path d="M5 6l3 2.5M15 6l-3 2.5M10 12.6v2.6" />
        </svg>
        <span translate="no">Startup Council</span>
      </RouterLink>

      <div class="auth-card">
        <template v-if="!sent">
          <h1>Sign In</h1>
          <p class="sub">We’ll email you a magic link. No password needed.</p>
          <form @submit.prevent="submit">
            <div class="field">
              <label for="email">Email</label>
              <input id="email" v-model="email" name="email" type="email" autocomplete="email" spellcheck="false" required placeholder="you@example.com" />
            </div>
            <button class="btn btn-lg full" type="submit" :disabled="loading">
              <AppIcon name="mail" :size="16" /> {{ loading ? "Sending…" : "Send Magic Link" }}
            </button>
            <p v-if="error" class="error-text" role="alert">{{ error }} Check the address and try again.</p>
          </form>
        </template>
        <div v-else class="sent" role="status">
          <span class="sent-icon"><AppIcon name="mail" :size="22" /></span>
          <h1>Check your inbox</h1>
          <p class="sub">We sent a sign-in link to <strong>{{ email }}</strong>. Open it on this device to continue.</p>
          <button type="button" class="link-btn" @click="sent = false">Use a different email</button>
        </div>
      </div>

      <p class="foot">New here? <RouterLink to="/about">See how the council works</RouterLink>.</p>
    </section>

    <aside class="auth-art" aria-hidden="true">
      <div class="art-inner">
        <HeroGraph />
        <p class="art-quote">Six reviewers. Anonymous peer review. One final call.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 100dvh;
}
.auth-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
  padding: 2rem clamp(1.25rem, 5vw, 4rem);
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--fg);
  font-weight: 700;
}
.brand:hover {
  color: var(--fg);
  text-decoration: none;
}
.brand svg {
  width: 22px;
  height: 22px;
  color: var(--accent);
}
.auth-card {
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}
.auth-card h1 {
  margin: 0;
  font-size: 1.75rem;
  letter-spacing: -0.015em;
}
.sub {
  margin: 0.4rem 0 1.5rem;
  color: var(--fg-soft);
}
.full {
  width: 100%;
}
.error-text {
  margin: 0.75rem 0 0;
  font-size: 0.88rem;
}
.sent {
  text-align: center;
}
.sent-icon {
  display: inline-grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 1rem;
  border-radius: 14px;
  background: var(--accent-soft);
  color: var(--accent);
}
.sent strong {
  color: var(--fg);
  overflow-wrap: anywhere;
}
.foot {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
}
.auth-art {
  display: grid;
  place-items: center;
  padding: 3rem;
  background: radial-gradient(circle at 50% 45%, var(--accent-soft), transparent 65%), var(--graph-bg);
  border-left: 1px solid var(--border);
}
.art-inner {
  width: min(420px, 100%);
  text-align: center;
}
.art-quote {
  margin: 1.5rem 0 0;
  color: var(--fg-soft);
  font-size: 0.95rem;
}
@media (max-width: 860px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }
  .auth-art {
    display: none;
  }
}
</style>
