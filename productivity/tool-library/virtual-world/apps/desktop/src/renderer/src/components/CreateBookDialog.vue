<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import {
  LONG_BOOK_GENRES,
  SCRIPT_BOOK_GENRES,
  SHORT_BOOK_GENRES,
  LongBookGenreSchema,
  ScriptBookGenreSchema,
  ShortBookGenreSchema
} from "@deepwrite/contracts";
import type {
  CreateLongBookInput,
  CreateScriptBookInput,
  CreateShortBookInput,
  LinkedMaterialIdsByKind,
  LinkedSkillIdsByKind,
  MaterialLibrary,
  MaterialLibraryGroup,
  SkillLibrary,
  SkillLibraryGroup
} from "@deepwrite/contracts";
import { uiMessage } from "../ui-feedback";
import BookLibraryBindings from "./BookLibraryBindings.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    materials?: readonly MaterialLibrary[];
    materialGroups?: readonly MaterialLibraryGroup[];
    skills?: readonly SkillLibrary[];
    skillGroups?: readonly SkillLibraryGroup[];
    loading?: boolean;
    submitting?: boolean;
  }>(),
  {
    materials: () => [],
    materialGroups: () => [],
    skills: () => [],
    skillGroups: () => [],
    loading: false,
    submitting: false
  }
);

type CreateCreativeBookPayload =
  | ({ workspaceType: "short" } & CreateShortBookInput)
  | ({ workspaceType: "script" } & CreateScriptBookInput)
  | ({ workspaceType: "long" } & CreateLongBookInput);

const emit = defineEmits<{
  close: [];
  submit: [payload: CreateCreativeBookPayload];
}>();

const title = ref("");
const workspaceType = ref<"short" | "script" | "long">("short");
const genre = ref<string>("世情");
const workspaceTypeOptions = [
  {
    value: "short",
    label: "短篇",
    description: "人物、剧情、导语、大纲与正文"
  },
  { value: "script", label: "剧本", description: "人物、剧情、大纲与分集正文" },
  {
    value: "long",
    label: "长篇",
    description: "世界观、人物、情节、正文与连续性"
  }
] as const;
const genreOptions = computed<readonly string[]>(() =>
  workspaceType.value === "long"
    ? LONG_BOOK_GENRES
    : workspaceType.value === "script"
      ? SCRIPT_BOOK_GENRES
      : SHORT_BOOK_GENRES
);
const titleInput = ref<HTMLInputElement | null>(null);
const bindings = ref<{
  linkedMaterialIdsByKind: LinkedMaterialIdsByKind;
  linkedSkillIdsByKind: LinkedSkillIdsByKind;
}>();
function workspaceTypeLabel(): string {
  return (
    workspaceTypeOptions.find((option) => option.value === workspaceType.value)
      ?.label ?? "短篇"
  );
}

function resetDraft(): void {
  title.value = "";
  workspaceType.value = "short";
  genre.value = "世情";
  bindings.value = undefined;
}

function requestClose(): void {
  if (!props.submitting) emit("close");
}

function submit(): void {
  const normalizedTitle = title.value.trim();
  if (!normalizedTitle) {
    uiMessage.warning("请输入书名");
    titleInput.value?.focus();
    return;
  }
  const linkedMaterialIdsByKind = bindings.value?.linkedMaterialIdsByKind;
  const linkedSkillIdsByKind = bindings.value?.linkedSkillIdsByKind;
  if (workspaceType.value === "long") {
    if (Array.from(normalizedTitle).length > 256) {
      uiMessage.warning("长篇书名不能超过 256 个字符");
      titleInput.value?.focus();
      return;
    }
    emit("submit", {
      workspaceType: "long",
      title: normalizedTitle,
      genre: LongBookGenreSchema.parse(genre.value),
      linkedMaterialIdsByKind,
      linkedSkillIdsByKind
    });
    return;
  }
  if (workspaceType.value === "script") {
    emit("submit", {
      workspaceType: "script",
      title: normalizedTitle,
      genre: ScriptBookGenreSchema.parse(genre.value),
      linkedMaterialIdsByKind,
      linkedSkillIdsByKind
    });
    return;
  }
  emit("submit", {
    workspaceType: "short",
    title: normalizedTitle,
    genre: ShortBookGenreSchema.parse(genre.value),
    linkedMaterialIdsByKind,
    linkedSkillIdsByKind
  });
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === "Escape") requestClose();
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    resetDraft();
    void nextTick(() => titleInput.value?.focus());
  },
  { immediate: true }
);

