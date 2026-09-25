import type { SupabaseClient } from "@supabase/supabase-js";
import { PERSONAS, maxEvidenceFor, resolveClerkTarget } from "../config/personas.js";
import { extractEvidence, findEvidence, requestEvidence } from "./council.js";
import { fetchDocument } from "./fetchDocument.js";
import type { EvidenceItem, PersonaKey, SessionInput, UserModelSettings } from "../types.js";

// The whole evidence stage gets a hard budget so it can't eat the function's time. Whatever the
// clerk hasn't finished by then is marked failed and can be retried one request at a time.
const EVIDENCE_DEADLINE_MS = 120_000;
// One request is one document: sources are tried in order until one downloads, so a request
// stores a single document (plus any earlier attempts that failed) instead of fetching everything cited.
const MAX_DOWNLOAD_ATTEMPTS = 3;

export interface EvidenceContext {
  sessionId: string;
  userId: string;
  input: SessionInput;
}

interface RequestRow {
  id: string;
  description: string;
  reason: string | null;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Runs one evidence request end to end and always leaves it in a stored, explicit state:
 *   complete   facts extracted from the downloaded documents
 *   partial    sources were found but unreadable/irrelevant, so only the search summary is kept
 *   not_found  the search returned nothing citable
 *   failed     a model call errored (retryable)
 */
export async function processRequest(supabase: SupabaseClient, ctx: EvidenceContext, row: RequestRow, settings: UserModelSettings | undefined) {
  const table = () => supabase.from("evidence_requests");
  // The status guard stops a late result from overwriting the "timed out" marker set by the stage deadline.
  const finish = (fields: Record<string, unknown>) => table().update(fields).eq("id", row.id).in("status", ["pending", "running"]);

  await table().update({ status: "running", summary: null, sources: [], note: null, error_message: null }).eq("id", row.id);
  await supabase.from("evidence_documents").delete().eq("request_id", row.id);

  const request = { description: row.description, reason: row.reason ?? "" };

  let found;
  try {
    found = await findEvidence(request, ctx.input, settings);
  } catch (err) {
    console.error(`Clerk search failed for request ${row.id}:`, errorMessage(err));
    await finish({ status: "failed", error_message: errorMessage(err) });
    return;
  }

  if (found.sources.length === 0) {
    await finish({ status: "not_found", model_id: found.modelId, note: "The search returned no citable sources." });
    return;
  }

  // Extraction off: skip the download and the second call, and keep the clerk's search summary.
  if (settings?.extractEvidence === false) {
    await finish({
      status: "complete",
      summary: found.summary,
      sources: found.sources.slice(0, MAX_DOWNLOAD_ATTEMPTS),
      model_id: found.modelId,
      note: "Extraction is turned off in Settings, so this is the clerk's search summary.",
    });
    return;
  }

  // Try the cited sources in order and stop at the first one that downloads. Every attempt is recorded.
  const attempts: { source: (typeof found.sources)[number]; doc: Awaited<ReturnType<typeof fetchDocument>> | null; error: string | null }[] = [];
  for (const source of found.sources.slice(0, MAX_DOWNLOAD_ATTEMPTS)) {
    try {
      attempts.push({ source, doc: await fetchDocument(source.url), error: null });
      break;
    } catch (err) {
      attempts.push({ source, doc: null, error: errorMessage(err) });
    }
  }
  // Only the sources actually tried are kept, so the page never lists documents that weren't read.
  const tried = attempts.map((t) => t.source);

  await supabase.from("evidence_documents").insert(
    attempts.map(({ source, doc, error }) => ({
      request_id: row.id,
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      url: doc?.url ?? source.url,
      title: source.title,
      content_type: doc?.contentType ?? null,
      bytes: doc?.bytes ?? null,
      raw_text: doc?.text ?? null,
      fetch_status: doc ? "fetched" : "failed",
      error_message: error,
    }))
  );

  const readable = attempts.filter((t) => t.doc).map((t) => ({ url: t.doc!.url, title: t.source.title, text: t.doc!.text }));

  let extracted: string | null = null;
  let extractNote: string | null = null;
  if (readable.length > 0) {
    try {
      extracted = await extractEvidence(request, readable, settings);
      if (!extracted) extractNote = "The downloaded document did not contain what was requested.";
    } catch (err) {
      extractNote = `Extraction failed (${errorMessage(err)}).`;
    }
  } else {
    extractNote = `None of the ${attempts.length} source(s) tried could be downloaded.`;
  }

  if (extracted) {
    await finish({ status: "complete", summary: extracted, sources: tried, model_id: found.modelId });
  } else {
    // Fallback: keep the search summary so the request still returns something usable.
    await finish({
      status: "partial",
      summary: found.summary,
      sources: tried,
      model_id: found.modelId,
      note: `${extractNote} Showing the clerk's search summary instead.`,
    });
  }
}

/** Words that carry no meaning when comparing two requests. */
const STOP_WORDS = new Set(["the", "and", "for", "of", "in", "on", "to", "a", "an", "with", "from", "about", "by", "at", "is", "are", "or", "any"]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  );
}

