"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import { manageProjectHref, repoSwitchPresentation } from "../model/project-folder-rules";
import type {
  FolderRepoRole,
  ProjectFolderStatus,
  ProjectFolderSummary,
  RepoSwitchPresentation,
} from "../model/project-folder-types";

export interface ProjectFolderViewModel extends RepoSwitchPresentation {
  status: ProjectFolderStatus;
  /**
   * The Project this repository is filed under, whatever its size (the
   * presentation above only names Projects of two or more repositories).
   * Null fields: no Project, or the folder could not be read.
   */
  project: {
    deliveryProjectId: string | null;
    name: string | null;
    href: string | null;
    /** Each repository's role (frontend, backend, …): what QA Studio's Playwright tab filters by. */
    repositories: Array<{ projectId: string | null; role: FolderRepoRole | null }>;
  };
}

interface Loaded {
  projectId: string;
  /** null: the folder could not be read (404, older backend, any failure). */
  folder: ProjectFolderSummary | null;
}

function statusOf(active: boolean, current: Loaded | null): ProjectFolderStatus {
  if (!active) return "idle";
  if (!current) return "loading";
  return current.folder ? "ready" : "unavailable";
}

/** The Project fields the QA screens need, whatever the Project's size. */
function projectOf(folder: ProjectFolderSummary | null): ProjectFolderViewModel["project"] {
  return {
    deliveryProjectId: folder?.deliveryProjectId ?? null,
    name: folder?.name || null,
    href: manageProjectHref(folder),
    repositories: (folder?.repositories ?? []).map((repository) => ({
      projectId: repository.projectId,
      role: repository.role,
    })),
  };
}

/**
 * ViewModel for the project page's Project identity and repository switch.
 *
 * The folder is an enhancement on a page that works without it, so every
 * failure — a 404 from a backend without the route included — resolves to
 * `unavailable` and the page renders as it always has. Results are kept with
 * the project they were read for, and a request counter stops a slow read for
 * the previous project overwriting the one on screen.
 */
export function useProjectFolderViewModel(options: {
  projectId: string;
  /** Only fetch once the session is known good and the viewer is not a guest. */
  enabled: boolean;
}): ProjectFolderViewModel {
  const { projectId, enabled } = options;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const request = useRef(0);
  const active = enabled && Boolean(projectId);

  useEffect(() => {
    if (!active) return;
    request.current += 1;
    const id = request.current;
    projectsRepository
      .folder(projectId)
      .then((folder) => {
        if (id === request.current) setLoaded({ projectId, folder });
      })
      .catch(() => {
        // Not an error the viewer needs: the page simply stays single-repo.
        if (id === request.current) setLoaded({ projectId, folder: null });
      });
  }, [active, projectId]);

  const current = loaded?.projectId === projectId ? loaded : null;

  return {
    status: statusOf(active, current),
    ...repoSwitchPresentation(current?.folder, projectId),
    project: projectOf(current?.folder ?? null),
  };
}
