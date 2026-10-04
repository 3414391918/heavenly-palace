import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LONG_AGENT_SETTINGS,
  type DeepWriteApi,
  type PromptTemplate
} from "@deepwrite/contracts";
import { usePromptTemplates } from "./usePromptTemplates";

function harness() {
  let saved: PromptTemplate[] = [
    { id: "existing", name: "检查设定", content: "检查现有设定。" }
  ];
  const list = vi.fn(async () => ({
    ...DEFAULT_LONG_AGENT_SETTINGS,
    promptTemplates: saved
  }));
  const updatePromptTemplate = vi.fn<
    DeepWriteApi["longAgents"]["updatePromptTemplate"]
  >(async (update) => {
    if (update.action === "delete")
      saved = saved.filter(({ id }) => id !== update.id);
    else
      saved = [
        ...saved.filter(({ id }) => id !== update.template.id),
        { ...update.template }
      ];
    return { ...DEFAULT_LONG_AGENT_SETTINGS, promptTemplates: saved };
  });
  const use = vi.fn();
  const error = vi.fn();
  const warning = vi.fn();
  const model = usePromptTemplates({
    api: () => ({ list, updatePromptTemplate }),
    use,
    error,
    warning,
    makeId: () => "new-template"
  });
  return { model, list, updatePromptTemplate, use, error, warning };
}

describe("prompt template editor", () => {
  it("saves the edited name and content without filling the composer", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.name = "检查人物";
    test.model.draft.value!.content = "检查人物当前状态。";
    await test.model.save();
    expect(test.updatePromptTemplate).toHaveBeenCalledWith({
      action: "save",
      template: {
        id: "existing",
        name: "检查人物",
        content: "检查人物当前状态。"
      }
    });
    expect(test.model.templates.value[0]!.name).toBe("检查人物");
    expect(test.use).not.toHaveBeenCalled();
    expect(test.model.draft.value).toBeNull();
  });

  it("uses current unsaved text without saving or sending it", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.content = "这次额外检查第四章。";
    test.model.use();
    expect(test.use).toHaveBeenCalledWith("这次额外检查第四章。");
    expect(test.updatePromptTemplate).not.toHaveBeenCalled();
    expect(test.model.templates.value[0]!.content).toBe("检查现有设定。");
    expect(test.model.draft.value).toBeNull();
  });

  it("creates and deletes a template, including the last one", async () => {
    const test = harness();
    await test.model.load();
    test.model.open();
    expect(test.model.existing.value).toBe(false);
    test.model.draft.value!.name = "我的任务";
    test.model.draft.value!.content = "整理人物关系。";
    await test.model.save();
    expect(test.model.templates.value).toHaveLength(2);
    for (const template of [...test.model.templates.value]) {
      test.model.open(template);
      await test.model.remove();
    }
    expect(test.model.templates.value).toEqual([]);
  });

  it("discards unsaved edits when the dialog is closed", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.name = "未保存";
    test.model.close();
    expect(test.model.templates.value[0]!.name).toBe("检查设定");
    expect(test.updatePromptTemplate).not.toHaveBeenCalled();
  });

  it("keeps the editor open after a failed save and rejects blank content", async () => {
    const test = harness();
    await test.model.load();
    test.model.open(test.model.templates.value[0]);
    test.model.draft.value!.content = "   ";
    await test.model.save();
    test.model.use();
    expect(test.warning).toHaveBeenCalled();
    expect(test.use).not.toHaveBeenCalled();
    expect(test.updatePromptTemplate).not.toHaveBeenCalled();
    test.model.draft.value!.content = "保留用户输入。";
    test.updatePromptTemplate.mockRejectedValueOnce(new Error("保存失败"));
    await test.model.save();
    expect(test.error).toHaveBeenCalledWith("保存失败");
    expect(test.model.draft.value!.content).toBe("保留用户输入。");
  });

  it("does not allow edits before configuration loads successfully", async () => {
    const test = harness();
    test.list.mockRejectedValueOnce(new Error("加载失败"));
    await test.model.load();
    test.model.open();
    expect(test.model.draft.value).toBeNull();
    expect(test.model.loaded.value).toBe(false);
    await test.model.load();
    test.model.open();
    expect(test.model.draft.value).not.toBeNull();
  });
});