/** Two requests are "the same" when most of their meaningful words overlap (Jaccard similarity). */
function isSimilar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared) >= 0.5;
}

/** Has one persona decide what to ask for. On failure records a retryable "request_list" row and returns []. */
async function askPersona(
  supabase: SupabaseClient,
  ctx: EvidenceContext,
  personaKey: PersonaKey,
  max: number,
  settings: UserModelSettings | undefined
): Promise<{ description: string; reason: string }[]> {
  const persona = PERSONAS.find((p) => p.key === personaKey)!;
  try {
    return await requestEvidence(persona, ctx.input, max, settings);
  } catch (err) {
    console.error(`Evidence request by ${personaKey} failed for session ${ctx.sessionId}:`, errorMessage(err));
    await supabase.from("evidence_requests").insert({
      session_id: ctx.sessionId,
      user_id: ctx.userId,
      persona_key: personaKey,
      requested_by: [personaKey],
      kind: "request_list",
      description: "(could not decide what evidence to request)",
      status: "failed",
      error_message: errorMessage(err),
    });
    return [];
  }
}

/**
 * Stores a persona's requests. A request that matches one already on file (from another persona, or
 * an earlier one of its own) is merged into it, so it is searched, downloaded and extracted once and
 * the persona is simply added to `requested_by`. Returns only the new rows that still need processing.
 */
async function storeRequests(
  supabase: SupabaseClient,
  ctx: EvidenceContext,
  personaKey: PersonaKey,
  requests: { description: string; reason: string }[]
): Promise<RequestRow[]> {
  if (requests.length === 0) return [];

  const { data: existing } = await supabase
    .from("evidence_requests")
    .select("id, description, requested_by")
    .eq("session_id", ctx.sessionId)
    .eq("kind", "document");
  const pool = (existing ?? []).map((r) => ({ id: r.id as string, description: r.description as string, requestedBy: (r.requested_by ?? []) as string[] }));

  const fresh: { description: string; reason: string }[] = [];
  for (const r of requests) {
    const match = pool.find((p) => isSimilar(p.description, r.description));
    if (!match) {
      fresh.push(r);
      pool.push({ id: "", description: r.description, requestedBy: [personaKey] });
      continue;
    }
    if (!match.requestedBy.includes(personaKey)) {
      match.requestedBy.push(personaKey);
      if (match.id) await supabase.from("evidence_requests").update({ requested_by: match.requestedBy }).eq("id", match.id);
    }
  }
  if (fresh.length === 0) return [];

  const { data } = await supabase
    .from("evidence_requests")
    .insert(
      fresh.map((r) => ({
        session_id: ctx.sessionId,
        user_id: ctx.userId,
        persona_key: personaKey,
        requested_by: [personaKey],
        description: r.description,
        reason: r.reason,
        status: "running",
      }))
    )
    .select("id, description, reason");
  return (data ?? []) as RequestRow[];
}

