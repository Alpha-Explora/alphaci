"use client";

import { useRef, useState } from "react";

import { projectFoldersRepository } from "../data/project-folders-repository";
import {
  deleteConfirmMatches,
  deleteErrorMessage,
  deleteNoticeText,
  deletePartialFailure,
  isDeleteConflict,
} from "../model/project-folder-rules";
import type { ProjectFolder } from "../model/project-folder-types";

export type DeleteProjectStatus = "idle" | "saving" | "error";

export interface DeleteProjectViewModel {
  status: DeleteProjectStatus;
  error: string | null;
  /** The Project whose Delete dialog is open, or null. */
  folder: ProjectFolder | null;
  confirmName: string;
  deleteGithubRepos: boolean;
  deleteProviderResources: boolean;
  deleteSonarProjects: boolean;
  /** The explorer's status banner, set once the delete lands. */
  notice: string | null;
  canSubmit: boolean;
  openFor: (folder: ProjectFolder) => void;
  close: () => void;
  setConfirmName: (value: string) => void;
  setDeleteGithubRepos: (value: boolean) => void;
  setDeleteProviderResources: (value: boolean) => void;
  setDeleteSonarProjects: (value: boolean) => void;
  submit: () => Promise<void>;
  dismissNotice: () => void;
}

/**
 * ViewModel for "Delete Project": deletes a hierarchy delivery project and
 * every repository inside it.
 *
 * A 409 means one repository could not be deleted (a provider call failed,
 * most likely): the Project is kept with whatever it managed to delete, so
 * the dialog stays open showing the server's own message and the explorer
 * refetches, dropping what was actually removed. A request counter guards
 * against a stale response landing after the dialog has moved on.
 */
export function useDeleteProjectViewModel(options: {
  /** Return to the list once the Project is gone. */
  onDeleted: () => void;
  /** Refetch the explorer: after a delete, or a 409 partial failure. */
  onChanged: () => void;
}): DeleteProjectViewModel {
  const { onDeleted, onChanged } = options;
  const [folder, setFolder] = useState<ProjectFolder | null>(null);
  const [status, setStatus] = useState<DeleteProjectStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteGithubRepos, setDeleteGithubRepos] = useState(false);
  const [deleteProviderResources, setDeleteProviderResources] = useState(false);
  const [deleteSonarProjects, setDeleteSonarProjects] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef(0);

  async function submit() {
    if (!folder || status === "saving" || !deleteConfirmMatches(confirmName, folder.name)) return;
    request.current += 1;
    const id = request.current;
    setStatus("saving");
    setError(null);
    try {
      const outcome = await projectFoldersRepository.deleteProject(folder.deliveryProjectId, {
        confirmName,
        deleteGithubRepos,
        deleteProviderResources,
        deleteSonarProjects,
      });
      if (id !== request.current) return;
      setStatus("idle");
      setFolder(null);
      setNotice(deleteNoticeText(outcome));
      onDeleted();
      onChanged();
    } catch (cause) {
      if (id !== request.current) return;
      setStatus("error");
      if (isDeleteConflict(cause)) {
        setError(deletePartialFailure(cause).message);
        onChanged();
      } else {
        setError(deleteErrorMessage(cause));
      }
    }
  }

  return {
    status,
    error,
    folder,
    confirmName,
    deleteGithubRepos,
    deleteProviderResources,
    deleteSonarProjects,
    notice,
    canSubmit: folder !== null && deleteConfirmMatches(confirmName, folder.name),
    openFor: (next) => {
      setFolder(next);
      setConfirmName("");
      setDeleteGithubRepos(false);
      setDeleteProviderResources(false);
      setDeleteSonarProjects(false);
      setError(null);
      setStatus("idle");
    },
    close: () => {
      if (status !== "saving") setFolder(null);
    },
    setConfirmName,
    setDeleteGithubRepos,
    setDeleteProviderResources,
    setDeleteSonarProjects,
    submit,
    dismissNotice: () => setNotice(null),
  };
}
