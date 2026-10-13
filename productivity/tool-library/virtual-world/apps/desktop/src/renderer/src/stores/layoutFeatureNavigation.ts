export type AppView = "workspace" | "settings";

export type WorkspaceMainView =
  | "conversation"
  | "directory"
  | "models"
  | "revision-analysis"
  | "voice-manager"
  | "agent-team";

export type PrimaryFeature =
  | "directory"
  | "models"
  | "revision-analysis"
  | "voice-manager"
  | "agent-teams";

export function primaryFeatureForView(
  view: WorkspaceMainView
): PrimaryFeature | undefined {
  switch (view) {
    case "agent-team":
      return "agent-teams";
    case "directory":
    case "models":
    case "revision-analysis":
    case "voice-manager":
      return view;
    default:
      return undefined;
  }
}
