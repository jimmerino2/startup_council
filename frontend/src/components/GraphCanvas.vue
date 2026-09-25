<script setup lang="ts">
// Minimal force-directed graph: enough to see structure, not styled for show. See DESIGN.md
// for the intended final look.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation } from "d3-force";
import type { GraphData, GraphEdge, GraphNode } from "../lib/api";

const props = withDefaults(defineProps<{ graph: GraphData; height?: number }>(), { height: 420 });
const emit = defineEmits<{ select: [node: GraphNode | null] }>();

const WIDTH = 800;

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

const nodes = ref<SimNode[]>([]);
const links = ref<SimLink[]>([]);
const selectedId = ref<string | null>(null);
let sim: Simulation<SimNode, SimLink> | null = null;

const COLORS: Record<string, string> = {
  persona: "#2563eb",
  chairman: "#7c3aed",
  source: "#0d9488",
  evidence: "#6b7280",
  review: "#ca8a04",
  verdict: "#38bdf8",
  final_verdict: "#7c3aed",
};

const RECOMMENDATION_COLORS: Record<string, string> = { fund: "#16a34a", iterate: "#d97706", pass: "#dc2626" };

function colorOf(n: SimNode) {
  if (n.recommendation && RECOMMENDATION_COLORS[n.recommendation]) return RECOMMENDATION_COLORS[n.recommendation];
  return COLORS[n.kind] ?? "#6b7280";
}

function radiusOf(n: SimNode) {
  if (n.kind === "chairman") return 18;
  if (n.kind === "review") return 6;
  if (n.kind === "verdict") return 9;
  if (n.kind === "final_verdict") return 14;
  if (n.score !== undefined && n.score !== null) return 8 + n.score * 1.4; // 0-10 score -> 8-22px
  if (n.kind === "persona") return 10;
  return 6;
}

function rebuild() {
  sim?.stop();
  // Copy: d3 mutates nodes and links.
  const ns: SimNode[] = props.graph.nodes.map((n, i) => ({ ...n, x: WIDTH / 2 + Math.cos(i) * 80, y: props.height / 2 + Math.sin(i) * 80 }));
  const byId = new Map(ns.map((n) => [n.id, n]));
  const ls: SimLink[] = props.graph.edges
    .filter((e) => byId.has(e.source) && byId.has(e.target))
    .map((e) => ({ ...e, source: byId.get(e.source)!, target: byId.get(e.target)! }));

  nodes.value = ns;
  links.value = ls;
  sim = forceSimulation<SimNode, SimLink>(ns)
    .force("link", forceLink<SimNode, SimLink>(ls).distance(90).strength(0.5))
    .force("charge", forceManyBody().strength(-260))
    .force("center", forceCenter(WIDTH / 2, props.height / 2))
    .force("collide", forceCollide<SimNode>().radius((n) => radiusOf(n) + 6))
    .on("tick", () => {
      nodes.value = [...ns]; // new array so the template re-renders each tick
    });
}

watch(() => props.graph, rebuild, { immediate: true });
onBeforeUnmount(() => sim?.stop());

// Ids next to the selected node; everything else dims.
const neighbours = computed(() => {
  if (!selectedId.value) return null;
  const set = new Set([selectedId.value]);
  for (const l of links.value) {
    if (l.source.id === selectedId.value) set.add(l.target.id);
    if (l.target.id === selectedId.value) set.add(l.source.id);
  }
  return set;
});

const dim = (id: string) => (neighbours.value && !neighbours.value.has(id) ? 0.15 : 1);
const linkDim = (l: SimLink) =>
  neighbours.value && !(neighbours.value.has(l.source.id) && neighbours.value.has(l.target.id) && (l.source.id === selectedId.value || l.target.id === selectedId.value)) ? 0.08 : 0.6;

