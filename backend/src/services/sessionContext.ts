export interface Criterion {
  name: string;
  description: string;
  weight: number | null;
}

/** The optional context a user can attach to a session. */
export interface SessionContext {
  eventType?: string | null;
  stage?: string | null;
  links?: string[] | null;
  problemStatement?: string | null;
}

/**
 * What the council reads as the "problem statement": the structured context (event type, stage,
 * links) followed by the user's own text. The context is stored in its own columns, so it is
 * combined here, at prompt time, instead of being baked into the stored text.
 */
export function composeProblemStatement({ eventType, stage, links, problemStatement }: SessionContext): string {
  const lines: string[] = [];
  if (eventType) lines.push(`- Event type: ${eventType}`);
  if (stage) lines.push(`- Stage: ${stage}`);
  if (links?.length) lines.push(`- Links: ${links.join(", ")}`);

  const parts: string[] = [];
  if (lines.length) parts.push(`Context:\n${lines.join("\n")}`);
  if (problemStatement?.trim()) parts.push(problemStatement.trim());
  return parts.join("\n\n") || "Not provided.";
}

/** Validates the rubric rows from a request body. Returns null when absent, throws on malformed input. */
export function parseCriteria(raw: unknown): Criterion[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.length > 20) throw new Error("criteria must be a list of at most 20 items");
  const rows: Criterion[] = [];
  for (const item of raw) {
    const name = typeof item?.name === "string" ? item.name.trim().slice(0, 120) : "";
    if (!name) continue;
    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : null;
    rows.push({ name, description: typeof item.description === "string" ? item.description.trim().slice(0, 500) : "", weight });
  }
  return rows.length ? rows : null;
}

/** Trimmed, length-limited optional label (event type, stage). */
export function parseLabel(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 80) : null;
}

export function parseLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    .map((l) => l.trim().slice(0, 500))
    .slice(0, 10);
}
