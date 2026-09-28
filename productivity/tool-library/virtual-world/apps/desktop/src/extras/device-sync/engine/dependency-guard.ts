import {
  syncDependencies,
  syncKey,
  type SyncIssue,
  type SyncItem,
  type SyncMetadata
} from "@deepwrite/contracts";

/** Check references against items actually accepted during this run. */
export function syncDependencyIssue(input: {
  key: string;
  title: string;
  initial: SyncItem | null;
  next: SyncItem | null;
  local: Map<string, SyncItem>;
  accepted: SyncMetadata["baselines"];
}): SyncIssue | null {
  const { key, title, initial, next, local, accepted } = input;
  const issue = {
    key,
    title,
    token: "",
    reason: "unsupported" as const,
    local: initial,
    versions: []
  };
  if (next) {
    const missing = syncDependencies(next).filter((dependency) =>
      accepted[dependency]
        ? !accepted[dependency]?.item
        : !local.has(dependency)
    );
    return missing.length
      ? {
          ...issue,
          message: "绑定的资料尚未就绪，请加入对应资料库并处理其同步事项。",
          paths: missing
        }
      : null;
  }
  const live = new Map(local);
  for (const [id, value] of Object.entries(accepted)) {
    if (value.item) live.set(id, value.item);
    else live.delete(id);
  }
  const dependents = [...live.values()].filter(
    (item) => syncKey(item) !== key && syncDependencies(item).includes(key)
  );
  if (!dependents.length) return null;
  const sources = dependents.map((item) => {
    const kind =
      item.kind === "skill-group"
        ? "技能组"
        : item.kind === "material-group"
          ? "素材组"
          : "作品";
    return `${kind}「${item.title}」`;
  });
  return {
    ...issue,
    message: `此资料仍被${sources.join("、")}引用，请先解除引用，或将引用方一并确认同步删除。`,
    paths: []
  };
}
