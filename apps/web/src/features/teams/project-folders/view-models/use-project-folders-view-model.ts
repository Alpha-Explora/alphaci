"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/features/auth/session";
import type { AppRole } from "@/shared/api/contracts";
import { roleCanStartRun } from "@/features/checklists";
import {
  canCreateRepositoryWithoutProject,
  resolveCanCreateProject,
  resolveCanCreateRepository,
} from "@/features/groups";

import { projectFoldersRepository } from "../data/project-folders-repository";
import { findFolder, loadErrorMessage } from "../model/project-folder-rules";
import type {
  ProjectFolder,
  ProjectFoldersSnapshot,
  ProjectFoldersStatus,
  UnfiledProject,
} from "../model/project-folder-types";

export interface ProjectFoldersViewModel {
  groupId: string;
  groupName: string;
  status: ProjectFoldersStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  folders: ProjectFolder[];
  unfiled: UnfiledProject[];
  /** Projects in the team, or null until the first load resolves. */
  count: number | null;
  /** Server-decided: Move, Delete and checklist attach/detach. */
  canManage: boolean;
  /**
   * Product owner (app role lead) or admin: may create an empty Project (the
   * server's `canCreateProject`, else the app-role rule).
   */
  canCreateProject: boolean;
  /**
   * Developer or admin: may add a repository to a Project (the server's
   * `canCreateRepository`, else the app-role rule). Never a lead or QA.
   */
  canCreateRepository: boolean;
  /** Admin only: may start the wizard with no Project chosen. */
  canCreateUnfiledRepository: boolean;
  /** QA Team, Team lead or Admin, with the checklists capability on. */
  canVerifyInQaStudio: boolean;
  /** Requirements and QA UI exist only with the qaChecklists capability. */
  qaChecklistsEnabled: boolean;
  /**
   * Live requirements per Project (by delivery project id); null while
   * loading, when the capability is off, or when the server cannot say.
   */
  requirementCounts: Record<string, number> | null;
  /** The viewer's app role, for the Project QA workspace. */
  appRole: AppRole | null;
  /** The Project open in the detail screen, or null for the list. */
  selected: ProjectFolder | null;
  openFolder: (deliveryProjectId: string) => void;
  closeFolder: () => void;
  reload: () => void;
}

interface Loaded<T> {
  groupId: string;
  value: T;
}

/**
 * ViewModel for a team's project explorer.
 *
 * Results are kept with the group they belong to, so switching teams never
 * shows the previous team's Projects under the new heading, and a slow first
 * response cannot overwrite a fast second one (request counters).
 */
export function useProjectFoldersViewModel(options: {
  groupId: string;
  groupName: string;
  qaChecklistsEnabled: boolean;
  /** Open this Project's detail on arrival (a deep link), for this team only. */
  initialFolderId?: string | null;
}): ProjectFoldersViewModel {
  const { groupId, groupName, qaChecklistsEnabled, initialFolderId } = options;
  const { session } = useAuthSession();
  const appRole = session?.appRole;

  const [snapshot, setSnapshot] = useState<Loaded<ProjectFoldersSnapshot> | null>(null);
  const [failure, setFailure] = useState<Loaded<string> | null>(null);
  const [counts, setCounts] = useState<Loaded<Record<string, number> | null> | null>(null);
  // Kept with its team, like every other result here: switching teams closes
  // the open Project rather than reopening a same-id one elsewhere.
  const [selection, setSelection] = useState<Loaded<string> | null>(() =>
    initialFolderId ? { groupId, value: initialFolderId } : null,
  );
  const [nonce, setNonce] = useState(0);
  const foldersRequest = useRef(0);
  const countsRequest = useRef(0);

  useEffect(() => {
    if (!groupId) return;
    foldersRequest.current += 1;
    const id = foldersRequest.current;
    projectFoldersRepository
      .list(groupId)
      .then((value) => {
        if (id !== foldersRequest.current) return;
        setSnapshot({ groupId, value });
        setFailure(null);
      })
      .catch((cause: unknown) => {
        if (id !== foldersRequest.current) return;
        setFailure({ groupId, value: loadErrorMessage(cause) });
      });
  }, [groupId, nonce]);

  useEffect(() => {
    if (!groupId || !qaChecklistsEnabled) return;
    countsRequest.current += 1;
    const id = countsRequest.current;
    projectFoldersRepository
      .requirementCounts(groupId)
      .then((value) => {
        if (id === countsRequest.current) setCounts({ groupId, value });
      })
      .catch(() => {
        // Counts are an extra on a usable page (and an older backend has no
        // overview): without them the cards simply show no count.
        if (id === countsRequest.current) setCounts({ groupId, value: null });
      });
  }, [groupId, qaChecklistsEnabled, nonce]);

  const current = currentFor(snapshot, groupId);
  const error = currentFor(failure, groupId);
  const view = snapshotFields(current);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const openFolder = useCallback(
    (deliveryProjectId: string) => setSelection({ groupId, value: deliveryProjectId }),
    [groupId],
  );
  const closeFolder = useCallback(() => setSelection(null), []);

  return {
    groupId,
    groupName,
    status: statusOf(current, error),
    error,
    ...view,
    canCreateProject: resolveCanCreateProject(current?.canCreateProject, appRole),
    canCreateRepository: resolveCanCreateRepository(current?.canCreateRepository, appRole),
    canCreateUnfiledRepository: canCreateRepositoryWithoutProject(appRole),
    canVerifyInQaStudio: qaChecklistsEnabled && roleCanStartRun(appRole),
    qaChecklistsEnabled,
    requirementCounts: qaChecklistsEnabled ? currentFor(counts, groupId) : null,
    appRole: appRole ?? null,
    selected: findFolder(view.folders, currentFor(selection, groupId)),
    openFolder,
    closeFolder,
    reload,
  };
}

/** A result, but only if it belongs to the team on screen. */
function currentFor<T>(loaded: Loaded<T> | null, groupId: string): T | null {
  return loaded && loaded.groupId === groupId ? loaded.value : null;
}

function snapshotFields(current: ProjectFoldersSnapshot | null) {
  if (!current) {
    return { folders: [], unfiled: [], count: null, canManage: false };
  }
  return {
    folders: current.folders,
    unfiled: current.unfiled,
    count: current.folders.length,
    canManage: current.canManage,
  };
}

/** A load error wins only when there is nothing to show for this team. */
function statusOf(
  current: ProjectFoldersSnapshot | null,
  error: string | null,
): ProjectFoldersStatus {
  if (current) return "ready";
  return error ? "error" : "loading";
}
