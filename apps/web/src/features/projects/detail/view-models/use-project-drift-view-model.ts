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

/**
 * The active health findings of one project, and the two things a person does
 * with them. Only the newest request may write state, so a slow load that
 * started before a check cannot overwrite the check's result.
 */
export function useProjectDriftViewModel(
  projectId: string,
): ProjectDriftViewModel {
  const [response, setResponse] = useState<ProjectDriftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectDriftStatus>("loading");
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setResponse(null);
    setError(null);
    setStatus("loading");
    projectsRepository.drift(projectId).then(
      (next) => {
        if (request !== latest.current) return;
        setResponse(next);
        setStatus("idle");
      },
      (caught: unknown) => {
        if (request !== latest.current) return;
        setError(apiErrorReason(caught, "Unable to load health findings."));
        setStatus("idle");
      },
    );
  }, [projectId]);

  const check = useCallback(async () => {
    const request = ++latest.current;
    setStatus("checking");
    setError(null);
    try {
      const next = await projectsRepository.runDrift(projectId);
      if (request === latest.current) setResponse(next);
    } catch (caught) {
      if (request === latest.current) {
        setError(apiErrorReason(caught, "Unable to run the health checks."));
      }
    } finally {
      if (request === latest.current) setStatus("idle");
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

  return { response, error, status, check, repair };
}
