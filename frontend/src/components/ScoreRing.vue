<script setup lang="ts">
// A score out of 10 drawn as a ring gauge, with the number always printed inside so colour isn't the only cue.
import { computed } from "vue";

const props = withDefaults(defineProps<{ score: number | null; size?: number; color?: string; label?: string }>(), {
  size: 44,
  color: "var(--accent)",
  label: "Score",
});

const R = 16;
const C = 2 * Math.PI * R;
const dash = computed(() => (props.score == null ? 0 : (Math.max(0, Math.min(10, props.score)) / 10) * C));
const text = computed(() => (props.score == null ? "–" : Number.isInteger(props.score) ? String(props.score) : props.score.toFixed(1)));
</script>

<template>
  <span class="ring" :style="{ width: `${size}px`, height: `${size}px` }" role="img" :aria-label="score == null ? `${label}: not scored yet` : `${label}: ${text} out of 10`">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" :r="R" class="track" />
      <circle cx="20" cy="20" :r="R" class="value" :stroke="color" :stroke-dasharray="`${dash} ${C}`" />
    </svg>
    <span class="num" :style="{ fontSize: `${size * (text.length > 2 ? 0.26 : 0.32)}px` }">{{ text }}</span>
  </span>
</template>

<style scoped>
.ring {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}
svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
circle {
  fill: none;
  stroke-width: 3.5;
}
.track {
  stroke: var(--hover);
}
.value {
  stroke-linecap: round;
  transition: stroke-dasharray 400ms ease;
}
.num {
  position: relative;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
