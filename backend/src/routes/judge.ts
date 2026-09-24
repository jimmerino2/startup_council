import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { PERSONAS, resolveModelTarget } from "../config/personas.js";
import { judgePersona, runChairmanSynthesis } from "../services/council.js";
import { loadUserModelSettings } from "../services/loadUserModelSettings.js";
import type { PersonaKey, PersonaVerdict, SessionInput, UserModelSettings } from "../types.js";

export const judgeRouter = Router();

// No new chairman attempt starts after this, leaving headroom under Vercel's 300s function limit.
const CHAIRMAN_DEADLINE_MS = 170_000;

interface SessionRow {
  id: string;
  user_id: string;
  title: string;
  problem_statement: string;
  judging_criteria: string;
  pitch_text: string;
  status: string;
  chairman_status: string;
}

function toSessionInput(session: SessionRow): SessionInput {
  return {
    title: session.title,
    problemStatement: session.problem_statement,
    judgingCriteria: session.judging_criteria,
    pitchText: session.pitch_text,
  };
}

/** Runs one persona and writes its result (success or failure) to its existing row. */
async function runPersonaAndPersist(
  supabase: SupabaseClient,
  session: SessionRow,
  personaKey: PersonaKey,
  settings: UserModelSettings | undefined
): Promise<boolean> {
  const persona = PERSONAS.find((p) => p.key === personaKey);
  if (!persona) return false;

  // The model is known from settings before any call, so record it up front (also shown on failures).
  const { modelId } = resolveModelTarget(persona, settings);
  await supabase.from("persona_verdicts").update({ status: "running", model_id: modelId, error_message: null }).eq("session_id", session.id).eq("persona_key", personaKey);

  try {
    const verdict = await judgePersona(persona, toSessionInput(session), settings);
    await supabase
      .from("persona_verdicts")
      .update({
        status: "complete",
        model_id: verdict.modelId,
        verdict_text: verdict.verdict,
        score: verdict.score,
        strengths: verdict.strengths,
        concerns: verdict.concerns,
        raw_response: verdict.raw,
        error_message: null,
      })
      .eq("session_id", session.id)
      .eq("persona_key", personaKey);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Persona ${personaKey} failed for session ${session.id}:`, message);
    await supabase.from("persona_verdicts").update({ status: "failed", error_message: message }).eq("session_id", session.id).eq("persona_key", personaKey);
    return false;
  }
}

/** Runs the chairman from whatever persona verdicts are currently complete and writes the result. */
async function runChairmanAndPersist(supabase: SupabaseClient, session: SessionRow, settings: UserModelSettings | undefined) {
  await supabase.from("sessions").update({ chairman_status: "running", chairman_error: null }).eq("id", session.id);

  const { data: rows } = await supabase
    .from("persona_verdicts")
    .select("persona_key, model_id, verdict_text, score, strengths, concerns, raw_response")
    .eq("session_id", session.id)
    .eq("status", "complete");

  const personaVerdicts: PersonaVerdict[] = (rows ?? []).map((r) => ({
    personaKey: r.persona_key,
    modelId: r.model_id,
    verdict: r.verdict_text,
    score: r.score,
    strengths: r.strengths ?? [],
    concerns: r.concerns ?? [],
    raw: r.raw_response,
  }));

  try {
    const chairman = await runChairmanSynthesis(toSessionInput(session), personaVerdicts, settings, Date.now() + CHAIRMAN_DEADLINE_MS);
    await supabase.from("chairman_verdicts").upsert(
      {
        session_id: session.id,
        user_id: session.user_id,
        model_id: chairman.modelId,
        final_verdict_text: chairman.finalVerdict,
        overall_score: chairman.overallScore,
        recommendation: chairman.recommendation,
        raw_response: chairman.raw,
      },
      { onConflict: "session_id" }
    );
    await supabase.from("sessions").update({ chairman_status: "complete", status: "complete" }).eq("id", session.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Chairman failed for session ${session.id}:`, message);
    await supabase.from("sessions").update({ chairman_status: "failed", chairman_error: message }).eq("id", session.id);
  }
}

/** Runs all 6 personas, then the chairman — but only if every persona succeeded. */
async function judgeAllInBackground(supabase: SupabaseClient, session: SessionRow, settings: UserModelSettings | undefined) {
  const results = await Promise.all(PERSONAS.map((p) => runPersonaAndPersist(supabase, session, p.key, settings)));
  if (results.every(Boolean)) {
    await runChairmanAndPersist(supabase, session, settings);
  }
}

async function fetchSession(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as SessionRow;
}

judgeRouter.post("/:id/judge", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status === "judging" || session.status === "complete") {
    return res.status(409).json({ error: `Session is already ${session.status}` });
  }

  await supabase.from("sessions").update({ status: "judging", chairman_status: "pending", chairman_error: null }).eq("id", id);

  // Seed one pending row per persona up front so the retry/status endpoints
  // always have a row to update, and the UI can show all 6 immediately.
  await supabase.from("persona_verdicts").upsert(
    PERSONAS.map((p) => ({
      session_id: id,
      user_id: user.id,
      persona_key: p.key,
      model_id: "",
      status: "pending",
      verdict_text: null,
      score: null,
      strengths: [],
      concerns: [],
      raw_response: null,
      error_message: null,
    })),
    { onConflict: "session_id,persona_key" }
  );

  const settings = await loadUserModelSettings(supabase, user.id);

  // Respond right away; work keeps running after the response (waitUntil keeps
  // the serverless function alive on Vercel, and is a no-op locally).
  waitUntil(judgeAllInBackground(supabase, session, settings));
  res.status(202).json({ id, status: "judging" });
});

judgeRouter.post("/:id/personas/:personaKey/retry", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id, personaKey } = req.params;

  if (!PERSONAS.some((p) => p.key === personaKey)) {
    return res.status(400).json({ error: "Unknown persona" });
  }

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const { data: row } = await supabase
    .from("persona_verdicts")
    .select("status")
    .eq("session_id", id)
    .eq("persona_key", personaKey)
    .maybeSingle();
  if (row?.status !== "failed") {
    return res.status(409).json({ error: "Only failed personas can be retried" });
  }

  // Retrying a persona invalidates any chairman verdict already synthesized from
  // the old one — require an explicit chairman retry to produce a fresh final call.
  if (session.chairman_status !== "running") {
    await supabase.from("sessions").update({ status: "judging", chairman_status: "pending", chairman_error: null }).eq("id", id);
  }

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(runPersonaAndPersist(supabase, session, personaKey as PersonaKey, settings));
  res.status(202).json({ id, personaKey, status: "running" });
});

judgeRouter.post("/:id/chairman/retry", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  if (session.chairman_status === "running") {
    return res.status(409).json({ error: "Chairman is already running" });
  }
  if (session.chairman_status === "complete") {
    return res.status(409).json({ error: "Chairman has already completed" });
  }

  const { data: rows } = await supabase.from("persona_verdicts").select("status").eq("session_id", id);
  const allComplete = (rows ?? []).length === PERSONAS.length && (rows ?? []).every((r) => r.status === "complete");
  if (!allComplete) {
    return res.status(409).json({ error: "All personas must be complete before the chairman can run" });
  }

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(runChairmanAndPersist(supabase, session, settings));
  res.status(202).json({ id, status: "running" });
});
