import { characterApi } from "./character-api";
import { computed, ref, watch, type Ref } from "vue";
import type {
  LongCharacterProfileSnapshot,
  LongCharacterProfile
} from "@deepwrite/contracts";
import { uiMessage } from "../../ui-feedback";
import {
  cloneProfile,
  mergeProfileField,
  rebaseProfileDraft,
  type ProfileField
} from "./profile-draft";

export function useCharacterProfile(
  props: {
    bookId: string;
    characterId: string;
    updatedAt?: string | undefined;
  },
  onSaved: () => void
) {
  const snapshot = ref<LongCharacterProfileSnapshot | null>(null);
  const draft: Ref<LongCharacterProfile | null> = ref(null);
  const loading = ref(false);
  const saving = ref(false);
  const selectedAppearance = ref("");
  const error = ref("");
  const dirty = computed(() =>
    Boolean(
      snapshot.value &&
      draft.value &&
      JSON.stringify(snapshot.value.profile) !== JSON.stringify(draft.value)
    )
  );
  const activeAppearance = computed(() =>
    draft.value?.appearances.find(
      (item) => item.id === selectedAppearance.value
    )
  );
  let request = 0;
  async function load() {
    const version = ++request;
    loading.value = true;
    error.value = "";
    try {
      const next = await characterApi().readCharacterProfile({
        bookId: props.bookId,
        characterId: props.characterId
      });
      if (version !== request) return;
      if (dirty.value) {
        if (snapshot.value?.revision !== next.revision)
          uiMessage.warning(
            "角色档案已更新，请保存前核对最新内容。当前输入仍保留。"
          );
        snapshot.value!.assets = next.assets;
      } else {
        snapshot.value = next;
        draft.value = cloneProfile(next.profile);
        if (
          !next.profile.appearances.some(
            (item) => item.id === selectedAppearance.value
          )
        )
          selectedAppearance.value = next.profile.appearances[0]?.id ?? "";
      }
    } catch (e) {
      if (version === request) {
        error.value = e instanceof Error ? e.message : "读取角色档案失败";
        uiMessage.error(error.value);
      }
    } finally {
      if (version === request) loading.value = false;
    }
  }
  async function save(
    field: ProfileField,
    appearanceId?: string
  ): Promise<boolean> {
    if (saving.value || !draft.value || !snapshot.value) return false;
    const version = request;
    const before = cloneProfile(snapshot.value.profile);
    let submitted: LongCharacterProfile;
    try {
      submitted = mergeProfileField(before, draft.value, field, appearanceId);
    } catch (e) {
      uiMessage.warning(e instanceof Error ? e.message : "请先选择形象");
      return false;
    }
    saving.value = true;
    try {
      const next = await characterApi().saveCharacterProfile({
        bookId: props.bookId,
        characterId: props.characterId,
        profile: submitted,
        expectedRevision: snapshot.value.revision
      });
      if (version !== request || !draft.value) return false;
      draft.value = rebaseProfileDraft(
        before,
        draft.value,
        submitted,
        next.profile
      );
      snapshot.value = next;
      onSaved();
      uiMessage.success("已保存");
      return true;
    } catch (e) {
      uiMessage.error(e instanceof Error ? e.message : "保存失败，输入仍保留");
      return false;
    } finally {
      saving.value = false;
    }
  }
  function discard() {
    if (snapshot.value) draft.value = cloneProfile(snapshot.value.profile);
  }
  function updateAssets(next: LongCharacterProfileSnapshot) {
    if (
      next.bookId === props.bookId &&
      next.characterId === props.characterId &&
      snapshot.value
    )
      snapshot.value.assets = next.assets;
  }
  function addAppearance() {
    if (!draft.value) return;
    const id = "appearance_" + crypto.randomUUID().replaceAll("-", "");
    draft.value.appearances.push({ id, name: "新形象", description: "" });
    selectedAppearance.value = id;
  }
  watch(
    () => [props.bookId, props.characterId],
    () => {
      snapshot.value = null;
      draft.value = null;
      selectedAppearance.value = "";
      void load();
    },
    { immediate: true }
  );
  watch(
    () => props.updatedAt,
    () => {
      if (!saving.value) void load();
    }
  );
  return {
    snapshot,
    draft,
    loading,
    saving,
    error,
    dirty,
    selectedAppearance,
    activeAppearance,
    save,
    load,
    discard,
    updateAssets,
    addAppearance
  };
}
