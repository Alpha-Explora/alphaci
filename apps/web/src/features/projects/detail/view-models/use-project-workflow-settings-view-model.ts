"use client";

import { useEffect, useRef, useState } from "react";

import { getCentralWorkflowTags } from "@/features/workflows";
import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  WorkflowSettings,
  WorkflowSettingsPreviewResponse,
  WorkflowUpdatePullRequestResponse,
} from "@/shared/api/contracts";
import { useLazyProjectQuery } from "./use-lazy-project-query";

export interface ProjectWorkflowSettingsViewModel {
  status: ProjectStatus;
  settings: WorkflowSettings | null;
  setSettings: (settings: WorkflowSettings) => void;
  settingsError: string | null;
  preview: WorkflowSettingsPreviewResponse | null;
  previewing: boolean;
  previewNow: () => Promise<void>;
  updatePr: WorkflowUpdatePullRequestResponse | null;
  updatePrError: string | null;
  creatingPr: boolean;
  createPr: () => Promise<void>;
  tags: string[] | null;
  tagsError: string | null;
}

function loadWorkflowSettings(projectId: string): Promise<WorkflowSettings> {
  return projectsRepository.workflowSettings(projectId);
}

export function useProjectWorkflowSettingsViewModel(options: {
  projectId: string;
  enabled: boolean;
}): ProjectWorkflowSettingsViewModel {
  const { projectId, enabled } = options;
  const settingsQuery = useLazyProjectQuery<WorkflowSettings>({
    projectId,
    enabled,
    load: loadWorkflowSettings,
    errorMessage: "Unable to load workflow settings.",
  });

  const [preview, setPreview] =
    useState<WorkflowSettingsPreviewResponse | null>(null);
  const [updatePr, setUpdatePr] =
    useState<WorkflowUpdatePullRequestResponse | null>(null);
  const [updatePrError, setUpdatePrError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creatingPr, setCreatingPr] = useState(false);
  const [tags, setTags] = useState<string[] | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const tagsReq = useRef(0);

  useEffect(() => {
    if (!enabled || tags || tagsError) return;

    tagsReq.current += 1;
    const id = tagsReq.current;
    let active = true;

    getCentralWorkflowTags()
      .then((response) => {
        if (!active || id !== tagsReq.current) return;
        setTags(response.tags);
      })
      .catch(() => {
        if (!active || id !== tagsReq.current) return;
        setTagsError("Unable to load available workflow refs.");
      });

    return () => {
      active = false;
    };
  }, [enabled, tags, tagsError]);

  const previewForProject =
    preview?.settings.projectId === projectId ? preview : null;
  const updatePrForProject =
    updatePr?.projectId === projectId ? updatePr : null;

  async function previewNow() {
    if (!settingsQuery.data) return;
    setPreviewing(true);
    settingsQuery.clearError();
    try {
      const result = await projectsRepository.previewWorkflowSettings(
        projectId,
        settingsQuery.data,
      );
      setPreview(result);
      settingsQuery.replace(result.settings);
      setUpdatePr(null);
      setUpdatePrError(null);
    } catch {
      settingsQuery.fail("Unable to preview workflow settings.");
    } finally {
      setPreviewing(false);
    }
  }

  async function createPr() {
    if (!settingsQuery.data || !previewForProject) return;
    setCreatingPr(true);
    setUpdatePrError(null);
    try {
      const result = await projectsRepository.createWorkflowUpdatePullRequest(
        projectId,
        settingsQuery.data,
      );
      setUpdatePr(result);
    } catch {
      setUpdatePrError("Unable to create workflow update PR.");
    } finally {
      setCreatingPr(false);
    }
  }

  return {
    status: settingsQuery.status,
    settings: settingsQuery.data,
    setSettings: settingsQuery.replace,
    settingsError: settingsQuery.error,
    preview: previewForProject,
    previewing,
    previewNow,
    updatePr: updatePrForProject,
    updatePrError,
    creatingPr,
    createPr,
    tags,
    tagsError,
  };
}
