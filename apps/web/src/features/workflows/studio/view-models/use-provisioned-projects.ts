"use client";

/* Preserve the current-projects probe timing during the architecture move. */
/* eslint-disable react-hooks/set-state-in-effect */

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
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingProjects(true);
    }

    try {
      // Current Projects is group-centric: it needs every project the user can
      // see so the selected group's count and repository list remain correct.
      // The API enforces group/assignment visibility for this unfiltered query.
      const response = await getProjects(100);
      setProjects(response.items);
      setProjectsError(null);
    } catch {
      setProjectsError("Provisioned project history is temporarily unavailable.");
      if (!silent) {
        setStatusMessage("Provisioned project history is temporarily unavailable.");
      }
    } finally {
      if (!silent) {
        setLoadingProjects(false);
      }
    }
  }, [setStatusMessage]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

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
