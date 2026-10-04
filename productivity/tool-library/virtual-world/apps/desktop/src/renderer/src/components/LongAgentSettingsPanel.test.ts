import { describe, expect, it } from "vitest";
import longPanelSource from "./LongAgentSettingsPanel.vue?raw";
import settingsPageSource from "./SettingsPage.vue?raw";

describe("main agent settings UI", () => {
  it("exposes the unified main agent in creation settings", () => {
    expect(longPanelSource).toContain("LONG_AGENT_IDS");
    for (const root of [
      "worldbuilding",
      "character_design",
      "plot_design",
      "draft",
      "continuity_ledger"
    ]) {
      expect(longPanelSource).toContain(`id: "${root}"`);
    }
    expect(longPanelSource).toContain("主智能体已恢复内置值");
    expect(settingsPageSource).toContain("<LongAgentSettingsPanel");
    expect(settingsPageSource).toContain(
      "v-if=\"activeCategory === 'main-agent'\""
    );
    expect(settingsPageSource).toContain(
      "@save=\"emit('saveLongAgents', $event)\""
    );
    expect(settingsPageSource).not.toContain("<ShortAgentSettingsPanel");
  });

  it("edits system prompts and catalog read scopes", () => {
    expect(longPanelSource).toContain("LongAgentSettingsInputSchema.safeParse");
    expect(longPanelSource).toContain("readAccess.materialKinds");
    expect(longPanelSource).toContain("readAccess.skillKinds");
    for (const label of ["系统提示词", "素材库", "技能库"])
      expect(longPanelSource).toContain(label);
    expect(longPanelSource).not.toContain("<h4>欢迎快捷按钮</h4>");
    expect(longPanelSource).not.toContain('v-model="activeAgent.writeAccess');
    expect(longPanelSource).not.toContain("patchWriteAccess");
  });

  it("shows fixed full read access and immutable write boundaries", () => {
    expect(longPanelSource).toContain("阶段读取、写入与工具边界");
    expect(longPanelSource).toContain(
      "阶段范围与写入边界由应用内置并在 Main 与工具层强制校验。"
    );
    expect(longPanelSource).toContain(
      "阶段读取范围：世界观、人物、剧情、正文与连续性账本全部可读"
    );
    expect(longPanelSource).not.toContain(
      "handleCheckboxChange('workspaceRoots'"
    );
  });

  it("uses shared themed presentation and no native select", () => {
    expect(longPanelSource).toContain(
      '<style scoped src="./LongAgentSettingsPanel.css">'
    );
    expect(longPanelSource).toContain(
      'v-else class="long-agent-settings-layout"'
    );
    expect(longPanelSource).not.toContain("<select");
  });

  it("receives loading, saving and retry state directly from SettingsPage", () => {
    expect(longPanelSource).toContain("loading: boolean");
    expect(longPanelSource).toContain("saving: boolean");
    expect(longPanelSource).toContain("loadError?: string | null");
    expect(longPanelSource).toContain('v-else-if="loadError"');
    expect(longPanelSource).toContain("@click=\"emit('retry')\"");
    expect(settingsPageSource).toContain(':loading="longAgentLoading"');
    expect(settingsPageSource).toContain(':saving="longAgentSaving"');
    expect(settingsPageSource).toContain(':load-error="longAgentError"');
    expect(settingsPageSource).toContain("@retry=\"emit('retryLongAgents')\"");
  });
});
