// One place for how council roles are named and drawn, so every view (sidebar, verdict cards, review matrix,
// graph list) agrees. The hue is only used for the member's avatar, never to carry meaning on its own.

export interface PersonaMeta {
  key: string;
  label: string;
  short: string;
  hint: string;
  hue: number;
}

export const PERSONAS: PersonaMeta[] = [
  { key: "judge", label: "Judge", short: "Judge", hint: "Scores strictly against your rubric", hue: 262 },
  { key: "skeptic", label: "Skeptic", short: "Skeptic", hint: "Hunts for reasons it fails", hue: 355 },
  { key: "optimist", label: "Optimist", short: "Optimist", hint: "Makes the case for the upside", hue: 140 },
  { key: "market_analyst", label: "Market Analyst", short: "Market", hint: "Market size, demand, competition", hue: 200 },
  { key: "tech_lead", label: "Technical Feasibility Lead", short: "Tech", hint: "Can it actually be built?", hue: 30 },
  { key: "vc_investor", label: "Reality Checker", short: "Reality", hint: "Investor-style reality check", hue: 310 },
];

const BY_KEY = new Map(PERSONAS.map((p) => [p.key, p]));

export const personaMeta = (key: string): PersonaMeta =>
  BY_KEY.get(key) ?? { key, label: key, short: key, hint: "", hue: 0 };

export const personaLabel = (key: string) => personaMeta(key).label;

export const RECOMMENDATION_LABEL: Record<string, string> = { fund: "Fund", iterate: "Iterate", pass: "Pass" };
export const RECOMMENDATION_COLOR: Record<string, string> = { fund: "var(--success)", iterate: "var(--warn)", pass: "var(--danger)" };
