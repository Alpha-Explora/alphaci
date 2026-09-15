"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import { toOverviewError } from "../../model/projects-rules";
import { apiErrorReason } from "../model/api-error-reason";
import type {
  ProjectOverviewResponse,
  ProjectStatus,
} from "../../model/projects-types";

export interface ProjectDetailViewModel {
  overview: ProjectOverviewResponse | null;
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  reload: () => void;
  /**
   * Org every new repository is provisioned into. Undefined when unknown —
   * its only use is labelling repos outside it, so a failed read just means
   * the badge does not render.
   */
  enforcedOrg: string | undefined;
  /** True while the disconnect request is in flight. */
  isDeleting: boolean;
  deleteError: string | null;
  /** Cleared by the view when the confirmation is dismissed. */
  setDeleteError: (message: string | null) => void;
  confirmDelete: boolean;
  setConfirmDelete: (open: boolean) => void;
  deleteGithubRepoOptIn: boolean;
  setDeleteGithubRepoOptIn: (optIn: boolean) => void;
  confirmRepoNameInput: string;
  setConfirmRepoNameInput: (value: string) => void;
  /** Resolves true when the project is gone and the caller should navigate. */
  disconnect: () => Promise<boolean>;
}

/** ViewModel for one project's detail surface. */
export function useProjectDetailViewModel(options: {
  projectId: string;
  /** Only fetch once the session is known good and the viewer is not a guest. */
  enabled: boolean;
}): ProjectDetailViewModel {
  const { projectId, enabled } = options;

  const [overview, setOverview] = useState<ProjectOverviewResponse | null>(null);
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [enforcedOrg, setEnforcedOrg] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteGithubRepoOptIn, setDeleteGithubRepoOptIn] = useState(false);
  const [confirmRepoNameInput, setConfirmRepoNameInput] = useState("");

  const req = useRef(0);

  useEffect(() => {
    if (!enabled || !projectId) return;

    req.current += 1;
    const id = req.current;
    let active = true;

    projectsRepository
      .overview(projectId)
      .then((response) => {
        if (!active || id !== req.current) return;
        setOverview(response);
        setError(null);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (!active || id !== req.current) return;
        setError(toOverviewError(cause));
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [projectId, enabled, nonce]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    projectsRepository
      .enforcedOrg()
      .then((org) => {
        if (active) setEnforcedOrg(org);
      })
      .catch(() => {
        // Non-critical: the External badge simply will not render.
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  async function disconnect(): Promise<boolean> {
    const project = overview?.project;
    if (!project) return false;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await projectsRepository.disconnect(
        project.id,
        deleteGithubRepoOptIn,
        project.repoFullName,
      );
      // Stays true: the project is gone and the caller is navigating away.
      return true;
    } catch (error) {
      /*
       * The server's reason, not a stand-in for it.
       *
       * When GitHub refuses to delete the repository the backend keeps the
       * project and answers 409 with why: the organisation restricts OAuth
       * apps, the token lacks delete_repo, the session needs signing in again.
       * This used to replace every one of those with "verify permissions and
       * try again", and before that the refusal arrived inside a success, so
       * two deletions GitHub had refused were reported as done.
       */
      setDeleteError(
        apiErrorReason(
          error,
          "The project could not be deleted. Please try again.",
        ),
      );
      setIsDeleting(false);
      return false;
    }
  }

  return {
    overview,
    status,
    error,
    reload: () => {
      setStatus("loading");
      setNonce((n) => n + 1);
    },
    enforcedOrg,
    isDeleting,
    deleteError,
    setDeleteError,
    confirmDelete,
    setConfirmDelete,
    deleteGithubRepoOptIn,
    setDeleteGithubRepoOptIn,
    confirmRepoNameInput,
    setConfirmRepoNameInput,
    disconnect,
  };
}
