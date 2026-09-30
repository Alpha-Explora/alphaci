"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthSession } from "@/features/auth/session";
import { roleCanStartRun } from "@/features/checklists";
import { isGlobalCreatorRole } from "@/features/groups";

import { projectFoldersRepository } from "../data/project-folders-repository";
import { findFolder, loadErrorMessage } from "../model/project-folder-rules";
import type {
  FolderChecklist,
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
  /** Server-decided: New Project, Move and checklist attach/detach. */
  canManage: boolean;
  /** App role lead/admin: may start the create-repository wizard. */
  canCreateRepository: boolean;
  /** QA Team, Team lead or Admin, with the checklists capability on. */
  canVerifyInQaStudio: boolean;
  /** Checklist UI exists only with the qaChecklists capability. */
  qaChecklistsEnabled: boolean;
  /** Team checklists; null while loading or when the capability is off. */
  checklists: FolderChecklist[] | null;
  /** The Project open in the detail screen, or null for the list. */
  selected: ProjectFolder | null;
  openFolder: (deliveryProjectId: string) => void;
  closeFolder: () => void;
  reload: () => void;
  /** Merge a checklist the server just saved (after attach/detach). */
  applyChecklist: (checklist: FolderChecklist) => void;
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
  const [checklists, setChecklists] = useState<Loaded<FolderChecklist[]> | null>(null);
  // Kept with its team, like every other result here: switching teams closes
  // the open Project rather than reopening a same-id one elsewhere.
  const [selection, setSelection] = useState<Loaded<string> | null>(() =>
    initialFolderId ? { groupId, value: initialFolderId } : null,
  );
  const [nonce, setNonce] = useState(0);
  const foldersRequest = useRef(0);
  const checklistsRequest = useRef(0);

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
    checklistsRequest.current += 1;
    const id = checklistsRequest.current;
    projectFoldersRepository
      .listChecklists(groupId)
      .then((value) => {
        if (id === checklistsRequest.current) setChecklists({ groupId, value });
      })
      .catch(() => {
        // Counts and attach lists are extras on a usable page: without them
        // the explorer still shows every Project and repository.
        if (id === checklistsRequest.current) setChecklists({ groupId, value: [] });
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

  const applyChecklist = useCallback((saved: FolderChecklist) => {
    setChecklists((loaded) => replaceChecklist(loaded, saved));
  }, []);

  return {
    groupId,
    groupName,
    status: statusOf(current, error),
    error,
    ...view,
    canCreateRepository: isGlobalCreatorRole(appRole),
    canVerifyInQaStudio: qaChecklistsEnabled && roleCanStartRun(appRole),
    qaChecklistsEnabled,
    checklists: qaChecklistsEnabled ? currentFor(checklists, groupId) : null,
    selected: findFolder(view.folders, currentFor(selection, groupId)),
    openFolder,
    closeFolder,
    reload,
    applyChecklist,
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

function replaceChecklist(
  loaded: Loaded<FolderChecklist[]> | null,
  saved: FolderChecklist,
): Loaded<FolderChecklist[]> | null {
  if (!loaded) return loaded;
  return {
    ...loaded,
    value: loaded.value.map((entry) => (entry.id === saved.id ? saved : entry)),
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
