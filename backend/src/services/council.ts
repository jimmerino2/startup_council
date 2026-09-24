import { PERSONAS, resolveChairmanModelTargets, resolveModelTarget, CHAIRMAN_SYSTEM_PROMPT } from "../config/personas.js";
import { extractJsonObject } from "./openrouter.js";
import { callModel } from "./modelRouter.js";
import { ModelCallError } from "./modelError.js";
import type { ChairmanVerdict, PersonaVerdict, SessionInput, UserModelSettings } from "../types.js";

interface RawPersonaJson {
  verdict: string;
  score: number;
  strengths: string[];
  concerns: string[];
}

interface RawChairmanJson {
  finalVerdict: string;
  overallScore: number;
  recommendation: "fund" | "iterate" | "pass";
}

export function buildSubmissionPrompt(input: SessionInput): string {
  return `# Problem Statement
${input.problemStatement}

# Judging Criteria
${input.judgingCriteria}

# Pitch / Submission
${input.pitchText}`;
}

function clampScore(score: unknown): number {
  const n = typeof score === "number" ? score : Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

/**
 * Runs a single persona. Callers persist the result (or the thrown error) to
 * `persona_verdicts` themselves — this is the same primitive used both for the
 * initial judging pass and for a one-off retry of a single role.
 */
export async function judgePersona(
  persona: (typeof PERSONAS)[number],
  input: SessionInput,
  settings: UserModelSettings | undefined
): Promise<PersonaVerdict> {
  const target = resolveModelTarget(persona, settings);
  // Free models sometimes return truncated JSON; one fresh attempt usually fixes it.
  const MAX_PARSE_ATTEMPTS = 2;
  let lastParseError = "";

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    const { text, raw } = await callModel(target, persona.systemPrompt, buildSubmissionPrompt(input));
    try {
      const parsed = extractJsonObject<RawPersonaJson>(text);
      return {
        personaKey: persona.key,
        modelId: target.modelId,
        verdict: parsed.verdict ?? text,
        score: clampScore(parsed.score),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
        raw,
      };
    } catch (err) {
      lastParseError = (err as Error).message;
      console.warn(`Persona ${persona.key} (${target.modelId}) unparseable on attempt ${attempt}/${MAX_PARSE_ATTEMPTS}`);
    }
  }
  throw new Error(`Persona ${persona.key} (${target.modelId}) returned unparseable output: ${lastParseError}`);
}

/**
 * Synthesizes a chairman verdict from a complete set of persona verdicts.
 * Callers are responsible for only calling this once all personas have
 * succeeded — there's no quorum tolerance here; a role that failed should be
 * retried instead of the chairman silently working around a gap.
 */
export async function runChairmanSynthesis(
  input: SessionInput,
  personaVerdicts: PersonaVerdict[],
  settings: UserModelSettings | undefined,
  deadline: number
): Promise<ChairmanVerdict> {
  const chairmanPrompt = `${buildSubmissionPrompt(input)}

# Council Verdicts
${personaVerdicts
  .map(
    (v) => `## ${v.personaKey} (score: ${v.score}/10)
${v.verdict}
Strengths: ${v.strengths.join("; ")}
Concerns: ${v.concerns.join("; ")}`
  )
  .join("\n\n")}`;

  const candidates = resolveChairmanModelTargets(settings);
  const failures: string[] = [];

  for (const target of candidates) {
    // Don't start another chairman attempt that can't finish inside the function limit.
    if (Date.now() > deadline) {
      failures.push(`${target.modelId}: skipped, out of time`);
      continue;
    }
    try {
      const { text, raw } = await callModel(target, CHAIRMAN_SYSTEM_PROMPT, chairmanPrompt);
      const parsed = extractJsonObject<RawChairmanJson>(text);
      return {
        modelId: target.modelId,
        finalVerdict: parsed.finalVerdict ?? text,
        overallScore: clampScore(parsed.overallScore),
        recommendation: ["fund", "iterate", "pass"].includes(parsed.recommendation) ? parsed.recommendation : "iterate",
        raw,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Chairman model ${target.modelId} failed:`, message);
      failures.push(`${target.modelId}: ${message}`);
    }
  }

  throw new Error(`All chairman models failed: ${failures.join("; ")}`);
}
