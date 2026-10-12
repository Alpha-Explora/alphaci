/* The project explorer: a team's Projects (hierarchy delivery projects), the
 * repositories each groups, and their checklists. Mounted by the Projects
 * page (/workflows) through ProjectExplorerHost. */
export {
  ProjectExplorer,
  ProjectExplorerHost,
  type ProjectExplorerActions,
  type ProjectExplorerSlot,
} from "./views/project-explorer";
export {
  useProjectFoldersViewModel,
  type ProjectFoldersViewModel,
} from "./view-models/use-project-folders-view-model";
/* The team's Projects, read once: the Create Project wizard lists them for a
 * Developer to choose where a repository goes. View-models only. */
export { projectFoldersRepository } from "./data/project-folders-repository";
export type {
  FolderRepository,
  ProjectFolder,
  ProjectFoldersSnapshot,
  RepoRole,
} from "./model/project-folder-types";
/* Links into a Project, for Home's role dashboards: the Add repository wizard
 * scoped to a team (and Project), and the repository a Project opens on. */
export { createRepositoryHref, folderLandingProjectId } from "./model/project-folder-rules";
