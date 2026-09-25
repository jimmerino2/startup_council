import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { PERSONAS } from "../config/personas.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

sessionsRouter.post("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { title, problemStatement, judgingCriteria, pitchText, sourceFiles, personas } = req.body ?? {};

  if (!title || !problemStatement || !judgingCriteria || !pitchText) {
    return res.status(400).json({ error: "title, problemStatement, judgingCriteria, and pitchText are required" });
  }

  // Optional subset of the council. Omitted (or all six) is stored as null, meaning everyone.
  let personaKeys: string[] | null = null;
  if (personas !== undefined && personas !== null) {
    const known = PERSONAS.map((p) => p.key as string);
    if (!Array.isArray(personas) || personas.some((k) => typeof k !== "string" || !known.includes(k))) {
      return res.status(400).json({ error: "personas must be a list of known persona keys" });
    }
    const unique = [...new Set(personas as string[])];
    if (unique.length < 2) {
      return res.status(400).json({ error: "Select at least 2 personas (peer review needs someone to review)" });
    }
    personaKeys = unique.length === known.length ? null : known.filter((k) => unique.includes(k));
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      title,
      problem_statement: problemStatement,
      judging_criteria: judgingCriteria,
      pitch_text: pitchText,
      source_files: sourceFiles ?? [],
      persona_keys: personaKeys,
      status: "pending",
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

sessionsRouter.get("/", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { data, error } = await supabase
    .from("sessions")
    .select("id, title, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

sessionsRouter.get("/:id", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const [sessionRes, personaRes, chairmanRes, evidenceRes, docsRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).single(),
    supabase.from("persona_verdicts").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("chairman_verdicts").select("*").eq("session_id", id).maybeSingle(),
    supabase.from("evidence_requests").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    // Raw text stays server-side (it can be large); the page only needs to know what was fetched.
    supabase.from("evidence_documents").select("id, request_id, url, title, content_type, bytes, fetch_status, error_message").eq("session_id", id).order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error) return res.status(404).json({ error: "Session not found" });

  res.json({
    session: sessionRes.data,
    personaVerdicts: personaRes.data ?? [],
    chairmanVerdict: chairmanRes.data ?? null,
    evidenceRequests: evidenceRes.data ?? [],
    evidenceDocuments: docsRes.data ?? [],
  });
});
