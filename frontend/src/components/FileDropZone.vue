<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  /** Accessible name for the file picker, e.g. "Pitch / submission". */
  label: string;
  accept: string;
  busy?: boolean;
}>();

const emit = defineEmits<{ files: [files: File[]] }>();

const input = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
// dragenter/dragleave also fire for child elements, so count them to avoid flicker.
let depth = 0;

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

function onEnter(e: DragEvent) {
  if (!hasFiles(e)) return;
  depth++;
  dragging.value = true;
}

function onLeave() {
  depth = Math.max(0, depth - 1);
  if (depth === 0) dragging.value = false;
}

function onDrop(e: DragEvent) {
  depth = 0;
  dragging.value = false;
  if (props.busy) return;
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (files.length) emit("files", files);
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement;
  const files = Array.from(el.files ?? []);
  el.value = "";
  if (files.length) emit("files", files);
}
</script>

<template>
  <div class="dropzone">
    <div
      class="drop-target"
      :class="{ dragging }"
      @dragenter.prevent="onEnter"
      @dragover.prevent
      @dragleave="onLeave"
      @drop.prevent="onDrop"
    >
      <slot />
      <div v-if="dragging" class="drop-overlay" aria-hidden="true">Drop to add the file's text</div>
    </div>
    <div class="drop-row">
      <input ref="input" type="file" multiple hidden :accept="accept" :aria-label="`Upload file for ${label}`" @change="onPick" />
      <button type="button" class="pick" :disabled="busy" @click="input?.click()">
        {{ busy ? "Extracting…" : "Upload file" }}
      </button>
      <span class="muted hint">or drop a PDF, DOCX, MD or TXT onto the box</span>
      <span class="aside"><slot name="aside" /></span>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.drop-target {
  position: relative;
  display: flex;
  flex-direction: column;
}
.drop-target :slotted(textarea) {
  flex: 1;
}
.drop-target.dragging :slotted(textarea) {
  border-color: var(--accent);
  border-style: dashed;
}
.drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  font-weight: 600;
  pointer-events: none;
}
.drop-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.pick {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 0.3rem 0.7rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.pick:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.hint {
  font-size: 0.8rem;
}
.aside {
  margin-left: auto;
}
</style>
