<script setup lang="ts">
// Council graph in the style of Obsidian's graph view: small flat nodes, hairline links, labels that
// fade out as you zoom out, hover to light up a node's neighbourhood, and a collapsible settings
// panel (filters, display, forces). See DESIGN.md.
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, triggerRef, watch } from "vue";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation } from "d3-force";
import type { GraphData, GraphEdge, GraphNode } from "../lib/api";

const props = withDefaults(
  defineProps<{ graph: GraphData; height?: number; reviewNodes?: boolean; selectedId?: string | null }>(),
  { height: 520, reviewNodes: false, selectedId: null },
);
const emit = defineEmits<{ select: [node: GraphNode | null]; "update:reviewNodes": [value: boolean] }>();

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}
interface SimLink extends Omit<GraphEdge, "source" | "target"> {
  source: SimNode;
  target: SimNode;
}

// --- Settings (the Obsidian-style panel) -----------------------------------------------------

const settingsOpen = ref(false);
const settings = reactive({
  search: "",
  showEvidence: false, // the noisier layer, off by default
  arrows: true,
  nodeSize: 1,
  repel: 380,
  linkDistance: 80,
});

// --- Layout ----------------------------------------------------------------------------------

const wrap = ref<HTMLDivElement | null>(null);
const svg = ref<SVGSVGElement | null>(null);
const size = reactive({ w: 800, h: props.height });
const view = reactive({ k: 1, x: 0, y: 0 });

const nodes = shallowRef<SimNode[]>([]);
const links = shallowRef<SimLink[]>([]);
let sim: Simulation<SimNode, SimLink> | null = null;
// Positions survive reloads and filter changes, so the picture doesn't jump when data arrives.
const positions = new Map<string, { x: number; y: number; pinned: boolean }>();
let fitted = false;
// Once the user zooms or pans, stop re-framing the view for them.
let viewTouched = false;

