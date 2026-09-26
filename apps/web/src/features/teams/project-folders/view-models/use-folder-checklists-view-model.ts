"use client";

import { useState } from "react";

import { projectFoldersRepository } from "../data/project-folders-repository";
import {
  attachPatch,
  checklistPatchErrorMessage,
  detachPatch,
} from "../model/project-folder-rules";
import type { FolderChecklist, ProjectFolder } from "../model/project-folder-types";

export type FolderChecklistsStatus = "idle" | "saving" | "error";

export interface FolderChecklistsViewModel {
  status: FolderChecklistsStatus;
  error: string | null;
  /** The checklist whose attach/detach is in flight. */
  pendingId: string | null;
  attach: (checklist: FolderChecklist) => Promise<void>;
  detach: (checklist: FolderChecklist) => Promise<void>;
}

/**
 * Attach or detach a team checklist for one Project.
 *
 * Always the PATCH add/remove with exactly this Project's repository projects:
 * the PUT full replace would un-share the checklist from every project outside
 * this folder.
 */
export function useFolderChecklistsViewModel(options: {
  folder: ProjectFolder;
  onSaved: (checklist: FolderChecklist) => void;
}): FolderChecklistsViewModel {
  const { folder, onSaved } = options;
  const [status, setStatus] = useState<FolderChecklistsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function send(checklist: FolderChecklist, change: { add?: string[]; remove?: string[] }) {
    if (status === "saving") return;
    setStatus("saving");
    setPendingId(checklist.id);
    setError(null);
    try {
      const saved = await projectFoldersRepository.updateChecklistShares(checklist.id, change);
      if (saved) onSaved(saved);
      setStatus("idle");
    } catch (cause) {
      setStatus("error");
      setError(checklistPatchErrorMessage(cause));
    } finally {
      setPendingId(null);
    }
  }

  return {
    status,
    error,
    pendingId,
    attach: (checklist) => send(checklist, attachPatch(folder)),
    detach: (checklist) => send(checklist, detachPatch(folder)),
  };
}
