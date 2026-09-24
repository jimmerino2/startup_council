import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

sessionsRouter.post("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { title, problemStatement, judgingCriteria, pitchText, sourceFiles } = req.body ?? {};

  if (!title || !problemStatement || !judgingCriteria || !pitchText) {
    return res.status(400).json({ error: "title, problemStatement, judgingCriteria, and pitchText are required" });
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

  const [sessionRes, personaRes, chairmanRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).single(),
    supabase.from("persona_verdicts").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("chairman_verdicts").select("*").eq("session_id", id).maybeSingle(),
  ]);

  if (sessionRes.error) return res.status(404).json({ error: "Session not found" });

  res.json({
    session: sessionRes.data,
    personaVerdicts: personaRes.data ?? [],
    chairmanVerdict: chairmanRes.data ?? null,
  });
});
