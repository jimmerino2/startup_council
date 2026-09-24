import { defineStore } from "pinia";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: null as Session | null,
    initialized: false,
  }),
  getters: {
    user(state): User | null {
      return state.session?.user ?? null;
    },
    isSignedIn(state): boolean {
      return state.session !== null;
    },
  },
  actions: {
    async init() {
      const { data } = await supabase.auth.getSession();
      this.session = data.session;
      this.initialized = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        this.session = session;
      });
    },
    async signInWithMagicLink(email: string) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    async signOut() {
      await supabase.auth.signOut();
      this.session = null;
    },
  },
});
