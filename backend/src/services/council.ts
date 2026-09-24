import { PERSONAS, resolveModel, resolveChairmanModels, CHAIRMAN_SYSTEM_PROMPT } from "../config/personas.js";
import { callModel, extractJsonObject, OpenRouterError } from "./openrouter.js";
import type { ChairmanVerdict, PersonaVerdict, SessionInput } from "../types.js";

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

function buildSubmissionPrompt(input: SessionInput): string {
  return `# Problem Statement
${input.problemStatement}

# Judging Criteria
${input.judgingCriteria}

# Pitch / Submission
${input.pitchText}`;
}

async function judgeWithPersona(persona: (typeof PERSONAS)[number], submissionPrompt: string): Promise<PersonaVerdict> {
  const modelId = resolveModel(persona);
  try {
    const { text, raw } = await callModel(modelId, persona.systemPrompt, submissionPrompt);
    const parsed = extractJsonObject<RawPersonaJson>(text);
    return {
      personaKey: persona.key,
      modelId,
      verdict: parsed.verdict ?? text,
      score: clampScore(parsed.score),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      raw,
    };
  } catch (err) {
    if (err instanceof OpenRouterError) throw err;
    // JSON parse failure: surface which persona/model broke.
    throw new Error(`Persona ${persona.key} (${modelId}) returned unparseable output: ${(err as Error).message}`);
  }
}

function clampScore(score: unknown): number {
  const n = typeof score === "number" ? score : Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

// Free-tier OpenRouter models occasionally fail (upstream rate limits, capacity,
// unparseable output) even after retries. Rather than let one flaky persona sink
// the whole judging run, we proceed as long as a quorum of the council responded.
const MIN_QUORUM = 3;
// No new chairman attempt starts after this, leaving headroom under the 300s function limit.
const COUNCIL_DEADLINE_MS = 170_000;

export async function runCouncil(
  input: SessionInput
): Promise<{ personaVerdicts: PersonaVerdict[]; chairman: ChairmanVerdict; failedPersonas: { personaKey: string; error: string }[] }> {
  const startedAt = Date.now();
  const submissionPrompt = buildSubmissionPrompt(input);
  const settled = await Promise.allSettled(PERSONAS.map((persona) => judgeWithPersona(persona, submissionPrompt)));

  const personaVerdicts: PersonaVerdict[] = [];
  const failedPersonas: { personaKey: string; error: string }[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      personaVerdicts.push(result.value);
    } else {
      const persona = PERSONAS[i];
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`Persona ${persona.key} failed:`, message);
      failedPersonas.push({ personaKey: persona.key, error: message });
    }
  });

  if (personaVerdicts.length < MIN_QUORUM) {
    throw new Error(
      `Only ${personaVerdicts.length}/${PERSONAS.length} council members responded (need at least ${MIN_QUORUM}). Failures: ${failedPersonas
        .map((f) => `${f.personaKey}: ${f.error}`)
        .join("; ")}`
    );
  }

  const missingNote =
    failedPersonas.length > 0
      ? `\n\nNote: ${failedPersonas.map((f) => f.personaKey).join(", ")} did not respond and are excluded below.`
      : "";
  const chairmanPrompt = `${buildSubmissionPrompt(input)}

# Council Verdicts${missingNote}
${personaVerdicts
  .map(
    (v) => `## ${v.personaKey} (score: ${v.score}/10)
${v.verdict}
Strengths: ${v.strengths.join("; ")}
Concerns: ${v.concerns.join("; ")}`
  )
  .join("\n\n")}`;

  const chairman = await runChairman(chairmanPrompt, startedAt + COUNCIL_DEADLINE_MS);

  return { personaVerdicts, chairman, failedPersonas };
}

async function runChairman(chairmanPrompt: string, deadline: number): Promise<ChairmanVerdict> {
  const candidates = resolveChairmanModels();
  const failures: string[] = [];

  for (const chairmanModel of candidates) {
    // Don't start another chairman attempt that can't finish inside the function limit.
    if (Date.now() > deadline) {
      failures.push(`${chairmanModel}: skipped, out of time`);
      continue;
    }
    try {
      const { text, raw } = await callModel(chairmanModel, CHAIRMAN_SYSTEM_PROMPT, chairmanPrompt);
      const parsed = extractJsonObject<RawChairmanJson>(text);
      return {
        modelId: chairmanModel,
        finalVerdict: parsed.finalVerdict ?? text,
        overallScore: clampScore(parsed.overallScore),
        recommendation: ["fund", "iterate", "pass"].includes(parsed.recommendation) ? parsed.recommendation : "iterate",
        raw,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Chairman model ${chairmanModel} failed:`, message);
      failures.push(`${chairmanModel}: ${message}`);
    }
  }

  throw new Error(`All chairman models failed: ${failures.join("; ")}`);
}
