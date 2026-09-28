<script setup lang="ts">
// Decorative, static council graph in the Obsidian style for the landing and sign-in pages.
// Six members on a ring, their verdicts outside, peer-review links between them, the chairman in the middle.
const R = 110;
const members = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * R, y: Math.sin(a) * R, vx: Math.cos(a) * (R + 58), vy: Math.sin(a) * (R + 58), r: 6 + ((i * 7) % 5), i };
});
const reviews = members.flatMap((m, i) => [members[(i + 1) % 6], members[(i + 2) % 6]].map((t) => ({ a: m, b: t })));
</script>

<template>
  <svg class="hero-graph" viewBox="-200 -200 400 400" aria-hidden="true" focusable="false">
    <g class="drift">
      <line v-for="(l, i) in reviews" :key="`r${i}`" :x1="l.a.x" :y1="l.a.y" :x2="l.b.x" :y2="l.b.y" class="link review" />
      <line v-for="m in members" :key="`c${m.i}`" x1="0" y1="0" :x2="m.x" :y2="m.y" class="link" />
      <line v-for="m in members" :key="`v${m.i}`" :x1="m.x" :y1="m.y" :x2="m.vx" :y2="m.vy" class="link" />
      <circle v-for="m in members" :key="`vn${m.i}`" :cx="m.vx" :cy="m.vy" r="4" class="note" />
      <circle v-for="m in members" :key="`m${m.i}`" :cx="m.x" :cy="m.y" :r="m.r" class="member" :style="{ animationDelay: `${m.i * 0.4}s` }" />
      <circle r="14" class="chair" />
      <circle r="22" class="halo" />
    </g>
  </svg>
</template>

<style scoped>
.hero-graph {
  width: 100%;
  height: auto;
  overflow: visible;
}
.link {
  stroke: var(--graph-line);
  stroke-width: 1;
  opacity: 0.55;
}
.link.review {
  stroke: var(--accent);
  opacity: 0.3;
}
.note {
  fill: var(--graph-note);
}
.member {
  fill: var(--graph-persona);
  animation: breathe 4s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
.chair {
  fill: var(--success);
}
.halo {
  fill: none;
  stroke: var(--success);
  opacity: 0.35;
}
.drift {
  animation: drift 40s linear infinite;
  transform-box: fill-box; /* the drawing is symmetric around the chairman, so this spins it in place */
  transform-origin: center;
}
@keyframes breathe {
  50% {
    transform: scale(1.18);
  }
}
@keyframes drift {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .member,
  .drift {
    animation: none;
  }
}
</style>
