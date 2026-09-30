/* The Project (hierarchy "delivery project") a repository belongs to, as the
 * project page reads it. Pure: no React, no fetch, no Next.
 *
 * A multi-repository Project is one product split across repositories — a
 * frontend and its backend, typically — and each repository with an AlphaCI
 * project has its own /projects/:id page. The page reads the folder so it can
 * present those pages as one Project with a switch between them. */

/** Derived by the server from the declared stack, never from the name. */
export type FolderRepoRole = "frontend" | "backend" | "service" | "app";

/** GET /projects/:projectId/folder — the wire shape, before normalising. */
export interface ProjectFolderWire {
  deliveryProjectId: string | null;
  groupId: string | null;
  name: string;
  repositories: Array<{
    projectId: string | null;
    name: string;
    repoFullName: string | null;
    role: FolderRepoRole | null;
    status: string | null;
  }>;
}

export interface ProjectFolderRepository {
  /** null when the repository is not linked to an AlphaCI project yet. */
  projectId: string | null;
  name: string;
  repoFullName: string | null;
  role: FolderRepoRole | null;
  status: string | null;
}

export interface ProjectFolderSummary {
  /** null when the repository is not filed in a Project. */
  deliveryProjectId: string | null;
  groupId: string | null;
  name: string;
  /** Ordered frontend, backend, service, app (the server's order, kept). */
  repositories: ProjectFolderRepository[];
}

/** One option of the repository switch, ready to draw. */
export interface RepoSwitchOption {
  /** Stable React key: the project id, else the repository name. */
  key: string;
  projectId: string | null;
  role: FolderRepoRole | null;
  /** "FRONTEND", "BACKEND", … */
  roleLabel: string;
  /** The short repository name, "Org/shop-fe" -> "shop-fe". */
  label: string;
  repoFullName: string | null;
  /** The page on screen. */
  current: boolean;
  /** No AlphaCI project to open. */
  disabled: boolean;
}

/** What the page header draws from the folder. All-null: the single-repo page. */
export interface RepoSwitchPresentation {
  /** The Project name to title the page with, or null to title it as before. */
  projectName: string | null;
  /** One per repository, in role order. Empty unless `projectName` is set. */
  options: RepoSwitchOption[];
  /** The Teams page opened on this Project, or null when it cannot be named. */
  manageHref: string | null;
}

/**
 * Lifecycle of the folder read. `unavailable` covers a 404 (an older backend
 * without the route, or a project the caller cannot see) and any failure: the
 * page then renders exactly as it did before Projects existed.
 */
export type ProjectFolderStatus = "idle" | "loading" | "ready" | "unavailable";
