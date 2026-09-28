import type { Book } from "@deepwrite/contracts";
import type {
  CreateShortOrScriptBookInput,
  ShortBookLifecycleCoordinatorOptions
} from "./useShortBookLifecycleCoordinator";
export function createShortBookCreator<Lease>(
  options: Pick<
    ShortBookLifecycleCoordinatorOptions,
    "catalog" | "state" | "resources" | "notifications"
  > & {
    acquirePendingLease(lane: "catalog"): Lease | null;
    runWithLease(lease: Lease, task: () => Promise<void>): Promise<void>;
    leaseIsOwned(lease: Lease): boolean;
    leaseCanPublish(lease: Lease): boolean;
    refreshAfterDurableMutation(): Promise<boolean>;
    errorMessage(error: unknown, fallback: string): string;
  }
) {
  const {
    catalog,
    state,
    resources,
    notifications,
    acquirePendingLease,
    runWithLease,
    leaseIsOwned,
    leaseCanPublish,
    refreshAfterDurableMutation,
    errorMessage
  } = options;
  function createBook(input: CreateShortOrScriptBookInput): Promise<void> {
    const api = catalog.api();
    if (!api) {
      notifications.warning("浏览器预览不能保存作品，请使用桌面客户端创建。");
      return Promise.resolve();
    }
    const lease = acquirePendingLease("catalog");
    if (!lease) return Promise.resolve();
    return runWithLease(lease, async () => {
      let created: Book | null = null;
      try {
        created = input.templateId
          ? await api.createBookFromTemplate({
              templateId: input.templateId,
              title: input.title
            })
          : input.workspaceType === "script"
            ? await api.createScriptBook({
                defaultPlotStageIds: input.defaultPlotStageIds,
                title: input.title,
                genre: input.genre,
                characterFormat: input.characterFormat,
                linkedMaterialIdsByKind: input.linkedMaterialIdsByKind,
                linkedSkillIdsByKind: input.linkedSkillIdsByKind
              })
            : await api.createShortBook({
                title: input.title,
                genre: input.genre,
                characterFormat: input.characterFormat,
                defaultPlotStageIds: input.defaultPlotStageIds,
                linkedMaterialIdsByKind: input.linkedMaterialIdsByKind,
                linkedSkillIdsByKind: input.linkedSkillIdsByKind
              });
        if (!created || !leaseIsOwned(lease)) return;

        let directoryRefreshFailed = false;
        try {
          await catalog.refreshWorkspaceDirectory();
        } catch {
          directoryRefreshFailed = true;
        }
        if (!leaseIsOwned(lease)) return;
        const refreshed = await refreshAfterDurableMutation();
        if (!leaseIsOwned(lease)) return;

        state.createBookDialogOpen.value = false;
        if (!refreshed || directoryRefreshFailed) {
          if (leaseCanPublish(lease)) {
            notifications.warning(
              `已创建${input.workspaceType === "script" ? "剧本" : "短篇"}“${created.title}”，但作品列表刷新失败；稍后将自动重试。`
            );
          }
          return;
        }
        await resources.settleUi();
        if (!leaseCanPublish(lease)) return;
        await resources.selectPreferredBook(created.id);
        if (leaseCanPublish(lease)) {
          notifications.success(
            `已创建${input.workspaceType === "script" ? "剧本" : "短篇"}“${created.title}”，素材库和技能库绑定已保存`
          );
        }
      } catch (error: unknown) {
        if (!leaseCanPublish(lease)) return;
        if (created) {
          state.createBookDialogOpen.value = false;
          notifications.warning(
            `已创建作品“${created.title}”，但刷新本地列表失败；稍后将自动重试。`
          );
        } else {
          notifications.error(errorMessage(error, "创建作品失败。"));
        }
      }
    });
  }

  return createBook;
}
