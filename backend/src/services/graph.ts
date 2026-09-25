// Pure graph builders. They only reshape rows the database already holds (no model calls), so the
// routes can hand the result straight to the browser. See DESIGN.md for how the graphs are drawn.

export type NodeKind = "source" | "persona" | "chairman" | "evidence" | "review" | "verdict" | "final_verdict";
export type EdgeKind = "cites" | "reviewed" | "wrote" | "about" | "requested" | "advises" | "verdict" | "concludes";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** 0-10 score for persona, verdict and chairman nodes. */
  score?: number | null;
  status?: string | null;
  recommendation?: string | null;
  /** Review nodes: the critique text, and the rank given. */
  critique?: string | null;
  rank?: number;
  /** Longer text for the detail panel: a persona's verdict, the chairman's final verdict, a critique. */
  text?: string | null;
  strengths?: string[];
  concerns?: string[];
  /** Heading for the detail panel when the label is only an excerpt. */
  title?: string;
  /** One line saying what the node is, e.g. "Skeptic ranked Optimist #2". */
  subtitle?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: EdgeKind;
  /** Review edges (reviewed, wrote, about): the rank (1 = best) the reviewer gave. Others: 1. */
  weight: number;
  /** Reviewed edges: the critique of the reviewed persona, when there is one. */
  critique?: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Hostname without a leading "www.", or null if the URL is unusable. */
export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

// --- Session graph: how one council reached its verdict -----------------------------------------

export interface SessionGraphPersona {
  persona_key: string;
  status: string;
  score: number | null;
  verdict_text?: string | null;
  strengths?: string[] | null;
  concerns?: string[] | null;
}

export interface SessionGraphReview {
  reviewer_key: string;
  reviewed_key: string;
  rank: number;
  critique: string | null;
}

export interface SessionGraphEvidence {
  id: string;
  description: string;
  status: string;
  requested_by: string[] | null;
  persona_key: string;
  kind: string;
  sources: { url?: string }[] | null;
}

export interface SessionGraphChairman {
  overall_score: number | null;
  recommendation: string | null;
  final_verdict_text?: string | null;
}

/** First sentence of a verdict, shortened, used as the node's label. */
function excerpt(text: string, max = 40): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

const personaLabel = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Personas (sized by score), the peer-review rankings between them, the evidence they asked for
 * and where it came from, and the chairman they all feed into.
 */
export function buildSessionGraph(
  personaLabels: Record<string, string>,
  personas: SessionGraphPersona[],
  evidence: SessionGraphEvidence[],
  chairman: SessionGraphChairman | null,
  reviews: SessionGraphReview[] = [],
  { reviewNodes = false }: { reviewNodes?: boolean } = {}
): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const present = new Set(personas.map((p) => p.persona_key));

  for (const p of personas) {
    nodes.push({
      id: `persona:${p.persona_key}`,
      kind: "persona",
      label: personaLabels[p.persona_key] ?? personaLabel(p.persona_key),
      score: p.score,
      status: p.status,
      text: p.verdict_text ?? null,
      strengths: p.strengths ?? [],
      concerns: p.concerns ?? [],
    });
    // The verdict is its own node, so it can be selected and read like the reviews are.
    if (p.verdict_text?.trim()) {
      const name = personaLabels[p.persona_key] ?? personaLabel(p.persona_key);
      nodes.push({
        id: `verdict:${p.persona_key}`,
        kind: "verdict",
        label: excerpt(p.verdict_text),
        title: `${name}: verdict`,
        score: p.score,
        text: p.verdict_text,
        strengths: p.strengths ?? [],
        concerns: p.concerns ?? [],
      });
      edges.push({ source: `persona:${p.persona_key}`, target: `verdict:${p.persona_key}`, kind: "verdict", weight: 1 });
    }
  }

  for (const r of reviews) {
    if (!present.has(r.reviewer_key) || !present.has(r.reviewed_key) || r.reviewer_key === r.reviewed_key) continue;
    const from = `persona:${r.reviewer_key}`;
    const to = `persona:${r.reviewed_key}`;
    if (reviewNodes) {
      // Each review is its own node between reviewer and reviewed, carrying the rank and critique.
      const id = `review:${r.reviewer_key}:${r.reviewed_key}`;
      const name = (key: string) => personaLabels[key] ?? personaLabel(key);
      nodes.push({
        id,
        kind: "review",
        label: `#${r.rank}`,
        rank: r.rank,
        critique: r.critique,
        text: r.critique,
        subtitle: `${name(r.reviewer_key)} ranked ${name(r.reviewed_key)} #${r.rank}`,
      });
      edges.push({ source: from, target: id, kind: "wrote", weight: r.rank });
      edges.push({ source: id, target: to, kind: "about", weight: r.rank });
    } else {
      edges.push({ source: from, target: to, kind: "reviewed", weight: r.rank, critique: r.critique });
    }
  }

  const sourceNodes = new Set<string>();
  for (const e of evidence) {
    if (e.kind === "request_list") continue; // a failed "what to ask for" step, not evidence
    const id = `evidence:${e.id}`;
    nodes.push({ id, kind: "evidence", label: e.description.length > 60 ? `${e.description.slice(0, 57)}…` : e.description, status: e.status });
    for (const key of e.requested_by?.length ? e.requested_by : [e.persona_key]) {
      if (present.has(key)) edges.push({ source: `persona:${key}`, target: id, kind: "requested", weight: 1 });
    }
    for (const src of e.sources ?? []) {
      const domain = src.url ? domainOf(src.url) : null;
      if (!domain) continue;
      const sourceId = `source:${domain}`;
      if (!sourceNodes.has(sourceId)) {
        sourceNodes.add(sourceId);
        nodes.push({ id: sourceId, kind: "source", label: domain });
      }
      edges.push({ source: id, target: sourceId, kind: "cites", weight: 1 });
    }
  }

  if (chairman) {
    nodes.push({
      id: "chairman",
      kind: "chairman",
      label: "Chairman",
      score: chairman.overall_score,
      recommendation: chairman.recommendation,
      status: "complete",
      text: chairman.final_verdict_text ?? null,
    });
    if (chairman.final_verdict_text?.trim()) {
      nodes.push({
        id: "final_verdict",
        kind: "final_verdict",
        label: excerpt(chairman.final_verdict_text),
        title: "Chairman: final verdict",
        score: chairman.overall_score,
        recommendation: chairman.recommendation,
        text: chairman.final_verdict_text,
      });
      edges.push({ source: "chairman", target: "final_verdict", kind: "concludes", weight: 1 });
    }
    for (const p of personas) {
      if (p.status === "complete") edges.push({ source: `persona:${p.persona_key}`, target: "chairman", kind: "advises", weight: 1 });
    }
  }
  return { nodes, edges };
}
