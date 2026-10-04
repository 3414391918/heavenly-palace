import { computed, ref } from "vue";
import {
  PromptTemplateSchema,
  PromptTemplatesSchema,
  promptTemplatesFromShortcuts,
  type DeepWriteApi,
  type PromptTemplate,
  type PromptTemplateUpdate,
  type LongAgentSettings
} from "@deepwrite/contracts/renderer";

export function usePromptTemplates(options: {
  api: () =>
    | Pick<DeepWriteApi["longAgents"], "list" | "updatePromptTemplate">
    | undefined;
  use: (content: string) => void;
  error: (message: string) => unknown;
  warning: (message: string) => unknown;
  makeId?: () => string;
}) {
  const templates = ref<PromptTemplate[]>([]);
  const draft = ref<PromptTemplate | null>(null);
  const busy = ref(false);
  const loaded = ref(false);
  const existing = computed(() =>
    Boolean(
      draft.value && templates.value.some(({ id }) => id === draft.value!.id)
    )
  );
  let disposed = false;

  function apply(settings: LongAgentSettings): void {
    templates.value = PromptTemplatesSchema.parse(
      settings.promptTemplates ??
        promptTemplatesFromShortcuts(settings.agents[0]!.welcomeShortcuts)
    );
  }
  async function load(): Promise<void> {
    if (busy.value || draft.value || disposed) return;
    busy.value = true;
    try {
      const api = options.api();
      if (!api) throw new Error("提示词模板服务暂不可用。");
      const settings = await api.list();
      if (disposed) return;
      apply(settings);
      loaded.value = true;
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "加载提示词模板失败。"
        );
    } finally {
      busy.value = false;
    }
  }
  function open(template?: PromptTemplate): void {
    if (!loaded.value || busy.value || disposed) return;
    draft.value = template
      ? { ...template }
      : {
          id: options.makeId?.() ?? `template_${crypto.randomUUID()}`,
          name: "",
          content: ""
        };
  }
  function close(): void {
    if (!busy.value) draft.value = null;
  }
  async function update(input: PromptTemplateUpdate): Promise<void> {
    if (busy.value || disposed) return;
    busy.value = true;
    try {
      const api = options.api();
      if (!api) throw new Error("提示词模板服务暂不可用。");
      const settings = await api.updatePromptTemplate(input);
      if (disposed) return;
      apply(settings);
      draft.value = null;
    } catch (error) {
      if (!disposed)
        options.error(
          error instanceof Error ? error.message : "更新提示词模板失败。"
        );
    } finally {
      busy.value = false;
    }
  }
  async function save(): Promise<void> {
    if (!draft.value) return;
    const parsed = PromptTemplateSchema.safeParse(draft.value);
    if (!parsed.success) {
      options.warning(
        parsed.error.issues[0]?.message ?? "请填写完整的模板名称和内容。"
      );
      return;
    }
    await update({ action: "save", template: parsed.data });
  }
  async function remove(): Promise<void> {
    if (draft.value && existing.value)
      await update({ action: "delete", id: draft.value.id });
  }
  function use(): void {
    if (!draft.value || busy.value || disposed) return;
    if (!draft.value.content.trim()) {
      options.warning("请输入模板内容。");
      return;
    }
    options.use(draft.value.content);
    draft.value = null;
  }
  return {
    templates,
    draft,
    busy,
    loaded,
    existing,
    load,
    open,
    close,
    save,
    remove,
    use,
    dispose: () => {
      disposed = true;
    }
  };
}
