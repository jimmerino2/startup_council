import { defineStore } from "pinia";
import { api } from "../lib/api";

/**
 * Whether the user has saved any provider API key. There are no server-wide keys, so without one nothing can run:
 * Home guides the user to Settings and New Judging is blocked (the backend refuses too, with code "no_api_keys").
 */
export const useKeysStore = defineStore("keys", {
  state: () => ({
    count: 0,
    loaded: false,
    error: null as string | null,
  }),
  getters: {
    /**
     * True only once we know for sure there are none: not while loading (no flashing warning) and not when the
     * check itself failed (a network blip shouldn't lock the user out; the backend still enforces it).
     */
    missing(state): boolean {
      return state.loaded && !state.error && state.count === 0;
    },
  },
  actions: {
    async fetch() {
      try {
        this.count = (await api.getSettings()).keys.length;
        this.error = null;
      } catch (err) {
        this.error = (err as Error).message;
      } finally {
        this.loaded = true;
      }
    },
    /** Settings already has the list after adding or deleting a key, so it reports the new count directly. */
    set(count: number) {
      this.count = count;
      this.loaded = true;
    },
  },
});
