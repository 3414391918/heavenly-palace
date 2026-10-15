export type AppView = "workspace" | "settings";

export type WorkspaceMainView =
  | "conversation"
  | "directory"
  | "models"
  | "revision-analysis"
  | "voice-manager"
  | "prompt-templates"
  | "agent-team";

export type PrimaryFeature =
  | "directory"
  | "models"
  | "revision-analysis"
  | "voice-manager"
  | "prompt-templates"
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
    case "prompt-templates":
      return view;
    default:
      return undefined;
  }
}