/**
 * Step 1: every persona files up to N requests (a user setting) and the clerk fulfils them.
 * Never throws: failures land on the individual request rows, where they can be retried.
 */
export async function runEvidenceStage(supabase: SupabaseClient, ctx: EvidenceContext, settings: UserModelSettings | undefined) {
  const setStatus = (evidence_status: string, evidence_error: string | null = null) =>
    supabase.from("sessions").update({ evidence_status, evidence_error }).eq("id", ctx.sessionId);

  try {
    const max = maxEvidenceFor(settings);
    await supabase.from("evidence_requests").delete().eq("session_id", ctx.sessionId);
    if (max === 0) {
      await setStatus("skipped");
      return;
    }
    const clerk = resolveClerkTarget(settings);
    if (clerk.keys.length === 0) {
      await setStatus("failed", `No ${clerk.provider} API key is saved for the clerk. Add one in Settings, then run step 1 again, or set evidence requests to 0.`);
      return;
    }
    await setStatus("running");

    const work = (async () => {
      // Personas decide in parallel; storing is sequential so merging duplicates is deterministic.
      const lists = await Promise.all(PERSONAS.map(async (p) => ({ key: p.key, requests: await askPersona(supabase, ctx, p.key, max, settings) })));
      const newRows: RequestRow[] = [];
      for (const list of lists) newRows.push(...(await storeRequests(supabase, ctx, list.key, list.requests)));
      await Promise.all(newRows.map((row) => processRequest(supabase, ctx, row, settings)));
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<true>((resolve) => {
      timer = setTimeout(() => resolve(true), EVIDENCE_DEADLINE_MS);
    });
    const didTimeOut = await Promise.race([work.then(() => false), timedOut]);
    clearTimeout(timer);

    if (didTimeOut) {
      await supabase
        .from("evidence_requests")
        .update({ status: "failed", error_message: "Timed out. Retry this request." })
        .eq("session_id", ctx.sessionId)
        .in("status", ["pending", "running"]);
    }
    await setStatus("complete");
  } catch (err) {
    console.error(`Evidence stage failed for session ${ctx.sessionId}:`, errorMessage(err));
    await setStatus("failed", errorMessage(err));
  }
}

/** Retries one request: re-runs the clerk for a document request, or asks the persona again for a failed request list. */
export async function retryEvidenceRequest(supabase: SupabaseClient, ctx: EvidenceContext, requestId: string, settings: UserModelSettings | undefined) {
  const { data: row } = await supabase
    .from("evidence_requests")
    .select("id, persona_key, kind, description, reason")
    .eq("id", requestId)
    .eq("session_id", ctx.sessionId)
    .single();
  if (!row) return;

  if (row.kind === "request_list") {
    await supabase.from("evidence_requests").delete().eq("id", row.id);
    const requests = await askPersona(supabase, ctx, row.persona_key, maxEvidenceFor(settings), settings);
    const rows = await storeRequests(supabase, ctx, row.persona_key, requests);
    await Promise.all(rows.map((r) => processRequest(supabase, ctx, r, settings)));
    return;
  }
  await processRequest(supabase, ctx, row as RequestRow, settings);
}

/** Derived evidence (optionally for one persona), oldest first. Only requests that produced something. */
export async function loadEvidence(supabase: SupabaseClient, sessionId: string, personaKey?: PersonaKey): Promise<EvidenceItem[]> {
  let query = supabase
    .from("evidence_requests")
    .select("requested_by, description, status, summary, sources")
    .eq("session_id", sessionId)
    .eq("kind", "document")
    .in("status", ["complete", "partial", "not_found"]);
  if (personaKey) query = query.contains("requested_by", [personaKey]);
  const { data } = await query.order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    requestedBy: r.requested_by ?? [],
    description: r.description,
    status: r.status,
    summary: r.summary,
    sources: r.sources ?? [],
  }));
}
