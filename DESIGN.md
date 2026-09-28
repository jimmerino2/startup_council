# Startup Council: design

This file describes the app's visual system and the council graph, which is the one graph in the app. The graph sits on a
session's results page and shows how that session's council reached its verdict. Everything here is built from data the
app already stores, with no extra model calls.

There is no cross-session graph. An earlier design linked sessions through shared sources, criteria, event type and
stage. It was dropped because people have few sessions (at most about 20, realistically 5), so the graph would have been
mostly isolated dots.

## Guidelines and tooling

UI work follows the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). The
`web-design-guidelines` Claude Code skill is installed globally. Ask Claude to "review my UI" (or name the files) to
audit changes against the current rules before merging. The rules this app relies on most:

- Visible `:focus-visible` rings everywhere. Never remove an outline without a replacement.
- `<button>` for actions, `<a>`/`RouterLink` for navigation, icon-only buttons have an `aria-label`.
- Async updates announced with `aria-live="polite"`, plus a skip link to `#main`.
- `color-scheme` and `theme-color` set, and native controls themed explicitly.
- Transitions list their properties (never `transition: all`), and every animation has a `prefers-reduced-motion` path.
- `…` rather than `...`, loading text ending in `…`, `tabular-nums` on scores and ranks, and `Intl.*` for dates and numbers.
- View state goes in the URL: the graph's `?view=list`, `?detail=reviews` and `?node=<id>`.
- Title Case for headings and buttons ("New Judging", "Clear Selection").

## Visual system

The app aims for Obsidian's calm, dense, note-taking feel: a dark, quiet background, thin borders, small text, a
single purple accent, and colour only where it carries meaning.

Tokens live in `frontend/src/style.css` on `:root`. Dark is the default, and light follows `prefers-color-scheme: light`.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#1e1e1e` | `#ffffff` | Page |
| `--surface` | `#262626` | `#f6f6f6` | Cards, inputs, side panels |
| `--surface-raised` | `#2c2c2c` | `#ffffff` | Popovers, toolbars, graph settings |
| `--hover` | `#363636` | `#ebebeb` | Hover and active backgrounds |
| `--fg` / `--fg-soft` / `--muted` | `#dadada` / `#b3b3b3` / `#8a8a8a` | `#222` / `#444` / `#6b6b6b` | Text tiers |
| `--border` | `#363636` | `#e0e0e0` | Hairlines |
| `--accent` | `#8a5cf5` | `#7050e0` | Primary buttons, active nav, focus, graph highlight |
| `--success` / `--warn` / `--danger` | `#44cf6e` / `#e9973f` / `#fb464c` | darker variants | Fund / iterate / pass, errors |

- Type: Inter, falling back to the system UI font, at 15px and 1.55 line height. Headings use `text-wrap: balance`.
- Radius: 8px (`--radius`) for small panels, 10 to 12px for cards, and 6px for controls. Tags are pills with
  `success`, `warn`, `danger` and `accent` tones.
- Buttons: `.btn` (accent), `.btn-secondary` (raised surface), `.btn-ghost`, `.btn-danger`, plus `.btn-sm` and
  `.btn-lg`. All have hover and active states and a 1px press.
- Shared pieces: `AppIcon` (Lucide-style line icons), `PersonaAvatar` (initials on a per-member hue, used only to help
  you recognise a member, never to carry meaning), `ScoreRing` (a score out of 10 as a gauge, with the number always
  printed), and `HeroGraph` (a decorative static graph). Role names live in one place, `lib/personas.ts`.
- Motion: 120 to 180ms colour, opacity and transform transitions. Reduced motion shortens every transition and
  animation to effectively none.

## App structure

The app is an Obsidian-style workspace (`App.vue`):

- **Ribbon** (48px, far left): the brand, a sidebar toggle, New Judging and Home at the top, and How It Works and
  Settings at the bottom.
