export {
  WorkspaceProvider,
  useWorkspaceSelection,
} from "./views/workspace-selection-context";
export {
  useWorkspaceSelectionViewModel,
  type WorkspaceSelectionStatus,
  type WorkspaceSelectionViewModel,
} from "./view-models/use-workspace-selection-view-model";
export {
  useAppNavViewModel,
  type AppNavViewModel,
} from "./view-models/use-app-nav-view-model";
export { AppNav } from "./views/app-nav";
export { WorkspaceSwitcher } from "./views/workspace-switcher";
export type {
  WorkspaceMemberSummary,
} from "@/shared/api/contracts";
export type {
  WorkspaceAppRole,
  WorkspaceRole,
  WorkspaceSummary,
  WorkspacesMeResponse,
} from "./model/workspace-types";
/* Who may create a workspace. Exported because the Teams empty state offers
   the same action as the header switcher and must agree with it. */
export { canCreateWorkspace, canOpenTeamActivity } from "./model/workspace-types";
export * from "./data/workspaces-api";
