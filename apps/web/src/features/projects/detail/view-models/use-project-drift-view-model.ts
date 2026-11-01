"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ProjectDriftRepairAction,
  ProjectDriftRepairResponse,
  ProjectDriftResponse,
} from "@/shared/api/contracts";
import { projectsRepository } from "../../data/projects-repository";
import { apiErrorReason } from "../model/api-error-reason";

/** `loading` until the stored findings arrive; `checking` while a check or repair runs. */
export type ProjectDriftStatus = "loading" | "idle" | "checking";

export interface ProjectDriftViewModel {
  response: ProjectDriftResponse | null;
  error: string | null;
  status: ProjectDriftStatus;
  /** Run the checks now, replacing the active findings with what they find. */
  check: () => Promise<void>;
  /**
   * Apply one repair, then check again. The response says what happened, and
   * for a workflow fix, which pull request carries it.
   */
  repair: (
    findingId: string,
    action: ProjectDriftRepairAction,
  ) => Promise<ProjectDriftRepairResponse>;
}

/** What one project's findings read as, kept with the project they are for. */
interface DriftState {
  projectId: string;
  response: ProjectDriftResponse | null;
  error: string | null;
  status: Exclude<ProjectDriftStatus, "loading">;
}

/**
 * The active health findings of one project, and the two things a person does
 * with them. Only the newest request may write state, so a slow load that
 * started before a check cannot overwrite the check's result. State is kept
 * with its project, so another project reads as loading on the same render.
 */
export function useProjectDriftViewModel(
  projectId: string,
): ProjectDriftViewModel {
  const [state, setState] = useState<DriftState | null>(null);
  const latest = useRef(0);
  const current = state?.projectId === projectId ? state : null;

  useEffect(() => {
    const request = ++latest.current;
    projectsRepository.drift(projectId).then(
      (next) => {
        if (request !== latest.current) return;
        setState({ projectId, response: next, error: null, status: "idle" });
      },
      (caught: unknown) => {
        if (request !== latest.current) return;
        const error = apiErrorReason(caught, "Unable to load health findings.");
        setState({ projectId, response: null, error, status: "idle" });
      },
    );
  }, [projectId]);

  const check = useCallback(async () => {
    const request = ++latest.current;
    /** The findings on screen for this project; none while it still loads. */
    const shown = (previous: DriftState | null) =>
      previous?.projectId === projectId ? previous.response : null;
    setState((previous) => ({
      projectId,
      response: shown(previous),
      error: null,
      status: "checking",
    }));
    try {
      const next = await projectsRepository.runDrift(projectId);
      if (request !== latest.current) return;
      setState({ projectId, response: next, error: null, status: "idle" });
    } catch (caught) {
      if (request !== latest.current) return;
      const error = apiErrorReason(caught, "Unable to run the health checks.");
      setState((previous) => ({ projectId, response: shown(previous), error, status: "idle" }));
    }
  }, [projectId]);

  const repair = useCallback(
    async (findingId: string, action: ProjectDriftRepairAction) => {
      const outcome = await projectsRepository.repairDrift(
        projectId,
        findingId,
        action,
      );
      await check();
      return outcome;
    },
    [projectId, check],
  );

  return {
    response: current?.response ?? null,
    error: current?.error ?? null,
    status: current?.status ?? "loading",
    check,
    repair,
  };
}