- **Sidebar** (272px, collapsible, remembered per browser): works like a vault's file explorer. It has a filter box,
  one row per session (a status dot, the title and the date), and the account with sign-out at the bottom. On phones
  it becomes a drawer, and the ribbon's links move into it.
- **Main pane**: a slim view header showing the current page's title, then the page. The pane scrolls, not the window.
  Pages are keyed by session id, so switching sessions in the sidebar reloads the data.
- Signed out, the sign-in and About pages render full-bleed without the workspace chrome.

**No API keys yet.** There are no server-wide provider keys, so a user with no saved key can't run anything.
`stores/keys.ts` tracks whether any key exists. It is checked on sign-in, on Home, and on New Judging, and Settings
keeps it updated as keys are added or deleted. While there are none:

- Home replaces the "Judge a new idea" card with a two-step setup guide: add a key (links to Settings and to
  openrouter.ai/keys), then judge your first idea (locked).
- The sidebar shows an "Add an API key" prompt.
- New Judging shows a locked panel instead of the form. The draft stays saved.
- Settings → API Keys shows a welcome note recommending OpenRouter, since every role uses it by default. Adding the
  first key shows "You're set up. Start your first judging".
- The backend enforces the same rule: `POST /api/sessions` returns 403 with `code: "no_api_keys"`.

A disabled or rate-limited key still counts as having a key; those states are handled per step with retries. If the
key check itself fails, nothing is locked, because the backend is the real gate.

Pages:

| Page | Layout |
| --- | --- |
| Home (`/sessions`) | A "Judge a new idea" hero card with the four-step pipeline, three stat tiles (sessions, complete, in progress), then a grid of session cards with status tags |
| New Judging | Numbered blocks (1 Pitch, 2 Criteria, 3 Council, 4 Context, collapsible) on the left. A sticky "Ready to submit?" panel on the right has a live checklist, an estimate of model calls and the submit button. The rubric has a weight meter that turns green at exactly 100%. Members are toggle cards with avatars |
| Session | A header with meta and a "Council says" verdict chip, then a **stepper that doubles as tabs**: Evidence, Verdicts, Peer Review, Decision, and Graph. Each step shows its state (locked, ready, running, needs attention, done). The page opens on the step that needs you next, and the tab is kept in `?tab=` |
| Settings | Obsidian settings layout: a section list (API Keys, Models, Evidence) on the left and rows of name, description and control on the right, with a sticky save bar. The section is kept in `?section=` |
| About | A landing page: hero with the decorative graph, four step cards, "what you do", role cards with avatars, Chairman and Clerk cards, and "good to know" |
| Sign in | Split screen: the form on the left and the decorative graph on the right (hidden on phones) |

Session tabs:

- **Evidence**: request cards showing who asked (avatars), what they asked for, a status tag, a summary, and sources with
  domain and download state. Each card has its own retry.
- **Verdicts**: a progress bar, then member cards with an avatar, the model, a score ring, the verdict, and strengths
  and concerns side by side. While running they show a shimmer skeleton; if failed, a retry.
- **Peer Review**: a **ranking matrix** (reviewers × reviewed, cells tinted by rank, average row) and **Score vs. peer
  standing**. The second panel compares each member's score with their average peer rank and flags big gaps (for
  example "Bullish, but peers weren't convinced"). Below them, one collapsible critique list per reviewer.
- **Decision**: a hero with the overall-score ring and the recommendation word in its colour, the chairman's text, and
  "How the council voted" score bars.
- **Graph**: see below.

## Scale

A session has at most six members, so the graph is a handful of nodes plus evidence and, optionally, up to 30 review
nodes. At that scale plain SVG is enough and layouts settle in under a second.

The graph is an aid to reading, not a replacement for the results page. Anything shown in the graph must also be
reachable as text (see Accessibility).

## What it answers

*How did this council reach its verdict, and where do members disagree?*

The main thing the graph exists to show is a **mismatch between a member's own score and how peers ranked them** (for
example, an Optimist who scored 9 but was ranked last by everyone). That mismatch is where the interesting story is.

