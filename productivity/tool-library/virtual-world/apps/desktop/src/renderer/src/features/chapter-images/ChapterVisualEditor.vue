<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  replaceChapterVisualText,
  splitChapterVisualSegments,
  type ChapterVisualInput,
  type ChapterVisualSelection,
  type ChapterVisualSegment
} from "./chapterVisualSegments";

const props = defineProps<{
  content: string;
  disabled: boolean;
  resolveImageUrl: (source: string) => string | undefined;
  displayImageUrl: (source: string) => string | undefined;
}>();
const emit = defineEmits<{
  input: [change: ChapterVisualInput];
  selection: [selection: ChapterVisualSelection];
  beforeinput: [event: InputEvent];
  keydown: [event: KeyboardEvent];
  textContextmenu: [event: MouseEvent, offset: number];
}>();

const root = ref<HTMLElement | null>(null);
const segments = computed(() =>
  splitChapterVisualSegments(props.content, props.resolveImageUrl)
);
let selectionBefore: ChapterVisualSelection | undefined;
let inputType = "";
let inputTimestamp = 0;
let lastSelection: ChapterVisualSelection = { start: 0, end: 0 };
let localContent: string | undefined;

function textareaFor(index: number): HTMLTextAreaElement | null {
  return (
    root.value?.querySelector<HTMLTextAreaElement>(
      `textarea[data-segment-index="${index}"]`
    ) ?? null
  );
}

function resize(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.max(input.scrollHeight, 38)}px`;
}

function resizeAll(): void {
  root.value
    ?.querySelectorAll("textarea")
    .forEach((element) => resize(element));
}

function sourceSelection(
  segment: ChapterVisualSegment,
  input: HTMLTextAreaElement
): ChapterVisualSelection {
  return {
    start: segment.start + input.selectionStart,
    end: segment.start + input.selectionEnd
  };
}

function rememberSelection(segment: ChapterVisualSegment, event: Event): void {
  const input = event.currentTarget;
  if (!(input instanceof HTMLTextAreaElement)) return;
  lastSelection = sourceSelection(segment, input);
  emit("selection", lastSelection);
}

function beforeInput(segment: ChapterVisualSegment, event: InputEvent): void {
  if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
    emit("beforeinput", event);
    return;
  }
  const input = event.currentTarget;
  if (!(input instanceof HTMLTextAreaElement)) return;
  selectionBefore = sourceSelection(segment, input);
  inputType = event.inputType;
  inputTimestamp = event.timeStamp;
}

function onInput(segment: ChapterVisualSegment, event: Event): void {
  const input = event.currentTarget;
  if (!(input instanceof HTMLTextAreaElement)) return;
  const content = replaceChapterVisualText(props.content, segment, input.value);
  const after = sourceSelection(segment, input);
  const before = selectionBefore ?? lastSelection;
  selectionBefore = undefined;
  lastSelection = after;
  resize(input);
  if (content === props.content) return;
  localContent = content;
  emit("input", {
    content,
    selectionBefore: before,
    selectionAfter: after,
    inputType,
    timestamp: inputTimestamp || event.timeStamp
  });
  emit("selection", after);
}

function focusRange(start: number, end = start): void {
  const index = segments.value.findIndex(
    (segment) =>
      segment.kind === "text" && segment.start <= start && start <= segment.end
  );
  const targetIndex =
    index >= 0
      ? index
      : segments.value.findIndex(
          (segment) => segment.kind === "text" && segment.start >= start
        );
  const resolvedIndex =
    targetIndex >= 0 ? targetIndex : segments.value.length - 1;
  const part = segments.value[resolvedIndex];
  const input = textareaFor(resolvedIndex);
  if (!part || !input) return;
  input.focus({ preventScroll: true });
  input.setSelectionRange(
    Math.max(0, Math.min(start - part.start, part.source.length)),
    Math.max(0, Math.min(end - part.start, part.source.length))
  );
  input.scrollIntoView({ block: "nearest" });
  lastSelection = sourceSelection(part, input);
  emit("selection", lastSelection);
}

function getSelection(): ChapterVisualSelection {
  return { ...lastSelection };
}

watch(
  () => props.content,
  async (content) => {
    if (content === localContent) {
      localContent = undefined;
      return;
    }
    lastSelection = { start: 0, end: 0 };
    await nextTick();
    resizeAll();
  }
);
onMounted(resizeAll);
defineExpose({ focusRange, getSelection });
</script>

<template>
  <div ref="root" class="chapter-visual-editor">
    <template
      v-for="(segment, index) in segments"
      :key="`${segment.kind}-${index}`"
    >
      <textarea
        v-if="segment.kind === 'text'"
        class="chapter-visual-text"
        :data-segment-index="index"
        :value="segment.source"
        :readonly="disabled"
        rows="1"
        spellcheck="false"
        aria-label="章节正文"
        @beforeinput="beforeInput(segment, $event)"
        @input="onInput(segment, $event)"
        @select="rememberSelection(segment, $event)"
        @keyup="rememberSelection(segment, $event)"
        @mouseup="rememberSelection(segment, $event)"
        @keydown="emit('keydown', $event)"
        @contextmenu="emit('textContextmenu', $event, segment.start)"
      />
      <img
        v-else
        class="chapter-visual-image"
        :src="displayImageUrl(segment.imageSource ?? '')"
        :alt="segment.alt ?? ''"
        loading="lazy"
        draggable="false"
      />
    </template>
  </div>
</template>

<style scoped src="./chapter-visual-editor.css" />
