<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
const router = useRouter();

async function handleSignOut() {
  await auth.signOut();
  router.push({ name: "auth" });
}
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <RouterLink to="/sessions" class="brand">Startup Council</RouterLink>
      <nav v-if="auth.isSignedIn" class="nav">
        <RouterLink to="/sessions">Sessions</RouterLink>
        <RouterLink to="/sessions/new">New Judging</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
        <span class="user-email">{{ auth.user?.email }}</span>
        <button class="link-btn" @click="handleSignOut">Sign out</button>
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>