## Nodes and edges

Following Obsidian, **every node is a small flat circle**. Kind is carried by colour group (see the legend) rather than
by shape.

| Element | Colour group | Meaning |
| --- | --- | --- |
| Persona | `--graph-persona` (purple) | A council member, sized by score (5 to 10.5px radius) |
| Verdict | `--graph-note` (grey) | A member's verdict, labelled with its first sentence, like a note in a vault |
| Chairman | Recommendation colour, with a ✓ / ~ / ✕ glyph | Largest node, near the centre |
| Final verdict | Recommendation colour, with a glyph | Attached to the chairman |
| Review (optional layer) | `--graph-review` (amber), tiny | One peer review, reviewer → review → reviewed |
| Evidence | `--graph-evidence` (dim grey) | One evidence request. Drawn **hollow** when nothing was found, like Obsidian's unresolved links |
| Source | `--graph-source` (teal) | A domain the evidence cited, like Obsidian's attachments |
| Line A → B (peer ranking) | `--graph-line` | A ranked B. Thicker = ranked higher (rank 1 thickest). Hover for the critique |
| Other lines | `--graph-line` | Persona → verdict, persona → chairman, persona → evidence, evidence → source |

Peer reviews are stored one row per (reviewer, reviewed) pair, each with a rank and a short critique. The graph draws
them as lines by default, or as review nodes with `?detail=reviews`.

## Graph visual language (Obsidian graph view)

- **Canvas**: `--graph-bg` (slightly darker than the page), no grid, and a hairline border with 8px radius.
- **Nodes**: flat fills with no gradients or shadows. A hollow dot means an empty result, a red ring means failed, and a
  dashed ring means still running.
- **Links**: 1px hairlines at 50% opacity with small arrowheads on directed links (toggleable). Strokes use
  `non-scaling-stroke`, so they stay hairlines at any zoom.
- **Labels**: 11px at every zoom level, sitting under the node with a background-coloured halo. Like Obsidian's *text
  fade threshold*, they fade out as you zoom out (fully hidden below about 0.55×). Highlighted labels always show.
- **Hover**: the hovered node gets a ring, its links turn `--accent`, its neighbours stay lit, and everything else dims
  to 15%. A **page-preview popover** (title, score, recommendation, first 220 characters) appears under the node.
