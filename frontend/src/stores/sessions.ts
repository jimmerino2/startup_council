import { defineStore } from "pinia";
import { api } from "../lib/api";

export type RoleStatus = "pending" | "running" | "complete" | "failed";

export interface PersonaVerdict {
  persona_key: string;
  model_id: string;
  status: RoleStatus;
  error_message: string | null;
  verdict_text: string | null;
  score: number | null;
  strengths: string[];
  concerns: string[];
}

export interface ChairmanVerdict {
  model_id: string;
  final_verdict_text: string;
  overall_score: number;
  recommendation: "fund" | "iterate" | "pass";
}

export interface SessionSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

export const useSessionsStore = defineStore("sessions", {
  state: () => ({
    list: [] as SessionSummary[],
    current: null as {
      session: Record<string, unknown>;
      personaVerdicts: PersonaVerdict[];
      chairmanVerdict: ChairmanVerdict | null;
    } | null,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchList() {
      this.loading = true;
      this.error = null;
      try {
        this.list = await api.listSessions();
      } catch (err) {
        this.error = (err as Error).message;
      } finally {
        this.loading = false;
      }
    },

    async fetchOne(id: string, { silent = false }: { silent?: boolean } = {}) {
      if (!silent) this.loading = true;
      this.error = null;
      try {
        this.current = (await api.getSession(id)) as typeof this.current;
      } catch (err) {
        this.error = (err as Error).message;
      } finally {
        if (!silent) this.loading = false;
      }
    },

    async retryJudging(id: string) {
      await api.judgeSession(id);
      await this.fetchOne(id, { silent: true });
    },

    async retryPersona(id: string, personaKey: string) {
      await api.retryPersona(id, personaKey);
      await this.fetchOne(id, { silent: true });
    },

    async retryChairman(id: string) {
      await api.retryChairman(id);
      await this.fetchOne(id, { silent: true });
    },

    async createAndJudge(input: {
      title: string;
      problemStatement: string;
      judgingCriteria: string;
      pitchText: string;
      sourceFiles: { filename: string; type: string }[];
    }): Promise<string> {
      const created = await api.createSession(input);
      // Returns immediately (202); the results view polls until judging finishes.
      await api.judgeSession(created.id);
      return created.id;
    },
  },
});
