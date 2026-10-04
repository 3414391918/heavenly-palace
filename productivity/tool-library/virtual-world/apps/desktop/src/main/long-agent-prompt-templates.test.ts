import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LONG_AGENT_SETTINGS } from "@deepwrite/contracts";
import { LongAgentConfigStore } from "./long-agent-config-store";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "virtual-world-templates-"));
  roots.push(root);
  return {
    root,
    store: new LongAgentConfigStore(root),
    path: join(root, "config", "long-workspace-agents.json")
  };
}
function editable() {
  return {
    workspaceType: "long" as const,
    agents: DEFAULT_LONG_AGENT_SETTINGS.agents.map(
      ({ id, systemPrompt, welcomeShortcuts, readAccess }) => ({
        id,
        systemPrompt,
        welcomeShortcuts,
        readAccess
      })
    )
  };
}

describe("novel welcome prompt templates", () => {
  it("initializes templates from existing customized shortcuts", async () => {
    const { store, path } = await fixture();
    const settings = editable();
    settings.agents[0]!.welcomeShortcuts = ["自定义一", "自定义二", "自定义三"];
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify({ version: 3, ...settings }));
    const loaded = await store.list();
    expect(
      loaded.promptTemplates?.map(({ name, content }) => [name, content])
    ).toEqual([
      ["自定义一", "自定义一"],
      ["自定义二", "自定义二"],
      ["自定义三", "自定义三"]
    ]);
  });

  it("persists a named template and protects the custom system prompt", async () => {
    const { store, root } = await fixture();
    const settings = editable();
    settings.agents[0]!.systemPrompt = "用户自定义创作规则。";
    await store.save(settings);
    await store.updatePromptTemplate({
      action: "save",
      template: {
        id: "template-test",
        name: "检查人物",
        content: "检查人物状态和正文是否一致。"
      }
    });
    const reloaded = await new LongAgentConfigStore(root).list();
    expect(reloaded.promptTemplates).toContainEqual({
      id: "template-test",
      name: "检查人物",
      content: "检查人物状态和正文是否一致。"
    });
    expect(reloaded.agents[0]!.systemPrompt).toBe("用户自定义创作规则。");
  });

  it("preserves deletion of every template across reload, settings save and reset", async () => {
    const { store, root } = await fixture();
    for (const template of (await store.list()).promptTemplates ?? []) {
      await store.updatePromptTemplate({ action: "delete", id: template.id });
    }
    expect(
      (await new LongAgentConfigStore(root).list()).promptTemplates
    ).toEqual([]);
    expect((await store.save(editable())).promptTemplates).toEqual([]);
    expect((await store.reset("long")).promptTemplates).toEqual([]);
  });

  it("merges concurrent single-template writes instead of replacing the list", async () => {
    const { store } = await fixture();
    await Promise.all(
      ["one", "two"].map((id) =>
        store.updatePromptTemplate({
          action: "save",
          template: { id, name: id, content: id }
        })
      )
    );
    expect(
      (await store.list()).promptTemplates?.slice(-2).map(({ id }) => id)
    ).toEqual(["one", "two"]);
  });

  it("rejects blank content without changing the persisted configuration", async () => {
    const { store, path } = await fixture();
    await store.save(editable());
    const before = await readFile(path, "utf8");
    await expect(
      store.updatePromptTemplate({
        action: "save",
        template: { id: "invalid", name: "模板", content: "   " }
      })
    ).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe(before);
  });
});
