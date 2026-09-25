import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { PERSONAS, resolveModelTarget } from "../config/personas.js";
import { judgePersona, reviewPersona, runChairmanSynthesis } from "../services/council.js";
import { loadUserModelSettings } from "../services/loadUserModelSettings.js";
import { loadEvidence, retryEvidenceRequest, runEvidenceStage } from "../services/evidencePipeline.js";
import type { PersonaKey, PersonaReview, PersonaVerdict, SessionInput, UserModelSettings } from "../types.js";

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
  evidence_status: string;
  /** Null means the whole council. */
  persona_keys: PersonaKey[] | null;
}

/** The personas taking part in this session. */
function activePersonas(session: SessionRow) {
  const keys = session.persona_keys;
  return keys ? PERSONAS.filter((p) => keys.includes(p.key)) : PERSONAS;
}

function toSessionInput(session: SessionRow): SessionInput {
  return {
    title: session.title,
    problemStatement: session.problem_statement,
    judgingCriteria: session.judging_criteria,
    pitchText: session.pitch_text,
  };
}

// A persona's review depends on the other personas' verdicts, so re-running a persona clears reviews.
const RESET_REVIEW = { review_status: "pending", review_critique: null, review_ranking: [], review_error: null };

const VERDICT_COLUMNS = "persona_key, model_id, verdict_text, score, strengths, concerns, raw_response";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPersonaVerdict(r: Record<string, any>): PersonaVerdict {
  return {
    personaKey: r.persona_key,
    modelId: r.model_id,
    verdict: r.verdict_text,
    score: r.score,
    strengths: r.strengths ?? [],
    concerns: r.concerns ?? [],
    raw: r.raw_response,
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
  await supabase.from("persona_verdicts").update({ status: "running", model_id: modelId, error_message: null, ...RESET_REVIEW }).eq("session_id", session.id).eq("persona_key", personaKey);

  try {
    const evidence = await loadEvidence(supabase, session.id, personaKey);
    const verdict = await judgePersona(persona, toSessionInput(session), settings, evidence);
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
    .select(`${VERDICT_COLUMNS}, review_critique, review_ranking`)
    .eq("session_id", session.id)
    .eq("status", "complete");

  const personaVerdicts: PersonaVerdict[] = (rows ?? []).map(toPersonaVerdict);
  const reviews: PersonaReview[] = (rows ?? []).map((r) => ({
    reviewer: r.persona_key,
    critique: r.review_critique ?? "",
    ranking: r.review_ranking ?? [],
  }));

  try {
    const chairman = await runChairmanSynthesis(toSessionInput(session), personaVerdicts, reviews, await loadEvidence(supabase, session.id), settings, Date.now() + CHAIRMAN_DEADLINE_MS);
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

/** Step 2: one persona reviews the other personas' (anonymized) verdicts. */
async function runReviewAndPersist(
  supabase: SupabaseClient,
  session: SessionRow,
  personaKey: PersonaKey,
  settings: UserModelSettings | undefined
): Promise<boolean> {
  const persona = PERSONAS.find((p) => p.key === personaKey);
  if (!persona) return false;
  const where = { session_id: session.id, persona_key: personaKey };
  await supabase.from("persona_verdicts").update({ review_status: "running", review_error: null }).match(where);

  try {
    const { data: rows } = await supabase.from("persona_verdicts").select(VERDICT_COLUMNS).eq("session_id", session.id).eq("status", "complete");
    // Reviewers see everyone's evidence (labelled without persona names, to keep the review anonymous)
    // unless the user chose the cheaper "own evidence only" mode in Settings.
    const evidence = await loadEvidence(supabase, session.id, settings?.peerReviewEvidence === "own" ? personaKey : undefined);
    const review = await reviewPersona(persona, toSessionInput(session), (rows ?? []).map(toPersonaVerdict), settings, evidence);
    await supabase
      .from("persona_verdicts")
      .update({ review_status: "complete", review_critique: review.critique, review_ranking: review.ranking, review_error: null })
      .match(where);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Review by ${personaKey} failed for session ${session.id}:`, message);
    await supabase.from("persona_verdicts").update({ review_status: "failed", review_error: message }).match(where);
    return false;
  }
}

/** Step 2: every persona in the session gives their initial verdicts, each using the evidence it requested. */
async function runVerdictsInBackground(supabase: SupabaseClient, session: SessionRow, settings: UserModelSettings | undefined) {
  await Promise.all(activePersonas(session).map((p) => runPersonaAndPersist(supabase, session, p.key, settings)));
}

async function hasVerdictRows(supabase: SupabaseClient, sessionId: string): Promise<boolean> {
  const { count } = await supabase.from("persona_verdicts").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  return (count ?? 0) > 0;
}

async function fetchSession(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as SessionRow;
}

/** Step 1: personas request evidence and the clerk gathers it. Can be re-run until verdicts (step 2) start. */
judgeRouter.post("/:id/judge", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.status === "complete") return res.status(409).json({ error: "Session is already complete" });
  if (session.evidence_status === "running") return res.status(409).json({ error: "Evidence gathering is already running" });
  if (await hasVerdictRows(supabase, id)) return res.status(409).json({ error: "Verdicts have already started, so evidence is locked" });

  await supabase
    .from("sessions")
    .update({ status: "judging", chairman_status: "pending", chairman_error: null, evidence_status: "running", evidence_error: null })
    .eq("id", id);

  const settings = await loadUserModelSettings(supabase, user.id);

  // Respond right away; work keeps running after the response (waitUntil keeps
  // the serverless function alive on Vercel, and is a no-op locally).
  waitUntil(runEvidenceStage(supabase, { sessionId: id, userId: user.id, input: toSessionInput(session), personaKeys: session.persona_keys ?? undefined }, settings));
  res.status(202).json({ id, status: "gathering" });
});

/** Retry one evidence request (or a persona's failed request list). Only before verdicts start. */
judgeRouter.post("/:id/evidence/:requestId/retry", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id, requestId } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (await hasVerdictRows(supabase, id)) return res.status(409).json({ error: "Verdicts have already started, so evidence is locked" });

  const { data: row } = await supabase.from("evidence_requests").select("status").eq("id", requestId).eq("session_id", id).maybeSingle();
  if (!row) return res.status(404).json({ error: "Evidence request not found" });
  if (row.status === "complete" || row.status === "running") {
    return res.status(409).json({ error: `A ${row.status} request can't be retried` });
  }

  await supabase.from("evidence_requests").update({ status: "running", error_message: null }).eq("id", requestId);
  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(retryEvidenceRequest(supabase, { sessionId: id, userId: user.id, input: toSessionInput(session), personaKeys: session.persona_keys ?? undefined }, requestId, settings));
  res.status(202).json({ id, requestId, status: "running" });
});

/** Step 2: the six personas give their initial verdicts, using the evidence from step 1. */
judgeRouter.post("/:id/verdicts", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.evidence_status !== "complete" && session.evidence_status !== "skipped") {
    return res.status(409).json({ error: "Evidence gathering (step 1) hasn't finished successfully yet" });
  }
  const { data: open } = await supabase.from("evidence_requests").select("id").eq("session_id", id).in("status", ["pending", "running"]).limit(1);
  if ((open ?? []).length > 0) return res.status(409).json({ error: "Some evidence requests are still running" });
  if (await hasVerdictRows(supabase, id)) return res.status(409).json({ error: "Verdicts have already started" });

  await supabase.from("sessions").update({ status: "judging", chairman_status: "pending", chairman_error: null }).eq("id", id);

  // Seed one pending row per persona up front so the retry/status endpoints
  // always have a row to update, and the UI can show them all immediately.
  await supabase.from("persona_verdicts").upsert(
    activePersonas(session).map((p) => ({
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
      ...RESET_REVIEW,
    })),
    { onConflict: "session_id,persona_key" }
  );

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(runVerdictsInBackground(supabase, session, settings));
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

  // Every other persona's review saw the old verdict, so they all go back to pending.
  await supabase.from("persona_verdicts").update(RESET_REVIEW).eq("session_id", id);

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

  const { data: rows } = await supabase.from("persona_verdicts").select("status, review_status").eq("session_id", id);
  const ready = (rows ?? []).length === activePersonas(session).length && (rows ?? []).every((r) => r.status === "complete" && r.review_status === "complete");
  if (!ready) {
    return res.status(409).json({ error: "All council verdicts and peer reviews must be complete before the chairman can run" });
  }

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(runChairmanAndPersist(supabase, session, settings));
  res.status(202).json({ id, status: "running" });
});

/** Step 2: start the anonymous peer-review round (all personas in parallel; skips reviews already done). */
judgeRouter.post("/:id/review", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.chairman_status === "running" || session.chairman_status === "complete") {
    return res.status(409).json({ error: "The chairman has already been run" });
  }

  const { data: rows } = await supabase.from("persona_verdicts").select("persona_key, status, review_status").eq("session_id", id);
  if ((rows ?? []).length !== activePersonas(session).length || !(rows ?? []).every((r) => r.status === "complete")) {
    return res.status(409).json({ error: "All council verdicts must be complete before peer review" });
  }
  if ((rows ?? []).some((r) => r.review_status === "running")) {
    return res.status(409).json({ error: "Peer review is already running" });
  }

  const keys = (rows ?? []).filter((r) => r.review_status !== "complete").map((r) => r.persona_key as PersonaKey);
  if (keys.length === 0) return res.status(409).json({ error: "Peer review is already complete" });

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(Promise.all(keys.map((k) => runReviewAndPersist(supabase, session, k, settings))));
  res.status(202).json({ id, reviewing: keys });
});

judgeRouter.post("/:id/personas/:personaKey/review/retry", requireAuth, async (req, res) => {
  const { user, supabase } = req as unknown as AuthedRequest;
  const { id, personaKey } = req.params;

  if (!PERSONAS.some((p) => p.key === personaKey)) return res.status(400).json({ error: "Unknown persona" });
  const session = await fetchSession(supabase, id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.chairman_status === "running" || session.chairman_status === "complete") {
    return res.status(409).json({ error: "The chairman has already been run" });
  }

  const { data: row } = await supabase.from("persona_verdicts").select("review_status").eq("session_id", id).eq("persona_key", personaKey).maybeSingle();
  if (row?.review_status !== "failed") return res.status(409).json({ error: "Only failed reviews can be retried" });

  const settings = await loadUserModelSettings(supabase, user.id);
  waitUntil(runReviewAndPersist(supabase, session, personaKey as PersonaKey, settings));
  res.status(202).json({ id, personaKey, review_status: "running" });
});
