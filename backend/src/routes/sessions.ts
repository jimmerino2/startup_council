import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { PERSONAS } from "../config/personas.js";
import { buildSessionGraph } from "../services/graph.js";
import { parseCriteria, parseLabel, parseLinks } from "../services/sessionContext.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

sessionsRouter.post("/", async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { title, problemStatement, judgingCriteria, pitchText, sourceFiles, personas, eventType, stage, links, criteria } = req.body ?? {};

  if (!title || !judgingCriteria || !pitchText) {
    return res.status(400).json({ error: "title, judgingCriteria, and pitchText are required" });
  }

  let parsedCriteria;
  try {
    parsedCriteria = parseCriteria(criteria);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
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
      problem_statement: typeof problemStatement === "string" ? problemStatement : "",
      judging_criteria: judgingCriteria,
      pitch_text: pitchText,
      source_files: sourceFiles ?? [],
      persona_keys: personaKeys,
      event_type: parseLabel(eventType),
      stage: parseLabel(stage),
      links: parseLinks(links),
      criteria: parsedCriteria,
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

/** One session: personas, peer-review rankings, evidence and the chairman. */
sessionsRouter.get("/:id/graph", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  // ?detail=reviews draws each peer review as its own node instead of a single arrow.
  const reviewNodes = req.query.detail === "reviews";

  const [sessionRes, personaRes, evidenceRes, chairmanRes, reviewsRes] = await Promise.all([
    supabase.from("sessions").select("id").eq("id", id).single(),
    supabase.from("persona_verdicts").select("persona_key, status, score, verdict_text, strengths, concerns").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("evidence_requests").select("id, description, status, requested_by, persona_key, kind, sources").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("chairman_verdicts").select("overall_score, recommendation, final_verdict_text").eq("session_id", id).maybeSingle(),
    supabase.from("peer_reviews").select("reviewer_key, reviewed_key, rank, critique").eq("session_id", id),
  ]);
  if (sessionRes.error) return res.status(404).json({ error: "Session not found" });

  const labels = Object.fromEntries(PERSONAS.map((p) => [p.key, p.label]));
  res.json(buildSessionGraph(labels, personaRes.data ?? [], evidenceRes.data ?? [], chairmanRes.data ?? null, reviewsRes.data ?? [], { reviewNodes }));
});

sessionsRouter.get("/:id", async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const [sessionRes, personaRes, chairmanRes, evidenceRes, docsRes, reviewsRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).single(),
    supabase.from("persona_verdicts").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("chairman_verdicts").select("*").eq("session_id", id).maybeSingle(),
    supabase.from("evidence_requests").select("*").eq("session_id", id).order("created_at", { ascending: true }),
    // Raw text stays server-side (it can be large); the page only needs to know what was fetched.
    supabase.from("evidence_documents").select("id, request_id, url, title, content_type, bytes, fetch_status, error_message").eq("session_id", id).order("created_at", { ascending: true }),
    supabase.from("peer_reviews").select("reviewer_key, reviewed_key, rank, critique").eq("session_id", id).order("rank", { ascending: true }),
  ]);

  if (sessionRes.error) return res.status(404).json({ error: "Session not found" });

  res.json({
    session: sessionRes.data,
    personaVerdicts: personaRes.data ?? [],
    chairmanVerdict: chairmanRes.data ?? null,
    evidenceRequests: evidenceRes.data ?? [],
    evidenceDocuments: docsRes.data ?? [],
    peerReviews: reviewsRes.data ?? [],
  });
});