- **Selection**: an accent ring, plus the same neighbourhood highlight as hover (Obsidian's local graph).
- **Legend**: bottom-left, listing only the groups present.
- **Controls**: a small floating toolbar at top right with zoom in, zoom out, fit, reset layout and settings.
- **Settings panel** (Obsidian's graph settings): collapsible sections for
  - *Filters*: search, "Evidence & sources" (off by default, the noisier layer), "Reviews as nodes".
  - *Display*: arrows, node size.
  - *Forces*: repel force, link distance. Changes re-heat the simulation live.

## Layout

- The graph is the last tab on the session page. It is not a step, so it never blocks the flow, and it stays disabled
  until there are verdicts. The canvas is 560px tall with a 320px detail panel beside it, and the panel stacks under
  the canvas below 960px.
- Peer-review links (up to 30, all between members) pull weakly and at 2.2× the link distance, while structural links
  hold firm. Without that, the member ring collapses into a knot.
- Once the layout settles, the view re-frames to fit it, unless you have already zoomed or panned.
- Force-directed layout (`d3-force`), tuned for stability:
  - Personas start on a ring, verdicts just outside their persona, evidence further out, and the chairman at the centre.
  - Starting positions are seeded from the node id, so the same session always looks the same.
  - Positions persist across data reloads and filter changes, so the picture doesn't jump while a session is running.
  - Most settling happens off-screen before the first frame, then the view fits to content.
  - Dragging a node pins it; double-click unpins it. "Reset layout" unpins everything.

## Interaction

| Action | Result |
| --- | --- |
| Hover or focus a node | Page-preview popover and neighbourhood highlight |
| Click a node, or press Enter or Space on it | Select it and show it in the detail panel. Click again to deselect |
| Click the background, or press Escape | Clear selection (Escape closes the settings panel first) |
| Drag a node | Move and pin it |
| Drag the background | Pan |
| Ctrl/⌘ + scroll, trackpad pinch, two-finger pinch | Zoom around the pointer (clamped 0.3× to 3×) |
| Plain scroll over the canvas | Scrolls the page, with a brief "Hold Ctrl and scroll to zoom" hint (no scroll hijacking) |
| `+` / `-` / `0` | Zoom in, zoom out, fit |
| Search, then Enter | Highlight matches, then select and centre the first |
| Graph / List toggle | Switches between the canvas and a table (`?view=list`) |

## Detail panel

A 300px side panel with a predictable structure:

- a kicker naming the kind (MEMBER, VERDICT, REVIEW…)
- a heading
- a facts list (score, average peer rank, rank given, recommendation as a text badge)
- the full text, strengths and concerns (for a member, this is that member's verdict)
- actions: "Open in Verdicts" for members and verdicts, and "Clear Selection"

With nothing selected, it explains what to look for (score versus peer-rank mismatch). It is an `aria-live="polite"`
region, and the selected node is kept in `?node=`.

## Empty and partial states

- Before any verdicts exist, the section is hidden.
- While verdicts are running, nodes appear as they complete, and running members get a dashed ring.
- A failed persona or evidence request gets a red ring, and "Failed" appears in the preview.
- A graph load error names the problem and says to reload.

## Accessibility

- **Text equivalent**: the List view is a table of members with score, average rank received and evidence count.
  Clicking a name selects that member in the detail panel. It is the default view under 480px.
- Nodes are focusable (`role="button"`, `aria-pressed`, a descriptive `aria-label`), and focus shows the preview and
  highlight. The SVG's label summarises the graph.
- The minimum hit area is 32px on screen however small the dot is drawn.
- Colour is never the only carrier of meaning: recommendations also show a glyph on the node and a text badge in the
  panel.

## Data contract

The graph comes from the backend as `{ nodes, edges }`, built by a pure function in `backend/src/services/graph.ts` from
stored rows. The frontend filters layers (evidence and sources) but never computes structure.

- `GET /api/sessions/:id/graph`, with `?detail=reviews` to draw each peer review as a node. The endpoint is
  authenticated and owner-scoped by row-level security.

Node: `{ id, kind, label, title?, subtitle?, score?, status?, recommendation?, text?, strengths?, concerns?, rank?, critique? }`,
where `kind` is `persona | verdict | chairman | final_verdict | review | evidence | source`.

Edge: `{ source, target, kind, weight, critique? }`, where `kind` is
`reviewed | wrote | about | verdict | concludes | requested | cites | advises`. `weight` is the rank (1 = best) for
`reviewed`, `wrote` and `about` edges, and 1 otherwise.

A possible addition that needs no extra model calls: per-criterion scores per persona, so criteria can become nodes.
This needs a prompt change only.

## Non-goals

- No editing the graph. It is derived, not authored.
- No cross-session graph.
- No 3D, no minimap, no plugin system.

## Build order

1. (Done) Backend graph endpoint, verdict and review nodes, a minimal SVG graph, and a detail panel.
2. (Done) Obsidian-style redesign: tokens and theme, circles-only nodes, hover preview, label fade, zoom and pan,
   pinch, settings panel (filters, display, forces), seeded and persistent layout, pinning, keyboard access, List
   view, side detail panel, URL state.
3. (Done) Full makeover: the workspace shell (ribbon, sidebar, view header), a new Home, the New Judging builder, the
   session stepper tabs with the ranking matrix and score-versus-standing panel, Obsidian-style Settings, and landing
   and sign-in pages.
4. Next: show score-versus-rank mismatches on the graph canvas too (for example a warning halo on a flagged member),
   and a session delete or archive action in the sidebar.
