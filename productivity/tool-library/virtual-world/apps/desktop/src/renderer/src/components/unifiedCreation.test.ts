import { describe, expect, it } from "vitest";
import { moreFeatures } from "./sidebarMoreFeatures";
import dialog from "./CreateBookDialog.vue?raw";
import settings from "./SettingsPage.vue?raw";
import sidebar from "./LeftSidebar.vue?raw";

describe("unified creation entry points", () => {
  it("opens a book form with current genres and bindings without a creation type selector", () => {
    expect(dialog).toContain("新建书籍");
    expect(dialog).toContain("LONG_BOOK_GENRES");
    expect(dialog).toContain("BookLibraryBindings");
    expect(dialog).not.toContain("workspaceTypeOptions");
    expect(dialog).not.toContain("SHORT_BOOK_GENRES");
    expect(dialog).not.toContain("SCRIPT_BOOK_GENRES");
  });
  it("renders the main agent settings directly", () => {
    expect(settings).toContain("<LongAgentSettingsPanel");
    expect(settings).not.toContain("ShortAgentSettingsPanel");
    expect(settings).toContain("主智能体配置");
  });
  it("exposes the subagent team and only revision analysis in more features", () => {
    expect(sidebar).toContain("子智能体团队");
    expect(moreFeatures).toEqual([
      {
        id: "revision-analysis",
        label: "修改分析",
        description: "从文稿修改中学习可复用技能",
        icon: "file"
      }
    ]);
  });
});
