import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { runCouncil } from "../services/council.js";

export const judgeRouter = Router();

interface SessionRow {
  user_id: string;
  title: string;
  problem_statement: string;
  judging_criteria: string;
  pitch_text: string;
}

async function judgeInBackground(supabase: SupabaseClient, id: string, session: SessionRow) {
  try {
    const { personaVerdicts, chairman } = await runCouncil({
      title: session.title,
      problemStatement: session.problem_statement,
      judgingCriteria: session.judging_criteria,
      pitchText: session.pitch_text,
    });

    const { error: personaInsertError } = await supabase.from("persona_verdicts").insert(
      personaVerdicts.map((v) => ({
        session_id: id,
        user_id: session.user_id,
        persona_key: v.personaKey,
        model_id: v.modelId,
        verdict_text: v.verdict,
        score: v.score,
        strengths: v.strengths,
        concerns: v.concerns,
        raw_response: v.raw,
      }))
    );
    if (personaInsertError) throw new Error(personaInsertError.message);

    const { error: chairmanInsertError } = await supabase.from("chairman_verdicts").insert({
      session_id: id,
      user_id: session.user_id,
      model_id: chairman.modelId,
      final_verdict_text: chairman.finalVerdict,
      overall_score: chairman.overallScore,
      recommendation: chairman.recommendation,
      raw_response: chairman.raw,
    });
    if (chairmanInsertError) throw new Error(chairmanInsertError.message);

    await supabase.from("sessions").update({ status: "complete" }).eq("id", id);
  } catch (err) {
    console.error(`Judging session ${id} failed:`, err);
    await supabase.from("sessions").update({ status: "error" }).eq("id", id);
  }
}

judgeRouter.post("/:id/judge", requireAuth, async (req, res) => {
  const { supabase } = req as unknown as AuthedRequest;
  const { id } = req.params;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.status === "judging" || session.status === "complete") {
    return res.status(409).json({ error: `Session is already ${session.status}` });
  }

  await supabase.from("sessions").update({ status: "judging" }).eq("id", id);

  // Respond right away; the council keeps running after the response (waitUntil
  // keeps the serverless function alive on Vercel, and is a no-op locally).
  waitUntil(judgeInBackground(supabase, id, session as SessionRow));
  res.status(202).json({ id, status: "judging" });
});
