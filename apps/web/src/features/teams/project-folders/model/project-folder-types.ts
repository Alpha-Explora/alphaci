/* Project folder types. Pure: no React, no fetch, no Next.
 *
 * A team (a workspace, called a "group" on the wire) owns Projects — the
 * hierarchy "delivery projects" — and each Project groups the repositories
 * that ship together, typically a `<name>-fe` and `<name>-be` pair. Every
 * repository row can link to the AlphaCI project whose dashboard it opens.
 *
 * The *Wire interfaces mirror the backend contract; everything the views read
 * goes through the normalisers in project-folder-rules.ts first, so a missing
 * or malformed field degrades to a safe default instead of a crash. */

/** Derived by the server from the declared stack, never from the name. */
export type RepoRole = "frontend" | "backend" | "service" | "app";

/* ── Wire shapes (GET /groups/:groupId/project-folders) ─────────────────── */

export interface FolderProjectWire {
  id: string;
  role: RepoRole;
  status: string;
  repoShape: string | null;
}

export interface FolderRepositoryWire {
  repositoryId: string;
  name: string;
  repoFullName: string | null;
  status: string;
  project: FolderProjectWire | null;
}

export interface ProjectFolderWire {
  deliveryProjectId: string;
  systemId: string;
  name: string;
  createdAt: string;
  repositories: FolderRepositoryWire[];
}

export interface UnfiledProjectWire {
  id: string;
  name: string;
  repoFullName: string | null;
  role: RepoRole;
  status: string;
  repoShape: string | null;
}

export interface ProjectFoldersResponseWire {
  groupId: string;
  canManage: boolean;
  folders: ProjectFolderWire[];
  unfiled: UnfiledProjectWire[];
}

/** POST /groups/:groupId/projects — creates an empty Project. */
export interface CreateProjectFolderRequest {
  name: string;
  description?: string;
}

/** POST /repositories/:repositoryId/move */
export interface MoveRepositoryRequest {
  deliveryProjectId: string;
}

export interface MoveRepositoryResponseWire {
  repository: Record<string, unknown>;
  moved: boolean;
  sourceDeliveryProjectId: string | null;
  sourceDeliveryProjectEmpty: boolean;
}

/** PATCH /qa-checklists/:id/projects — only touches the ids it names. */
export interface ChecklistProjectsPatch {
  add?: string[];
  remove?: string[];
}

/** DELETE /delivery-projects/:deliveryProjectId */
export interface DeleteProjectFolderRequest {
  confirmName: string;
  deleteGithubRepos?: boolean;
  deleteProviderResources?: boolean;
  deleteSonarProjects?: boolean;
}

export interface DeletedRepositoryWire {
  repositoryId: string;
  name: string;
  projectId: string | null;
  githubRepoDeleted: boolean;
}

/** 200 body. */
export interface DeleteProjectFolderResponseWire {
  deliveryProjectId: string;
  name: string;
  deletedRepositories: DeletedRepositoryWire[];
}

/** 409 body: a repository failed, so the Project is kept with the rest. */
export interface DeleteProjectFolderConflictWire {
  code: string;
  message: string;
  deletedRepositories: DeletedRepositoryWire[];
  failedRepository: { repositoryId: string; name: string };
}

/* ── What the views read (normalised) ───────────────────────────────────── */

export interface FolderProject {
  id: string;
  role: RepoRole;
  status: string;
  repoShape: string | null;
}

export interface FolderRepository {
  repositoryId: string;
  name: string;
  repoFullName: string | null;
  status: string;
  /** null when the repository is not linked to an AlphaCI project. */
  project: FolderProject | null;
}

export interface ProjectFolder {
  deliveryProjectId: string;
  systemId: string;
  name: string;
  createdAt: string | null;
  repositories: FolderRepository[];
}

export interface UnfiledProject {
  id: string;
  name: string;
  repoFullName: string | null;
  role: RepoRole;
  status: string;
  repoShape: string | null;
}

export interface ProjectFoldersSnapshot {
  groupId: string;
  /** Server-decided: Team lead, delegated lead or platform admin. */
  canManage: boolean;
  folders: ProjectFolder[];
  unfiled: UnfiledProject[];
}

/** Only what the explorer needs from a team checklist. */
export interface FolderChecklist {
  id: string;
  name: string;
  itemCount: number;
  archived: boolean;
  sharedProjectIds: string[];
}

/** How a checklist relates to one Project's repositories. */
export type ChecklistAttachment = "attached" | "partial" | "none";

export interface MoveOutcome {
  moved: boolean;
  sourceDeliveryProjectId: string | null;
  sourceDeliveryProjectEmpty: boolean;
}

export interface DeletedRepository {
  repositoryId: string;
  name: string;
  projectId: string | null;
  githubRepoDeleted: boolean;
}

/** The 200 outcome of deleting a Project. */
export interface DeleteProjectOutcome {
  deliveryProjectId: string;
  name: string;
  deletedRepositories: DeletedRepository[];
}

/** The 409 outcome: the Project survives with whatever it managed to delete. */
export interface DeleteProjectFailure {
  code: string;
  message: string;
  deletedRepositories: DeletedRepository[];
  failedRepository: { repositoryId: string; name: string } | null;
}

export type ProjectFoldersStatus = "loading" | "ready" | "error";
