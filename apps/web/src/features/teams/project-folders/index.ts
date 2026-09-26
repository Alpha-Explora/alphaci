/* The Teams project explorer: a team's Projects (hierarchy delivery
 * projects), the repositories each groups, and their checklists. Mounted by
 * the Teams page and the Workflows studio through ProjectExplorerHost. */
export {
  ProjectExplorer,
  ProjectExplorerHost,
  type ProjectExplorerSlot,
} from "./views/project-explorer";
export {
  useProjectFoldersViewModel,
  type ProjectFoldersViewModel,
} from "./view-models/use-project-folders-view-model";
export type {
  ProjectFolder,
  ProjectFoldersSnapshot,
  RepoRole,
} from "./model/project-folder-types";
