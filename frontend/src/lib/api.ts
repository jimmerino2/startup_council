import { supabase } from "./supabaseClient";

// Empty in production (same-origin /api under Vercel Services); set for local dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface GraphNode {
  id: string;
  kind: "source" | "persona" | "chairman" | "evidence" | "review" | "verdict" | "final_verdict";
  label: string;
  score?: number | null;
  status?: string | null;
  recommendation?: string | null;
  /** Review nodes: the critique text and the rank given. */
  critique?: string | null;
  rank?: number;
  /** Longer text for the detail panel (a verdict, the final verdict, or a critique). */
  text?: string | null;
  strengths?: string[];
  concerns?: string[];
  subtitle?: string;
  /** Heading for the detail panel when the label is only an excerpt. */
  title?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "cites" | "reviewed" | "wrote" | "about" | "requested" | "advises" | "verdict" | "concludes";
  weight: number;
  critique?: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const api = {
  async createSession(input: {
    title: string;
    problemStatement: string;
    judgingCriteria: string;
    pitchText: string;
    sourceFiles: { filename: string; type: string }[];
    /** Persona keys to run; omit for the whole council. */
    personas?: string[];
    eventType?: string;
    stage?: string;
    links?: string[];
    /** Rubric rows when the criteria were built in the rubric editor. */
    criteria?: { name: string; description: string; weight: number | null }[];
  }) {
    const res = await fetch(`${API_BASE_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(input),
    });
    return handle<{ id: string }>(res);
  },

  async listSessions() {
    const res = await fetch(`${API_BASE_URL}/api/sessions`, { headers: await authHeaders() });
    return handle<{ id: string; title: string; status: string; created_at: string }[]>(res);
  },

  async getSession(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}`, { headers: await authHeaders() });
    return handle<{
      session: Record<string, unknown>;
      personaVerdicts: Record<string, unknown>[];
      chairmanVerdict: Record<string, unknown> | null;
      evidenceRequests: Record<string, unknown>[];
      evidenceDocuments: Record<string, unknown>[];
    }>(res);
  },

  async judgeSession(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/judge`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async retryPersona(id: string, personaKey: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/personas/${personaKey}/retry`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async startVerdicts(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/verdicts`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async retryEvidence(id: string, requestId: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/evidence/${requestId}/retry`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async startReview(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/review`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async retryReview(id: string, personaKey: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/personas/${personaKey}/review/retry`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  async retryChairman(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/chairman/retry`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
  },

  /** `reviewNodes` draws each peer review as its own node instead of a single arrow. */
  async getSessionGraph(id: string, { reviewNodes = false }: { reviewNodes?: boolean } = {}) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/graph${reviewNodes ? "?detail=reviews" : ""}`, { headers: await authHeaders() });
    return handle<GraphData>(res);
  },

  async extractFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/api/upload/extract`, {
      method: "POST",
      headers: await authHeaders(),
      body: formData,
    });
    return handle<{ text: string; filename: string; type: string }>(res);
  },

  async getSettings() {
    const res = await fetch(`${API_BASE_URL}/api/settings`, { headers: await authHeaders() });
    return handle<{
      models: Partial<Record<string, { provider: "openrouter" | "gemini" | "mistral" | "groq" | "gonka"; modelId: string }>>;
      keys: {
        id: string;
        provider: "openrouter" | "gemini" | "mistral" | "groq" | "gonka";
        name: string;
        hint: string | null;
        status: "active" | "limited" | "disabled";
        limitedUntil: string | null;
        lastError: string | null;
      }[];
      maxEvidencePerPersona: number;
      peerReviewEvidence: "all" | "own";
      extractEvidence: boolean;
    }>(res);
  },

  async addKey(input: { provider: string; name: string; apiKey: string }) {
    const res = await fetch(`${API_BASE_URL}/api/settings/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(input),
    });
    return handle<{ id: string }>(res);
  },

  async activateAllKeys() {
    const res = await fetch(`${API_BASE_URL}/api/settings/keys/activate-all`, { method: "POST", headers: await authHeaders() });
    return handle<{ ok: true }>(res);
  },

  async updateKey(id: string, input: { name?: string; disabled?: boolean; apiKey?: string }) {
    const res = await fetch(`${API_BASE_URL}/api/settings/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(input),
    });
    return handle<{ ok: true }>(res);
  },

  async deleteKey(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/settings/keys/${id}`, { method: "DELETE", headers: await authHeaders() });
    return handle<{ ok: true }>(res);
  },

  async saveSettings(input: {
    models?: Record<string, { provider: "openrouter" | "gemini" | "mistral" | "groq" | "gonka"; modelId: string }>;
    maxEvidencePerPersona?: number;
    peerReviewEvidence?: "all" | "own";
    extractEvidence?: boolean;
  }) {
    const res = await fetch(`${API_BASE_URL}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(input),
    });
    return handle<{ ok: true }>(res);
  },
};
