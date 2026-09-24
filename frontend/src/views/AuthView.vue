<script setup lang="ts">
import { ref } from "vue";
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
  <div style="max-width: 360px; margin: 3rem auto">
    <h2>Sign in</h2>
    <p class="muted">Enter your email and we'll send you a magic sign-in link.</p>
    <form v-if="!sent" @submit.prevent="submit">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required placeholder="you@example.com" />
      </div>
      <button class="btn" type="submit" :disabled="loading">
        {{ loading ? "Sending…" : "Send magic link" }}
      </button>
      <p v-if="error" class="error-text">{{ error }}</p>
    </form>
    <p v-else>Check your inbox for a sign-in link.</p>
  </div>
</template>
