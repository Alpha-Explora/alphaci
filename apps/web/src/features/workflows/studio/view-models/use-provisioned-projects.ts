"use client";

import { useCallback, useEffect, useState } from "react";

import { getProjects } from "@/features/projects";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProvisionedProject,
  SetupProjectRequest,
  SetupProjectResponse,
} from "@/shared/api/contracts";

export function useProvisionedProjects(setStatusMessage: (message: string) => void) {
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  // The mount effect starts the first read, so the list is loading from the first render.
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  /**
   * Reads the list; a loud read also ends the loading state it was started
   * under. State is only written from the answer, never before the request.
   */
  const readProjects = useCallback(
    (silent: boolean): Promise<void> =>
      // Current Projects is group-centric: it needs every project the user can
      // see so the selected group's count and repository list remain correct.
      // The API enforces group/assignment visibility for this unfiltered query.
      getProjects(100)
        .then(
          (response) => {
            setProjects(response.items);
            setProjectsError(null);
          },
          () => {
            setProjectsError("Provisioned project history is temporarily unavailable.");
            if (!silent) {
              setStatusMessage("Provisioned project history is temporarily unavailable.");
            }
          },
        )
        .finally(() => {
          if (!silent) {
            setLoadingProjects(false);
          }
        }),
    [setStatusMessage],
  );

  useEffect(() => {
    void readProjects(false);
  }, [readProjects]);

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingProjects(true);
    }
    await readProjects(silent);
  }, [readProjects]);

  function prependSetupResult(response: SetupProjectResponse, payload: SetupProjectRequest) {
    setProjects((current) => [
      {
        id: response.id,
        workspaceId: payload.workspaceId,
        repoFullName: response.repoFullName,
        templateId: payload.templateId,
        serviceName: payload.serviceName,
        workflowPath: response.workflowPath,
        workflowFiles: response.workflowFiles,
        status: response.status,
        githubCommitSha: response.githubCommitSha,
        githubCommitUrl: response.githubCommitUrl,
        failureReason: null,
      },
      ...current.filter((project) => project.id !== response.id),
    ]);
  }

  function prependCreateResult(response: CreateProjectResponse, payload: CreateProjectRequest) {
    setProjects((current) => [
      {
        id: response.id,
        workspaceId: payload.workspaceId,
        repoFullName: response.repoFullName,
        repoUrl: response.repoUrl,
        visibility: payload.visibility,
        repoShape: payload.repoShape ?? "single-app",
        projectTypeId: response.projectTypeId,
        workflowRecipeId: response.workflowRecipeId,
        projectOptions: payload.tests ?? {},
        templateId: response.projectTypeId,
        serviceName: payload.serviceName,
        workflowPath: response.workflowPath,
        workflowFiles: response.workflowFiles,
        status: response.status,
        githubCommitSha: response.githubCommitSha,
        githubCommitUrl: response.githubCommitUrl,
        failureReason: null,
      },
      ...current.filter((project) => project.id !== response.id),
    ]);
  }

  return {
    loadProjects,
    loadingProjects,
    /** Uniform status field per the VM contract. */
    status: loadingProjects ? ("loading" as const) : ("ready" as const),
    /** User-safe load error. */
    error: projectsError,
    prependCreateResult,
    prependSetupResult,
    projects,
  };
}

export type ProvisionedProjectsState = ReturnType<typeof useProvisionedProjects>;