function nodeTitle(n: SimNode) {
  const bits = [n.title ?? n.label];
  if (n.score !== undefined && n.score !== null) bits.push(`score ${n.score}/10`);
  if (n.recommendation) bits.push(n.recommendation);
  if (n.subtitle) bits.push(n.subtitle);
  if (n.text) bits.push(n.text.length > 220 ? `${n.text.slice(0, 217)}…` : n.text);
  else if (n.kind === "review") bits.push("no critique recorded");
  return bits.join(" · ");
}

const isReviewLink = (l: SimLink) => l.kind === "reviewed" || l.kind === "wrote" || l.kind === "about";

function linkWidth(l: SimLink) {
  return isReviewLink(l) ? Math.max(0.8, 3.2 - l.weight * 0.5) : 1.2; // better rank = thicker
}

function linkTitle(l: SimLink) {
  if (l.kind !== "reviewed") return "";
  return `${l.source.label} ranked ${l.target.label} #${l.weight}${l.critique ? `: ${l.critique}` : ""}`;
}

function clearSelection() {
  selectedId.value = null;
  emit("select", null);
}

// --- Dragging ---------------------------------------------------------------------------------

const svg = ref<SVGSVGElement | null>(null);
let dragging: SimNode | null = null;
let moved = false;

function toSvg(e: PointerEvent) {
  const box = svg.value!.getBoundingClientRect();
  return { x: ((e.clientX - box.left) / box.width) * WIDTH, y: ((e.clientY - box.top) / box.height) * props.height };
}

function onDown(n: SimNode, e: PointerEvent) {
  dragging = n;
  moved = false;
  (e.target as Element).setPointerCapture(e.pointerId);
  sim?.alphaTarget(0.3).restart();
}

function onMove(e: PointerEvent) {
  if (!dragging) return;
  moved = true;
  const p = toSvg(e);
  dragging.fx = p.x;
  dragging.fy = p.y;
}

function onUp() {
  if (!dragging) return;
  const n = dragging;
  n.fx = n.fy = null;
  dragging = null;
  sim?.alphaTarget(0);
  if (!moved) {
    selectedId.value = selectedId.value === n.id ? null : n.id;
    emit("select", selectedId.value ? n : null);
  }
}
</script>

<template>
  <svg ref="svg" class="graph" :viewBox="`0 0 ${WIDTH} ${height}`" role="img" aria-label="Relationship graph" @pointermove="onMove" @pointerup="onUp" @click.self="clearSelection">
    <line
      v-for="(l, i) in links"
      :key="i"
      :x1="l.source.x"
      :y1="l.source.y"
      :x2="l.target.x"
      :y2="l.target.y"
      stroke="currentColor"
      :stroke-width="linkWidth(l)"
      :stroke-dasharray="isReviewLink(l) ? '4 3' : undefined"
      :opacity="linkDim(l)"
    >
      <title v-if="linkTitle(l)">{{ linkTitle(l) }}</title>
    </line>
    <g v-for="n in nodes" :key="n.id" :transform="`translate(${n.x},${n.y})`" :opacity="dim(n.id)" class="node" @pointerdown.stop="onDown(n, $event)">
      <title>{{ nodeTitle(n) }}</title>
      <!-- Verdicts are squares so they read as text, not as people. -->
      <rect
        v-if="n.kind === 'verdict' || n.kind === 'final_verdict'"
        :x="-radiusOf(n)"
        :y="-radiusOf(n)"
        :width="radiusOf(n) * 2"
        :height="radiusOf(n) * 2"
        rx="3"
        :fill="colorOf(n)"
        :stroke="selectedId === n.id ? 'currentColor' : 'none'"
        stroke-width="2"
      />
      <circle v-else :r="radiusOf(n)" :fill="colorOf(n)" :stroke="selectedId === n.id ? 'currentColor' : 'none'" stroke-width="2" />
      <text :y="radiusOf(n) + 12" text-anchor="middle" class="label">{{ n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label }}</text>
    </g>
  </svg>
</template>

<style scoped>
.graph {
  width: 100%;
  height: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  touch-action: none;
}
.node {
  cursor: grab;
}
.label {
  font-size: 11px;
  fill: var(--fg);
  pointer-events: none;
}
</style>
