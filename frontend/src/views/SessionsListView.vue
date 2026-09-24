<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useSessionsStore } from "../stores/sessions";

const store = useSessionsStore();
onMounted(() => store.fetchList());
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center">
      <h2>Your sessions</h2>
      <RouterLink class="btn" to="/sessions/new">New judging</RouterLink>
    </div>

    <p v-if="store.loading" class="muted">Loading…</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>
    <p v-else-if="store.list.length === 0" class="muted">
      No sessions yet. Start your first one.
    </p>

    <div v-for="s in store.list" :key="s.id" class="session-row">
      <RouterLink :to="`/sessions/${s.id}`">{{ s.title }}</RouterLink>
      <div style="display: flex; align-items: center; gap: 0.75rem">
        <span class="status-badge">{{ s.status }}</span>
        <span class="muted">{{ new Date(s.created_at).toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>