watch(workspaceType, () => {
  genre.value = genreOptions.value[0] ?? "世情";
  bindings.value = undefined;
});

onMounted(() => document.addEventListener("keydown", handleKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @mousedown.self="requestClose">
      <section
        class="workspace-dialog create-short-book-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-book-title"
      >
        <header>
          <div>
            <span class="dialog-eyebrow"
              >创作空间 · {{ workspaceTypeLabel() }}</span
            >
            <h2 id="create-book-title">
              新建{{
                workspaceType === "long"
                  ? "长篇作品"
                  : workspaceType === "script"
                    ? "剧本"
                    : "短篇书籍"
              }}
            </h2>
          </div>
          <button
            class="dialog-close"
            type="button"
            aria-label="关闭"
            :disabled="submitting"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <form
          class="dialog-content create-short-book-form"
          @submit.prevent="submit"
        >
          <section
            class="create-short-book-basics"
            aria-labelledby="create-workspace-type-heading"
          >
            <h3 id="create-workspace-type-heading">创作类型</h3>
            <div
              class="create-short-binding-modes create-workspace-type-options"
              role="tablist"
              aria-label="创作类型"
            >
              <button
                v-for="option in workspaceTypeOptions"
                :key="option.value"
                class="create-workspace-type-tab"
                :class="{ 'is-selected': workspaceType === option.value }"
                type="button"
                role="tab"
                :aria-selected="workspaceType === option.value"
                :tabindex="workspaceType === option.value ? 0 : -1"
                :disabled="submitting"
                @click="workspaceType = option.value"
              >
                <span
                  ><strong>{{ option.label }}</strong
                  ><small>{{ option.description }}</small></span
                >
              </button>
            </div>
          </section>

          <section
            class="create-short-book-basics"
            aria-labelledby="create-short-basics-heading"
          >
            <h3 id="create-short-basics-heading">书籍信息</h3>
            <label class="create-short-book-field">
              <span>书名</span>
              <input
                ref="titleInput"
                v-model="title"
                type="text"
                :maxlength="workspaceType === 'long' ? 256 : 80"
                autocomplete="off"
                :placeholder="
                  workspaceType === 'long' ? '请输入长篇书名' : '请输入书名'
                "
                :disabled="submitting"
              />
            </label>

            <fieldset class="create-short-genre-field">
              <legend>
                {{
                  workspaceType === "long"
                    ? "长篇题材"
                    : `${workspaceType === "script" ? "剧本" : "短篇"}分类`
                }}
              </legend>
              <div class="create-short-genre-options">
                <label
                  v-for="option in genreOptions"
                  :key="option"
                  class="create-short-genre-option"
                  :class="{ 'is-selected': genre === option }"
                >
                  <input
                    v-model="genre"
                    type="radio"
                    name="shortBookGenre"
                    :value="option"
                    :disabled="submitting"
                  />
                  <span>{{ option }}</span>
                </label>
              </div>
            </fieldset>
          </section>

          <BookLibraryBindings
            :key="`${open}-${workspaceType}`"
            :materials="materials"
            :skills="skills"
            :material-groups="materialGroups"
            :skill-groups="skillGroups"
            :workspace-type="workspaceType"
            :loading="loading"
            :submitting="submitting"
            @change="bindings = $event"
          />

          <div class="dialog-actions create-short-book-actions">
            <span
              v-if="loading"
              class="dialog-action-status"
              aria-live="polite"
            >
              正在加载素材库和技能库目录…
            </span>
            <button
              class="dialog-secondary-button"
              type="button"
              :disabled="submitting"
              @click="requestClose"
            >
              取消
            </button>
            <button
              class="dialog-primary-button"
              type="submit"
              :disabled="loading || submitting"
            >
              {{
                submitting
                  ? "创建中…"
                  : workspaceType === "long"
                    ? "创建长篇"
                    : workspaceType === "script"
                      ? "创建剧本"
                      : "创建书籍"
              }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>