const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stable pseudo-random number in [0, 1) from a string, so the same session always lays out the same way. */
function seeded(id: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function initialPosition(n: GraphNode, personaIndex: Map<string, number>, personaCount: number) {
  const ring = (key: string | undefined, r: number) => {
    const i = key !== undefined ? personaIndex.get(key) : undefined;
    const a = i !== undefined ? (i / Math.max(personaCount, 1)) * Math.PI * 2 - Math.PI / 2 : seeded(n.id) * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };
  const personaKey = n.id.includes(":") ? n.id.split(":")[1] : undefined;
  switch (n.kind) {
    case "chairman":
      return { x: 0, y: 0 };
    case "final_verdict":
      return { x: 0, y: 40 };
    case "persona":
      return ring(personaKey, 140);
    case "verdict":
      return ring(personaKey, 200);
    default: {
      const a = seeded(n.id) * Math.PI * 2;
      const r = n.kind === "review" ? 80 + seeded(n.id, 1) * 60 : 250 + seeded(n.id, 1) * 80;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
  }
}

const visibleGraph = computed(() => {
  const hidden = new Set(settings.showEvidence ? [] : ["evidence", "source"]);
  const ns = props.graph.nodes.filter((n) => !hidden.has(n.kind));
  const ids = new Set(ns.map((n) => n.id));
  return { nodes: ns, edges: props.graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
});

function rebuild() {
  sim?.stop();
  const { nodes: raw, edges } = visibleGraph.value;
  const personas = raw.filter((n) => n.kind === "persona");
  const personaIndex = new Map(personas.map((p, i) => [p.id.split(":")[1], i]));

  let fresh = 0;
  const ns: SimNode[] = raw.map((n) => {
    const saved = positions.get(n.id);
    if (saved) return { ...n, x: saved.x, y: saved.y, fx: saved.pinned ? saved.x : null, fy: saved.pinned ? saved.y : null };
    fresh++;
    return { ...n, ...initialPosition(n, personaIndex, personas.length) };
  });
  const byId = new Map(ns.map((n) => [n.id, n]));
  const ls: SimLink[] = edges.map((e) => ({ ...e, source: byId.get(e.source)!, target: byId.get(e.target)! }));

  nodes.value = ns;
  links.value = ls;
  sim = forceSimulation<SimNode, SimLink>(ns)
    // Peer-review links are many (up to 30) and all between members, so they pull weakly and long;
    // otherwise they'd clump the ring into a knot. Structure links (member → verdict, → chairman) hold firm.
    .force(
      "link",
      forceLink<SimNode, SimLink>(ls)
        .distance((l) => settings.linkDistance * (isReviewLink(l) ? 2.2 : 1))
        .strength((l) => (isReviewLink(l) ? 0.03 : 0.5)),
    )
    .force("charge", forceManyBody().strength(-settings.repel))
    .force("x", forceX(0).strength(0.05))
    .force("y", forceY(0).strength(0.05))
    .force("collide", forceCollide<SimNode>().radius((n) => radiusOf(n) + 10))
    .on("tick", onTick)
    .on("end", () => {
      if (!viewTouched) fitView(); // frame the settled picture, unless the user has zoomed or panned
    })
    .stop();

  // Only nudge gently when everything already has a place; settle fully when the picture is new.
  sim.alpha(fresh === 0 ? 0.15 : fresh === ns.length ? 1 : 0.5);
  if (reducedMotion) {
    sim.tick(300);
    onTick();
  } else {
    if (!fitted) sim.tick(80); // most of the settling happens off-screen so the first frame is close
    sim.restart();
  }
  if (!fitted) {
    fitView();
    fitted = true;
  }
}

function onTick() {
  for (const n of nodes.value) positions.set(n.id, { x: n.x, y: n.y, pinned: n.fx != null });
  triggerRef(nodes);
}

watch(
  () => [settings.repel, settings.linkDistance, settings.nodeSize],
  () => {
    if (!sim) return;
    (sim.force("charge") as ReturnType<typeof forceManyBody>).strength(-settings.repel);
    (sim.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>>).distance((l) => settings.linkDistance * (isReviewLink(l) ? 2.2 : 1));
    sim.alpha(0.4);
    if (reducedMotion) {
      sim.tick(120);
      onTick();
    } else sim.restart();
  },
);

let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  let first = true;
  resizeObserver = new ResizeObserver(([entry]) => {
    size.w = entry.contentRect.width;
    size.h = entry.contentRect.height;
    if (first) fitView(); // the first fit ran before the canvas had a size
    first = false;
  });
  if (wrap.value) resizeObserver.observe(wrap.value);
});
onBeforeUnmount(() => {
  sim?.stop();
  resizeObserver?.disconnect();
  clearTimeout(hintTimer);
});

// --- Appearance ------------------------------------------------------------------------------

const KIND_COLOR: Record<GraphNode["kind"], string> = {
  persona: "var(--graph-persona)",
  chairman: "var(--graph-chairman)",
  verdict: "var(--graph-note)",
  final_verdict: "var(--graph-note)",
  review: "var(--graph-review)",
  evidence: "var(--graph-evidence)",
  source: "var(--graph-source)",
};
const REC_COLOR: Record<string, string> = { fund: "var(--success)", iterate: "var(--warn)", pass: "var(--danger)" };
// A glyph as well as a colour, so the recommendation doesn't rely on colour alone.
const REC_GLYPH: Record<string, string> = { fund: "✓", iterate: "~", pass: "✕" };

const LEGEND: { kind: GraphNode["kind"]; label: string }[] = [
  { kind: "persona", label: "Member" },
  { kind: "verdict", label: "Verdict" },
  { kind: "chairman", label: "Chairman" },
  { kind: "review", label: "Review" },
  { kind: "evidence", label: "Evidence" },
  { kind: "source", label: "Source" },
];
const legend = computed(() => LEGEND.filter((l) => nodes.value.some((n) => n.kind === l.kind)));

function colorOf(n: GraphNode) {
  if (n.recommendation && REC_COLOR[n.recommendation]) return REC_COLOR[n.recommendation];
  return KIND_COLOR[n.kind] ?? "var(--graph-note)";
}

function radiusOf(n: GraphNode) {
  let r: number;
  if (n.kind === "chairman") r = 11;
  else if (n.kind === "final_verdict") r = 8;
  else if (n.kind === "persona") r = n.score != null ? 5 + n.score * 0.55 : 6; // 0-10 score -> 5-10.5
  else if (n.kind === "review") r = 3;
  else r = 4.5;
  return r * settings.nodeSize;
}

const hollow = (n: GraphNode) => n.kind === "evidence" && (n.status === "not_found" || n.status === "failed");
const running = (n: GraphNode) => n.status === "running" || n.status === "pending";
const failed = (n: GraphNode) => n.status === "failed";

// --- Highlighting ----------------------------------------------------------------------------

const hoverId = ref<string | null>(null);
const focusId = computed(() => hoverId.value ?? props.selectedId);

const neighbours = computed(() => {
  const id = focusId.value;
  if (!id) return null;
  const set = new Set([id]);
  for (const l of links.value) {
    if (l.source.id === id) set.add(l.target.id);
    if (l.target.id === id) set.add(l.source.id);
  }
  return set;
});

const query = computed(() => settings.search.trim().toLowerCase());
const matches = computed(() => {
  if (!query.value) return null;
  return new Set(nodes.value.filter((n) => `${n.label} ${n.title ?? ""}`.toLowerCase().includes(query.value)).map((n) => n.id));
});

function nodeOpacity(n: SimNode) {
  if (neighbours.value) return neighbours.value.has(n.id) ? 1 : 0.15;
  if (matches.value) return matches.value.has(n.id) ? 1 : 0.15;
  return 1;
}

const isFocusLink = (l: SimLink) => !!focusId.value && (l.source.id === focusId.value || l.target.id === focusId.value);

function linkOpacity(l: SimLink) {
  if (focusId.value) return isFocusLink(l) ? 0.9 : 0.06;
  if (matches.value) return matches.value.has(l.source.id) && matches.value.has(l.target.id) ? 0.6 : 0.06;
  return 0.5;
}

/** Labels fade out as you zoom out, like Obsidian's text fade threshold; highlighted ones stay. */
function labelOpacity(n: SimNode) {
  if (neighbours.value) return neighbours.value.has(n.id) ? 1 : 0;
  if (matches.value) return matches.value.has(n.id) ? 1 : 0;
  const base = Math.min(1, Math.max(0, (view.k - 0.55) / 0.35));
  return n.kind === "review" ? base * 0.7 : base;
}

const isReviewLink = (l: SimLink) => l.kind === "reviewed" || l.kind === "wrote" || l.kind === "about";
const directed = (l: SimLink) => l.kind === "reviewed" || l.kind === "about" || l.kind === "requested" || l.kind === "cites";

/** Better peer rank = thicker line (rank 1 thickest). */
const linkWidth = (l: SimLink) => (isReviewLink(l) ? Math.max(0.75, 2.4 - (l.weight - 1) * 0.35) : 1);

/** Line endpoints pulled back to the node edges so arrowheads sit on the rim, not under the node. */
function linkGeometry(l: SimLink) {
  const dx = l.target.x - l.source.x;
  const dy = l.target.y - l.source.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const rs = radiusOf(l.source);
  const rt = radiusOf(l.target) + (settings.arrows && directed(l) ? 2 : 0);
  return { x1: l.source.x + ux * rs, y1: l.source.y + uy * rs, x2: l.target.x - ux * rt, y2: l.target.y - uy * rt };
}

const truncate = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// --- Hover preview (Obsidian's page preview) -------------------------------------------------

const preview = computed(() => {
  const id = hoverId.value;
  if (!id || dragging) return null;
  const n = nodes.value.find((x) => x.id === id);
  if (!n) return null;
  const text = n.text ?? n.critique ?? null;
  return {
    node: n,
    left: n.x * view.k + view.x,
    top: n.y * view.k + view.y + radiusOf(n) * view.k + 10,
    excerpt: text ? truncate(text, 220) : n.kind === "review" ? "No critique recorded." : null,
  };
});

function linkTitle(l: SimLink) {
  if (l.kind !== "reviewed") return "";
  return `${l.source.label} ranked ${l.target.label} #${l.weight}${l.critique ? `: ${l.critique}` : ""}`;
}

// --- Selection -------------------------------------------------------------------------------

function select(n: SimNode | null) {
  emit("select", n && props.selectedId !== n.id ? n : null);
}

function selectFirstMatch() {
  const first = nodes.value.find((n) => matches.value?.has(n.id));
  if (first) {
    emit("select", first);
    centerOn(first);
  }
}

// --- Zoom and pan ----------------------------------------------------------------------------

const MIN_K = 0.3;
const MAX_K = 3;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

function zoomAt(factor: number, px: number, py: number) {
  viewTouched = true;
  const k = clampK(view.k * factor);
  const f = k / view.k;
  view.x = px - (px - view.x) * f;
  view.y = py - (py - view.y) * f;
  view.k = k;
}

const zoomBy = (factor: number) => zoomAt(factor, size.w / 2, size.h / 2);

function fitView() {
  const ns = nodes.value;
  if (!ns.length) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of ns) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  }
  const pad = 60;
  const k = clampK(Math.min((size.w - pad * 2) / Math.max(maxX - minX, 1), (size.h - pad * 2) / Math.max(maxY - minY, 1), 1.4));
  view.k = k;
  view.x = size.w / 2 - ((minX + maxX) / 2) * k;
  view.y = size.h / 2 - ((minY + maxY) / 2) * k;
}

