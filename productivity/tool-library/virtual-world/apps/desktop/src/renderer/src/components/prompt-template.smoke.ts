import { createApp, h, nextTick } from "vue";
import ConversationPromptTemplates from "./ConversationPromptTemplates.vue";

/** Mounted only by the disposable Electron smoke profile. */
export async function runPromptTemplateRendererSmoke() {
  const api = window.deepwrite?.longAgents;
  if (!api) throw new Error("Prompt template Preload API unavailable");
  const before = (await api.list()).promptTemplates ?? [];
  const host = document.createElement("div");
  document.body.append(host);
  let used = "";
  let application = createApp({
    render: () =>
      h(ConversationPromptTemplates, {
        onUse: (value: string) => {
          used = value;
        }
      })
  });
  const name = "模板界面验收";
  const content = "检查人物状态与当前章剧情。";
  const wait = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5_000;
    while (!predicate()) {
      if (Date.now() > deadline)
        throw new Error("Prompt template UI smoke timed out");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await nextTick();
  };
  const button = (
    label: string,
    root: ParentNode = host
  ): HTMLButtonElement => {
    const found = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.trim() === label
    );
    if (!found || found.disabled)
      throw new Error(`Template button unavailable: ${label}`);
    return found;
  };
  const dialog = () =>
    document.querySelector<HTMLElement>(".prompt-template-dialog")!;
  const setField = (selector: string, value: string) => {
    const input = dialog().querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  try {
    application.mount(host);
    await wait(() =>
      [...host.querySelectorAll<HTMLButtonElement>("button")].some(
        (item) => item.textContent?.includes("新增模板") && !item.disabled
      )
    );
    button("＋ 新增模板").click();
    await wait(() => Boolean(dialog()));
    const actions = [...dialog().querySelectorAll("footer button")].map(
      (item) => item.textContent?.trim()
    );
    if (actions.join(",") !== "删除模板,使用模板,保存模板")
      throw new Error("Unexpected template actions");
    setField("input", name);
    setField("textarea", content);
    button("保存模板", dialog()).click();
    await wait(() => !dialog());
    if (used) throw new Error("Saving unexpectedly used the template");
    application.unmount();
    application = createApp({
      render: () =>
        h(ConversationPromptTemplates, {
          onUse: (value: string) => {
            used = value;
          }
        })
    });
    application.mount(host);
    await wait(() =>
      [...host.querySelectorAll("button")].some(
        (item) => item.textContent?.trim() === name
      )
    );
    button(name).click();
    await wait(() => Boolean(dialog()));
    if (
      dialog().querySelector<HTMLTextAreaElement>("textarea")!.value !== content
    )
      throw new Error("Template did not survive reopening");
    setField("textarea", "临时增加检查范围。");
    button("使用模板", dialog()).click();
    await wait(() => !dialog());
    if (used !== "临时增加检查范围。")
      throw new Error("Use did not deliver current editor text");
    if (
      (await api.list()).promptTemplates?.find((item) => item.name === name)
        ?.content !== content
    )
      throw new Error("Use unexpectedly persisted the draft");
    button(name).click();
    await wait(() => Boolean(dialog()));
    button("删除模板", dialog()).click();
    await wait(() => !dialog());
    if (
      JSON.stringify((await api.list()).promptTemplates) !==
      JSON.stringify(before)
    )
      throw new Error("Template deletion damaged other templates");
    return {
      status: "ok",
      create: true,
      save: true,
      reopen: true,
      useUnsaved: true,
      delete: true
    };
  } finally {
    application.unmount();
    host.remove();
    const remaining = (await api.list()).promptTemplates ?? [];
    for (const template of remaining.filter((item) => item.name === name))
      await api.updatePromptTemplate({ action: "delete", id: template.id });
  }
}
