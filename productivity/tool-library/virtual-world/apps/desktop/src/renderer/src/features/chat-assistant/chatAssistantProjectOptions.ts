import type { PopupSelectOption } from "../../components/PopupSelect.vue";
import type { ChatAssistantProjectOption } from "./useChatAssistantMode";
export const projectTypeLabels = {
  short: "短篇",
  script: "剧本",
  long: "长篇"
} as const;
export function groupedProjectOptions(
  candidates: readonly ChatAssistantProjectOption[]
): PopupSelectOption[] {
  const options: PopupSelectOption[] = [];
  for (const type of ["short", "script", "long"] as const) {
    const projects = candidates.filter(
      (option) => option.project.projectType === type
    );
    if (!projects.length) continue;
    options.push({
      value: `group:${type}`,
      label: projectTypeLabels[type],
      disabled: true,
      style: { fontWeight: "600", color: "var(--text-tertiary)" }
    });
    options.push(
      ...projects.map((option) => ({
        value: option.key,
        label: option.label,
        description: projectTypeLabels[type],
        style: { paddingLeft: "22px" }
      }))
    );
  }
  return options;
}