function centerOn(n: SimNode) {
  view.x = size.w / 2 - n.x * view.k;
  view.y = size.h / 2 - n.y * view.k;
}

function resetLayout() {
  positions.clear();
  fitted = false;
  viewTouched = false;
  rebuild();
}

// Plain wheel keeps scrolling the page; Ctrl/⌘ + wheel (and trackpad pinch, which sends ctrlKey) zooms.
const wheelHint = ref(false);
let hintTimer: ReturnType<typeof setTimeout> | undefined;
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) {
    wheelHint.value = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (wheelHint.value = false), 1200);
    return;
  }
  e.preventDefault();
  const p = local(e);
  zoomAt(Math.exp(-e.deltaY * 0.0025), p.x, p.y);
}

// --- Pointer: drag nodes, pan background, pinch zoom -----------------------------------------

let dragging: SimNode | null = null;
let moved = false;
let panStart: { x: number; y: number; vx: number; vy: number } | null = null;
const pointers = new Map<number, { x: number; y: number }>();
let pinchStart: { dist: number; k: number } | null = null;

function local(e: { clientX: number; clientY: number }) {
  const box = svg.value!.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}
const toWorld = (p: { x: number; y: number }) => ({ x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k });

function onNodeDown(n: SimNode, e: PointerEvent) {
  if (e.button !== 0) return;
  dragging = n;
  moved = false;
  svg.value!.setPointerCapture(e.pointerId);
}

