"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import { repoSwitchPresentation } from "../model/project-folder-rules";
import type {
  ProjectFolderStatus,
  ProjectFolderSummary,
  RepoSwitchPresentation,
} from "../model/project-folder-types";

export interface ProjectFolderViewModel extends RepoSwitchPresentation {
  status: ProjectFolderStatus;
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
  };
}
