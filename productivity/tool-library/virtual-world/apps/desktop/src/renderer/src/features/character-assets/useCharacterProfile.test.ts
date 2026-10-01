import { effectScope, nextTick, reactive } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import type { LongCharacterProfileSnapshot } from "@deepwrite/contracts";
import { useCharacterProfile } from "./useCharacterProfile";
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
});
function snapshot(name = "林岚"): LongCharacterProfileSnapshot {
  return {
    bookId: "longbook_example",
    characterId: "character_example",
    revision: "a".repeat(64),
    assets: [],
    profile: {
      name,
      keywords: "",
      faceDescription: "外貌",
      settingDescription: "设定",
      appearances: []
    }
  };
}
async function settle() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
}
function setup(api: object) {
  vi.stubGlobal("window", { deepwrite: { long: api } });
  const props = reactive({
    bookId: "longbook_example",
    characterId: "character_example",
    updatedAt: "1"
  });
  const scope = effectScope();
  scopes.push(scope);
  const session = scope.run(() => useCharacterProfile(props, vi.fn()))!;
  return { session, props };
}
it("keeps an edit after saving fails", async () => {
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile: async () => {
      throw new Error("版本已变更");
    }
  });
  await settle();
  session.draft.value!.name = "未保存";
  expect(await session.save("name")).toBe(false);
  expect(session.draft.value!.name).toBe("未保存");
  expect(session.dirty.value).toBe(true);
});
it("ignores a stale read that returns after switching characters", async () => {
  let finish!: (value: LongCharacterProfileSnapshot) => void;
  const readCharacterProfile = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({
      ...snapshot("新人物"),
      characterId: "character_other"
    });
  const { session, props } = setup({ readCharacterProfile });
  props.characterId = "character_other";
  await settle();
  finish(snapshot("旧人物"));
  await settle();
  expect(session.draft.value?.name).toBe("新人物");
});
it("saves the selected field and retains unrelated changes", async () => {
  const saveCharacterProfile = vi.fn(async (input) => ({
    ...snapshot(),
    profile: input.profile,
    revision: "b".repeat(64)
  }));
  const { session } = setup({
    readCharacterProfile: async () => snapshot(),
    saveCharacterProfile
  });
  await settle();
  session.draft.value!.name = "新名字";
  session.draft.value!.settingDescription = "继续编辑";
  expect(await session.save("name")).toBe(true);
  expect(
    saveCharacterProfile.mock.calls[0]![0].profile.settingDescription
  ).toBe("设定");
  expect(session.draft.value!.settingDescription).toBe("继续编辑");
  expect(session.dirty.value).toBe(true);
});
