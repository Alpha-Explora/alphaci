"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AppRole } from "@/shared/api/contracts";
import { getApiBaseUrl } from "@/shared/api/request";

import {
  approveProjectVisualChecks,
  getProjectVisualChecks,
} from "../data/project-visual-api";
import {
  isVisualBranch,
  markApproved,
  visualApproveError,
  visualReadOnlyReason,
  withImageUrls,
  type VisualApproveError,
  type VisualReadOnlyReason,
} from "../model/visual-check-rules";
import type { VisualChecksResponse } from "../model/visual-check-types";

/** `idle` until the Verify stage is first opened: nothing has been asked for. */
export type VisualChecksStatus = "idle" | "loading" | "ready" | "error";

export interface VisualChecksViewModel {
  status: VisualChecksStatus;
  /** Image URLs already resolved to full API URLs. */
  checks: VisualChecksResponse | null;
  error: string | null;
  /** Why approve buttons are hidden, or null when they show. */
  readOnly: VisualReadOnlyReason | null;
  /** The names an approval is saving right now. */
  approving: readonly string[];
  approveError: VisualApproveError | null;
  approve: (names: readonly string[]) => void;
  /** Swap to the branch's latest run (after VISUAL_RUN_SUPERSEDED). */
  loadLatest: () => void;
  reload: () => void;
}

const READ_ERROR = "The visual checks could not be read.";

/**
 * One commit's visual checks, for its Verify stage on uat or main.
 *
 * Lives on the commit card, not inside the stage, so a result read once
 * survives the stage being closed: the stepper's "Visual: 2 changed" chip
 * reads it without a second request. Read the first time the Verify stage is
 * open (`enabled`) and never polled — screenshots change once per deploy — then
 * again after an approval, which is the only thing that changes them here.
 *
 * A request counter guards every resolution, so a slow first read cannot land
 * on top of the "Load latest run" that replaced it.
 */
export function useVisualChecksViewModel(options: {
  projectId: string;
  branch: string;
  /** The Verify stage's GitHub run; null asks for the branch's latest. */
  runId: number | null;
  enabled: boolean;
  appRole?: AppRole;
}): VisualChecksViewModel {
  const { projectId, branch, runId, enabled, appRole } = options;
  const active = enabled && isVisualBranch(branch);

  const [stored, setStored] = useState<VisualChecksStatus>("idle");
  const [checks, setChecks] = useState<VisualChecksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState(false);
  const [approving, setApproving] = useState<readonly string[]>([]);
  const [approveError, setApproveError] = useState<VisualApproveError | null>(null);
  const [roleForbidden, setRoleForbidden] = useState(false);
  const requested = useRef(false);
  const ticket = useRef(0);

  /*
   * `quiet` is the refetch after an approval: a failure there keeps the list
   * on screen (already marked approved) instead of blanking it to an error.
   */
  const fetchChecks = useCallback(
    (target: number | null, quiet: boolean) => {
      if (!isVisualBranch(branch)) return Promise.resolve();
      const mine = ++ticket.current;
      return getProjectVisualChecks(projectId, branch, target)
        .then((result) => {
          if (mine !== ticket.current) return;
          setChecks(withImageUrls(result, getApiBaseUrl()));
          setError(null);
          setStored("ready");
        })
        .catch(() => {
          if (mine !== ticket.current || quiet) return;
          setError(READ_ERROR);
          setStored("error");
        });
    },
    [projectId, branch],
  );

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    void fetchChecks(runId, false);
  }, [active, runId, fetchChecks]);

  const reload = useCallback(() => {
    setStored("loading");
    void fetchChecks(latest ? null : runId, false);
  }, [fetchChecks, latest, runId]);

  const loadLatest = useCallback(() => {
    setLatest(true);
    setApproveError(null);
    setStored("loading");
    void fetchChecks(null, false);
  }, [fetchChecks]);

  const approve = useCallback(
    (names: readonly string[]) => {
      const target = checks?.runId ?? null;
      if (target === null || names.length === 0 || approving.length > 0 || !isVisualBranch(branch)) return;
      setApproving(names);
      setApproveError(null);
      approveProjectVisualChecks(projectId, { branch, runId: target, names: [...names] })
        .then((result) => {
          setChecks((current) => (current ? markApproved(current, result?.approved ?? names) : current));
          return fetchChecks(target, true);
        })
        .catch((cause: unknown) => {
          const failure = visualApproveError(cause);
          if (failure.kind === "forbidden") setRoleForbidden(true);
          setApproveError(failure);
        })
        .finally(() => setApproving([]));
    },
    [checks, approving, branch, projectId, fetchChecks],
  );

  return {
    status: stored === "idle" && active ? "loading" : stored,
    checks,
    error,
    readOnly: visualReadOnlyReason({ canApprove: checks?.canApprove ?? false, appRole, roleForbidden }),
    approving,
    approveError,
    approve,
    loadLatest,
    reload,
  };
}
