"use client";

import { useEffect, useRef, useState } from "react";

import { projectsRepository } from "../../data/projects-repository";
import type {
  ProjectPreviewsResponse,
  ProjectStatus,
} from "../../model/projects-types";

export interface BranchPreviewsViewModel {
  previews: ProjectPreviewsResponse | null;
  status: ProjectStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  reload: () => void;
}

/**
 * ViewModel for the per-branch preview list.
 *
 * Read-only, so it carries no handler-owned loading flag — the single `status`
 * covers the whole surface.
 */
export function useBranchPreviewsViewModel(options: {
  projectId: string;
  /** False while the session is unknown, or when the feature is switched off. */
  enabled: boolean;
}): BranchPreviewsViewModel {
  const { projectId, enabled } = options;

  const [previews, setPreviews] = useState<ProjectPreviewsResponse | null>(
    null,
  );
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // A counter rather than a bare `active` flag: reloading twice in quick
  // succession must not let the slower first response overwrite the newer one.
  const req = useRef(0);

  useEffect(() => {
    if (!enabled || !projectId) return;

    req.current += 1;
    const id = req.current;
    let active = true;

    projectsRepository
      .previews(projectId)
      .then((response) => {
        if (!active || id !== req.current) return;
        setPreviews(response);
        setError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setError("Could not load branch previews. Please retry.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [projectId, enabled, nonce]);

  return {
    previews,
    status,
    error,
    reload: () => {
      setStatus("loading");
      setNonce((n) => n + 1);
    },
  };
}
