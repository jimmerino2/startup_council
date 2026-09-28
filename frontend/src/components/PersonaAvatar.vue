<script setup lang="ts">
import { computed } from "vue";
import { personaMeta } from "../lib/personas";

const props = withDefaults(defineProps<{ personaKey: string; size?: number }>(), { size: 32 });
const meta = computed(() => personaMeta(props.personaKey));
const initials = computed(() =>
  props.personaKey === "chairman"
    ? "CH"
    : meta.value.label
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase(),
);
const hue = computed(() => (props.personaKey === "chairman" ? 45 : meta.value.hue));
</script>

<template>
  <span class="avatar" :style="{ '--hue': hue, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.36}px` }" aria-hidden="true">
    {{ initials }}
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: hsl(var(--hue) 70% 78%);
  background: hsl(var(--hue) 45% 30% / 0.55);
  box-shadow: inset 0 0 0 1px hsl(var(--hue) 50% 60% / 0.35);
}
@media (prefers-color-scheme: light) {
  .avatar {
    color: hsl(var(--hue) 55% 32%);
    background: hsl(var(--hue) 70% 92%);
    box-shadow: inset 0 0 0 1px hsl(var(--hue) 50% 45% / 0.25);
  }
}
</style>
