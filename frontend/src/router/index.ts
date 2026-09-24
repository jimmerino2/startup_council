import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";
import AuthView from "../views/AuthView.vue";
import NewSessionView from "../views/NewSessionView.vue";
import SessionResultsView from "../views/SessionResultsView.vue";
import SessionsListView from "../views/SessionsListView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/sessions" },
    { path: "/auth", name: "auth", component: AuthView },
    { path: "/sessions", name: "sessions", component: SessionsListView, meta: { requiresAuth: true } },
    { path: "/sessions/new", name: "new-session", component: NewSessionView, meta: { requiresAuth: true } },
    { path: "/sessions/:id", name: "session-results", component: SessionResultsView, meta: { requiresAuth: true }, props: true },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.init();

  if (to.meta.requiresAuth && !auth.isSignedIn) {
    return { name: "auth" };
  }
  if (to.name === "auth" && auth.isSignedIn) {
    return { name: "sessions" };
  }
  return true;
});

export default router;
