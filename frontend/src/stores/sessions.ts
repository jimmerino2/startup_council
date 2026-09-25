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
  review_status: RoleStatus;
  review_critique: string | null;
  /** The other personas this one ranked, best first. */
  review_ranking: string[];
  review_error: string | null;
}

export interface EvidenceRequest {
  id: string;
  persona_key: string;
  /** Every persona that asked for this (near-identical requests are merged). */
  requested_by: string[];
  description: string;
  reason: string | null;
  status: "pending" | "running" | "complete" | "partial" | "not_found" | "failed";
  kind: "document" | "request_list";
  note: string | null;
  /** The derived, role-relevant information the persona receives. */
  summary: string | null;
  sources: { url: string; title: string }[];
  error_message: string | null;
}

export interface EvidenceDocument {
  id: string;
  request_id: string;
  url: string;
  title: string | null;
  content_type: string | null;
  bytes: number | null;
  fetch_status: "fetched" | "failed";
  error_message: string | null;
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
      evidenceRequests: EvidenceRequest[];
      evidenceDocuments: EvidenceDocument[];
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

    async startVerdicts(id: string) {
      await api.startVerdicts(id);
      await this.fetchOne(id, { silent: true });
    },

    async retryEvidence(id: string, requestId: string) {
      await api.retryEvidence(id, requestId);
      await this.fetchOne(id, { silent: true });
    },

    async startReview(id: string) {
      await api.startReview(id);
      await this.fetchOne(id, { silent: true });
    },

    async retryReview(id: string, personaKey: string) {
      await api.retryReview(id, personaKey);
      await this.fetchOne(id, { silent: true });
    },

    async retryChairman(id: string) {
      await api.retryChairman(id);
      await this.fetchOne(id, { silent: true });
    },

    async create(input: {
      title: string;
      problemStatement: string;
      judgingCriteria: string;
      pitchText: string;
      sourceFiles: { filename: string; type: string }[];
    }): Promise<string> {
      const created = await api.createSession(input);
      return created.id;
    },
  },
});
