"use client";

import { useState } from "react";

import { projectFoldersRepository } from "../data/project-folders-repository";
import { isConflict, moveErrorMessage } from "../model/project-folder-rules";
import type { FolderRepository, ProjectFolder } from "../model/project-folder-types";

/** "saving" while the move is in flight, "archiving" while an emptied Project is archived. */
export type MoveRepositoryStatus = "idle" | "saving" | "archiving" | "error";

/** What the explorer tells the lead once a move lands. */
export interface MoveNotice {
  text: string;
  /** Set when the move left its old Project with no repositories. */
  emptied: { deliveryProjectId: string; name: string } | null;
}

export interface MoveRepositoryViewModel {
  status: MoveRepositoryStatus;
  error: string | null;
  /** The repository whose Move dialog is open, or null. */
  repository: FolderRepository | null;
  source: ProjectFolder | null;
  targetId: string;
  notice: MoveNotice | null;
  openFor: (repository: FolderRepository, source: ProjectFolder) => void;
  close: () => void;
  setTargetId: (deliveryProjectId: string) => void;
  submit: (targets: ReadonlyArray<ProjectFolder>) => Promise<void>;
  archiveEmptied: () => Promise<void>;
  dismissNotice: () => void;
}

function movedText(repository: FolderRepository, target: ProjectFolder | undefined): string {
  return `Moved ${repository.name} to ${target?.name ?? "the other Project"}.`;
}

/**
 * ViewModel for "Move to another Project".
 *
 * A 409 means someone else moved the repository first: the dialog says so and
 * the explorer refetches, so the lead sees where it actually is now.
 */
export function useMoveRepositoryViewModel(options: {
  /** Refetch the explorer: after a move, a conflict, or an archive. */
  onChanged: () => void;
}): MoveRepositoryViewModel {
  const { onChanged } = options;
  const [repository, setRepository] = useState<FolderRepository | null>(null);
  const [source, setSource] = useState<ProjectFolder | null>(null);
  const [targetId, setTargetId] = useState("");
  const [status, setStatus] = useState<MoveRepositoryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<MoveNotice | null>(null);

  async function submit(targets: ReadonlyArray<ProjectFolder>) {
    if (!repository || !source || !targetId || status === "saving") return;
    setStatus("saving");
    setError(null);
    try {
      const outcome = await projectFoldersRepository.moveRepository(repository.repositoryId, targetId);
      const target = targets.find((folder) => folder.deliveryProjectId === targetId);
      setNotice({
        text: movedText(repository, target),
        emptied: outcome.sourceDeliveryProjectEmpty
          ? { deliveryProjectId: outcome.sourceDeliveryProjectId ?? source.deliveryProjectId, name: source.name }
          : null,
      });
      setStatus("idle");
      setRepository(null);
      onChanged();
    } catch (cause) {
      setStatus("error");
      setError(moveErrorMessage(cause));
      if (isConflict(cause)) onChanged();
    }
  }

  async function archiveEmptied() {
    const emptied = notice?.emptied;
    if (!emptied || status === "archiving") return;
    setStatus("archiving");
    try {
      await projectFoldersRepository.archive(emptied.deliveryProjectId);
      setNotice({ text: `Archived ${emptied.name}.`, emptied: null });
      setStatus("idle");
      onChanged();
    } catch {
      setStatus("error");
      setNotice({ text: `${emptied.name} could not be archived. Try again in a moment.`, emptied });
    }
  }

  return {
    status,
    error,
    repository,
    source,
    targetId,
    notice,
    openFor: (next, from) => {
      setRepository(next);
      setSource(from);
      setTargetId("");
      setError(null);
      setStatus("idle");
    },
    close: () => {
      if (status !== "saving") setRepository(null);
    },
    setTargetId,
    submit,
    archiveEmptied,
    dismissNotice: () => setNotice(null),
  };
}
