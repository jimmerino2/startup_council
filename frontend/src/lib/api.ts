import { supabase } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

export const api = {
  async createSession(input: {
    title: string;
    problemStatement: string;
    judgingCriteria: string;
    pitchText: string;
    sourceFiles: { filename: string; type: string }[];
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
    }>(res);
  },

  async judgeSession(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${id}/judge`, {
      method: "POST",
      headers: await authHeaders(),
    });
    return handle<Record<string, unknown>>(res);
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
};