function onBackgroundDown(e: PointerEvent) {
  pointers.set(e.pointerId, local(e));
  svg.value!.setPointerCapture(e.pointerId);
  moved = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
    panStart = null;
  } else {
    const p = local(e);
    panStart = { x: p.x, y: p.y, vx: view.x, vy: view.y };
  }
}

function onMove(e: PointerEvent) {
  const p = local(e);
  if (dragging) {
    if (!moved) sim?.alphaTarget(0.3).restart();
    moved = true;
    const w = toWorld(p);
    dragging.fx = w.x;
    dragging.fy = w.y;
    if (reducedMotion) {
      dragging.x = w.x;
      dragging.y = w.y;
      onTick();
    }
    return;
  }
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
  if (pinchStart && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const k = clampK(pinchStart.k * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.dist));
    zoomAt(k / view.k, (a.x + b.x) / 2, (a.y + b.y) / 2);
    moved = true;
  } else if (panStart) {
    if (Math.abs(p.x - panStart.x) + Math.abs(p.y - panStart.y) > 3) moved = true;
    if (moved) viewTouched = true;
    view.x = panStart.vx + p.x - panStart.x;
    view.y = panStart.vy + p.y - panStart.y;
  }
}

function onUp(e: PointerEvent) {
  if (dragging) {
    const n = dragging;
    dragging = null;
    sim?.alphaTarget(0);
    if (moved) positions.set(n.id, { x: n.x, y: n.y, pinned: true }); // dragged nodes stay put
    else select(n);
    return;
  }
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (panStart && !moved) select(null); // a click on empty space clears the selection
  panStart = null;
}

