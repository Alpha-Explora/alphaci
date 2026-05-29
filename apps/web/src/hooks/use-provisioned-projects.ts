"use client";

import { useCallback, useEffect, useState } from "react";

import { getProjects } from "@/lib/api/client";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProvisionedProject,
  SetupProjectRequest,
  SetupProjectResponse,
} from "@/lib/api/contracts";

export function useProvisionedProjects(setStatusMessage: (message: string) => void) {
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingProjects(true);
    }

    try {
      const response = await getProjects(25);
      setProjects(response.items);
    } catch {
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
        repoFullName: response.repoFullName,
        templateId: payload.templateId,
        serviceName: payload.serviceName,
        workflowPath: response.workflowPath,
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
    prependCreateResult,
    prependSetupResult,
    projects,
  };
}

export type ProvisionedProjectsState = ReturnType<typeof useProvisionedProjects>;
