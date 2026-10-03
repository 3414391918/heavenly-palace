export type AppView = "workspace" | "settings";

export type WorkspaceMainView =
  "conversation" | "directory" | "models" | "revision-analysis" | "agent-team";

export type PrimaryFeature =
  "directory" | "models" | "revision-analysis" | "agent-teams";

export function primaryFeatureForView(
  view: WorkspaceMainView
): PrimaryFeature | undefined {
  switch (view) {
    case "agent-team":
      return "agent-teams";
    case "directory":
    case "models":
    case "revision-analysis":
      return view;
    default:
      return undefined;
  }
}