function unpin(n: SimNode) {
  n.fx = n.fy = null;
  positions.set(n.id, { x: n.x, y: n.y, pinned: false });
  sim?.alpha(0.3).restart();
}

// --- Keyboard --------------------------------------------------------------------------------

function onNodeKey(n: SimNode, e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    select(n);
  }
}

function onCanvasKey(e: KeyboardEvent) {
  const typing = (e.target as HTMLElement).tagName === "INPUT";
  if (typing && e.key !== "Escape") return;
  if (e.key === "Escape") {
    if (settingsOpen.value) settingsOpen.value = false;
    else select(null);
  } else if (e.key === "+" || e.key === "=") zoomBy(1.2);
  else if (e.key === "-") zoomBy(1 / 1.2);
  else if (e.key === "0") fitView();
}

const summary = computed(() => {
  const count = (k: string) => nodes.value.filter((n) => n.kind === k).length;
  return `Council graph: ${count("persona")} members, ${count("verdict")} verdicts${count("chairman") ? ", the chairman" : ""}. Tab through the nodes and press Enter to read one.`;
});

// Registered last: the immediate first build calls helpers (fitView, clampK, radiusOf…) defined above.
watch(() => [props.graph, settings.showEvidence], rebuild, { immediate: true });
</script>

<template>
  <div class="graph-view" :style="{ height: `${height}px` }" @keydown="onCanvasKey">
    <div ref="wrap" class="canvas">
      <svg
        ref="svg"
        :viewBox="`0 0 ${size.w} ${size.h}`"
        role="group"
        :aria-label="summary"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel="onWheel"
      >
        <defs>
          <marker id="gc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--graph-line)" />
          </marker>
          <marker id="gc-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        <rect class="hit-bg" :width="size.w" :height="size.h" @pointerdown="onBackgroundDown" />
        <g :transform="`translate(${view.x},${view.y}) scale(${view.k})`">
          <g class="links">
            <line
              v-for="(l, i) in links"
              :key="i"
              v-bind="linkGeometry(l)"
              :stroke="isFocusLink(l) ? 'var(--accent)' : 'var(--graph-line)'"
              :stroke-width="linkWidth(l)"
              :opacity="linkOpacity(l)"
              :marker-end="settings.arrows && directed(l) ? (isFocusLink(l) ? 'url(#gc-arrow-hl)' : 'url(#gc-arrow)') : undefined"
              vector-effect="non-scaling-stroke"
            >
              <title v-if="linkTitle(l)">{{ linkTitle(l) }}</title>
            </line>
          </g>
          <g
            v-for="n in nodes"
            :key="n.id"
            class="node"
            :class="{ selected: selectedId === n.id, hovered: hoverId === n.id }"
            :transform="`translate(${n.x},${n.y})`"
            :opacity="nodeOpacity(n)"
            tabindex="0"
            role="button"
            :aria-label="`${n.title ?? n.label}${n.score != null ? `, score ${n.score} out of 10` : ''}${n.recommendation ? `, ${n.recommendation}` : ''}`"
            :aria-pressed="selectedId === n.id"
            @pointerdown.stop="onNodeDown(n, $event)"
            @pointerenter="hoverId = n.id"
            @pointerleave="hoverId = null"
            @focus="hoverId = n.id"
            @blur="hoverId = null"
            @keydown="onNodeKey(n, $event)"
            @dblclick="unpin(n)"
          >
            <!-- Invisible hit area: at least 32px on screen however small the dot is drawn. -->
            <circle class="hit" :r="Math.max(radiusOf(n), 16 / view.k)" />
            <circle
              class="dot"
              :r="radiusOf(n)"
              :fill="hollow(n) ? 'var(--graph-bg)' : colorOf(n)"
              :stroke="failed(n) ? 'var(--danger)' : hollow(n) ? colorOf(n) : 'none'"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
            <circle
              v-if="running(n)"
              :r="radiusOf(n) + 3"
              fill="none"
              stroke="var(--muted)"
              stroke-dasharray="2 2"
              vector-effect="non-scaling-stroke"
            />
            <circle v-if="selectedId === n.id || hoverId === n.id" class="ring" :r="radiusOf(n) + 3" vector-effect="non-scaling-stroke" />
            <text v-if="n.recommendation && REC_GLYPH[n.recommendation]" class="glyph" :font-size="radiusOf(n) * 1.1" dy="0.36em" aria-hidden="true">
              {{ REC_GLYPH[n.recommendation] }}
            </text>
            <text class="label" :y="radiusOf(n) + 12 / view.k" :font-size="11 / view.k" :stroke-width="2.5 / view.k" :opacity="labelOpacity(n)" aria-hidden="true">
              {{ truncate(n.label) }}
            </text>
          </g>
        </g>
      </svg>

      <div v-if="preview" class="preview" :style="{ left: `${preview.left}px`, top: `${preview.top}px` }" role="tooltip">
        <strong>{{ preview.node.title ?? preview.node.label }}</strong>
        <span v-if="preview.node.score != null || preview.node.recommendation" class="preview-meta">
          <template v-if="preview.node.score != null">{{ preview.node.score }}/10</template>
          <template v-if="preview.node.recommendation"> · {{ preview.node.recommendation }}</template>
          <template v-if="preview.node.rank"> · rank {{ preview.node.rank }}</template>
        </span>
        <span v-if="failed(preview.node)" class="preview-meta error-text">Failed</span>
        <p v-if="preview.excerpt">{{ preview.excerpt }}</p>
      </div>

      <p class="wheel-hint" :class="{ show: wheelHint }" aria-hidden="true">Hold Ctrl (⌘ on Mac) and scroll to zoom</p>

      <ul v-if="legend.length" class="legend" aria-label="Legend">
        <li v-for="l in legend" :key="l.kind"><span class="swatch" :style="{ background: KIND_COLOR[l.kind] }" aria-hidden="true" />{{ l.label }}</li>
      </ul>
    </div>

    <div class="toolbar" role="toolbar" aria-label="Graph controls">
      <button type="button" class="icon-btn" aria-label="Zoom in" title="Zoom in (+)" @click="zoomBy(1.25)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
      </button>
      <button type="button" class="icon-btn" aria-label="Zoom out" title="Zoom out (−)" @click="zoomBy(1 / 1.25)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
      </button>
      <button type="button" class="icon-btn" aria-label="Fit to view" title="Fit to view (0)" @click="fitView">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
      </button>
      <button type="button" class="icon-btn" aria-label="Reset layout" title="Reset layout (unpins all nodes)" @click="resetLayout">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.5M3 2v3h3" /></svg>
      </button>
      <button
        type="button"
        class="icon-btn"
        :class="{ active: settingsOpen }"
        aria-label="Graph settings"
        title="Graph settings"
        :aria-expanded="settingsOpen"
        aria-controls="graph-settings"
        @click="settingsOpen = !settingsOpen"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h7M13 4h1M2 12h1M7 12h7" /><circle cx="11" cy="4" r="2" /><circle cx="5" cy="12" r="2" /></svg>
      </button>
    </div>

    <div v-show="settingsOpen" id="graph-settings" class="settings">
      <details open>
        <summary>Filters</summary>
        <label class="search">
          <span class="sr-only">Search nodes</span>
          <input v-model="settings.search" type="search" name="graph-search" autocomplete="off" spellcheck="false" placeholder="Search nodes…" @keydown.enter.prevent="selectFirstMatch" />
        </label>
        <label class="toggle"><span>Evidence &amp; sources</span><input v-model="settings.showEvidence" type="checkbox" role="switch" /></label>
        <label class="toggle">
          <span>Reviews as nodes</span>
          <input type="checkbox" role="switch" :checked="reviewNodes" @change="emit('update:reviewNodes', ($event.target as HTMLInputElement).checked)" />
        </label>
      </details>
      <details open>
        <summary>Display</summary>
        <label class="toggle"><span>Arrows</span><input v-model="settings.arrows" type="checkbox" role="switch" /></label>
        <label class="slider"><span>Node size</span><input v-model.number="settings.nodeSize" type="range" min="0.6" max="2" step="0.1" /></label>
      </details>
      <details>
        <summary>Forces</summary>
        <label class="slider"><span>Repel force</span><input v-model.number="settings.repel" type="range" min="60" max="600" step="10" /></label>
        <label class="slider"><span>Link distance</span><input v-model.number="settings.linkDistance" type="range" min="30" max="200" step="5" /></label>
      </details>
    </div>
  </div>
