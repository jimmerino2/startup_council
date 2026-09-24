import { PERSONAS, resolveChairmanModelTargets, resolveModelTarget, CHAIRMAN_SYSTEM_PROMPT } from "../config/personas.js";
import { extractJsonObject } from "./openrouter.js";
import { callModel } from "./modelRouter.js";
import { ModelCallError } from "./modelError.js";
import type { ChairmanVerdict, PersonaKey, PersonaReview, PersonaVerdict, SessionInput, UserModelSettings } from "../types.js";

interface RawPersonaJson {
  verdict: string;
  score: number;
  strengths: string[];
  concerns: string[];
}

interface RawReviewJson {
  critique: string;
  ranking: string[];
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

const LETTERS = "ABCDEFGHIJ";

function reviewSystemPrompt(label: string, count: number): string {
  return `You are the ${label} on a startup/hackathon idea review council, now in the anonymous peer-review round. You will see the original submission and ${count} other council members' verdicts, labelled Response A, B, C... with the authors hidden. Critique them briefly (which are most rigorous, which miss something important), then rank ALL of them from best to worst. Judge the quality of the reasoning, not whether it agrees with you. Respond with ONLY a JSON object (no markdown fences, no prose outside the JSON) matching exactly this shape:
{
  "critique": "2-4 sentence critique of the responses, referring to them by letter",
  "ranking": ["<letter of best>", "<next>", "..."]
}`;
}

/**
 * Runs one persona's peer review: the other personas' verdicts are shown under
 * shuffled letter labels (no persona names or model ids), and the letter ranking
 * that comes back is mapped to persona keys here.
 */
export async function reviewPersona(
  persona: (typeof PERSONAS)[number],
  input: SessionInput,
  allVerdicts: PersonaVerdict[],
  settings: UserModelSettings | undefined
): Promise<PersonaReview> {
  const target = resolveModelTarget(persona, settings);
  const others = allVerdicts.filter((v) => v.personaKey !== persona.key);
  const MAX_PARSE_ATTEMPTS = 2;
  let lastParseError = "";

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt++) {
    // Reshuffle per attempt and per reviewer so letter position carries no signal.
    const shuffled = [...others].sort(() => Math.random() - 0.5);
    const keyByLetter = new Map(shuffled.map((v, i) => [LETTERS[i], v.personaKey] as const));
    const prompt = `${buildSubmissionPrompt(input)}

# Council Verdicts (anonymous)
${shuffled
  .map(
    (v, i) => `## Response ${LETTERS[i]} (score: ${v.score}/10)
${v.verdict}
Strengths: ${v.strengths.join("; ")}
Concerns: ${v.concerns.join("; ")}`
  )
  .join("\n\n")}`;

    const { text } = await callModel(target, reviewSystemPrompt(persona.label, others.length), prompt);
    try {
      const parsed = extractJsonObject<RawReviewJson>(text);
      const ranking: PersonaKey[] = [];
      for (const raw of Array.isArray(parsed.ranking) ? parsed.ranking : []) {
        const key = keyByLetter.get(String(raw).trim().toUpperCase().slice(0, 1));
        if (key && !ranking.includes(key)) ranking.push(key);
      }
      if (ranking.length === 0) throw new Error("ranking had no valid letters");
      return { reviewer: persona.key, critique: parsed.critique ?? text, ranking };
    } catch (err) {
      lastParseError = (err as Error).message;
      console.warn(`Review by ${persona.key} (${target.modelId}) unparseable on attempt ${attempt}/${MAX_PARSE_ATTEMPTS}`);
    }
  }
  throw new Error(`Review by ${persona.key} (${target.modelId}) returned unparseable output: ${lastParseError}`);
}

/** Mean rank position (1 = best) per persona across all reviews that ranked it. */
export function averageRanks(reviews: PersonaReview[]): Map<PersonaKey, number> {
  const totals = new Map<PersonaKey, { sum: number; n: number }>();
  for (const r of reviews) {
    r.ranking.forEach((key, i) => {
      const t = totals.get(key) ?? { sum: 0, n: 0 };
      t.sum += i + 1;
      t.n += 1;
      totals.set(key, t);
    });
  }
  return new Map([...totals].map(([k, t]) => [k, t.sum / t.n]));
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
  reviews: PersonaReview[],
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
  .join("\n\n")}

# Peer Review (each member's anonymous critique and ranking of the others)
Average rank by peers (1 = best): ${
    [...averageRanks(reviews)]
      .sort((a, b) => a[1] - b[1])
      .map(([key, avg]) => `${key} ${avg.toFixed(1)}`)
      .join(", ") || "n/a"
  }

${reviews.map((r) => `## Review by ${r.reviewer}\n${r.critique}\nRanking: ${r.ranking.join(" > ")}`).join("\n\n")}`;

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