</template>

<style scoped>
.graph-view {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--graph-bg);
  overflow: hidden;
}
.canvas {
  position: absolute;
  inset: 0;
}
svg {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.hit-bg {
  fill: transparent;
  cursor: grab;
}
.hit-bg:active {
  cursor: grabbing;
}
.links line {
  transition: opacity 150ms ease;
  pointer-events: stroke;
}
.node {
  cursor: pointer;
  outline: none;
  transition: opacity 150ms ease;
}
.hit {
  fill: transparent;
}
.dot {
  transition: fill 150ms ease;
}
.ring {
  fill: none;
  stroke: var(--fg);
  stroke-width: 1.5;
}
.node:focus-visible .ring,
.node.selected .ring {
  stroke: var(--accent);
  stroke-width: 2;
}
.glyph {
  fill: var(--graph-bg);
  font-weight: 700;
  text-anchor: middle;
  pointer-events: none;
}
.label {
  fill: var(--fg-soft);
  text-anchor: middle;
  stroke: var(--graph-bg);
  stroke-linejoin: round;
  paint-order: stroke;
  pointer-events: none;
  transition: opacity 150ms ease;
}
.node.hovered .label,
.node.selected .label {
  fill: var(--fg);
}

.preview {
  position: absolute;
  transform: translateX(-50%);
  width: min(300px, 80%);
  padding: 0.6rem 0.75rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 0.8rem;
  line-height: 1.45;
  pointer-events: none;
  z-index: 2;
}
.preview strong {
  display: block;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.preview-meta {
  display: block;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.preview p {
  margin: 0.35rem 0 0;
  color: var(--fg-soft);
  overflow-wrap: anywhere;
}

.wheel-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  margin: 0;
  padding: 0.4rem 0.75rem;
  transform: translate(-50%, -50%);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.8rem;
  color: var(--fg-soft);
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}
.wheel-hint.show {
  opacity: 1;
}

.legend {
  position: absolute;
  left: 0.75rem;
  bottom: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.72rem;
  color: var(--muted);
  pointer-events: none;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.toolbar {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 3;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: calc(var(--radius) - 2px);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.icon-btn:hover,
.icon-btn.active {
  background: var(--hover);
  color: var(--fg);
}
.icon-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.settings {
  position: absolute;
  top: 3.1rem;
  right: 0.6rem;
  width: 230px;
  max-height: calc(100% - 3.7rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem 0.75rem 0.5rem;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 0.8rem;
  z-index: 3;
}
.settings details {
  border-bottom: 1px solid var(--border);
  padding: 0.35rem 0;
}
.settings details:last-child {
  border-bottom: none;
}
.settings summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--fg);
  padding: 0.25rem 0;
}
.settings summary:hover {
  color: var(--accent);
}
.settings .search {
  display: block;
  margin: 0.35rem 0;
}
.settings input[type="search"] {
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}
.toggle,
.slider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.3rem 0;
  color: var(--fg-soft);
  cursor: pointer;
}
.slider input {
  width: 96px;
  accent-color: var(--accent);
}
.toggle input {
  accent-color: var(--accent);
}

@media (max-width: 480px) {
  .legend {
    display: none;
  }
  .settings {
    left: 0.6rem;
    width: auto;
  }
}
</style>
