"use client";

import { useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import type { DeploymentLogFocus } from "@/features/projects/deployment-logs";
import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  DeploymentTarget,
  ProjectAuditEventsResponse,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectDriftRepairAction,
  ProjectDriftResponse,
  ProjectOverviewResponse,
  WorkflowFileMetadata,
} from "@/shared/api/contracts";
import {
  applyTargetChange,
  applyTargetCreated,
  applyTargetDetached,
  isAuditQueryEnabled,
  isCiRunsQueryEnabled,
  isDeploymentsQueryEnabled,
  isDriftQueryEnabled,
  isSyncAvailable,
  isWorkflowSettingsQueryEnabled,
  overviewCapabilityFlags,
  overviewTabData,
  type ProjectDetailTab,
} from "../model/project-detail-tab-rules";
import { useLazyProjectQuery } from "./use-lazy-project-query";
import { useProjectWorkflowSettingsViewModel } from "./use-project-workflow-settings-view-model";
import type { ProjectWorkflowSettingsViewModel } from "./use-project-workflow-settings-view-model";

export interface ProjectDetailTabsViewModel {
  tab: ProjectDetailTab;
  setTab: (tab: ProjectDetailTab) => void;
  /**
   * The target whose logs Hosting should open with, set when the Overview's
   * card asks for its full logs. Cleared by choosing a tab by hand.
   */
  logFocus: DeploymentLogFocus | null;
  openTargetLogs: (focus: DeploymentLogFocus) => void;
  status: ProjectStatus;
  error: string | null;
  overview: ProjectOverviewResponse | null;
  workflowFiles: WorkflowFileMetadata[];
  deploymentTargets: DeploymentTarget[];
  envMetadata: ProjectOverviewResponse["environment"]["items"];
  syncSnapshot: ProjectOverviewResponse["syncSnapshot"] | null;
  syncAvailable: boolean;
  syncingProjectId: string | null;
  syncMessage: string | null;
  syncNow: () => Promise<void>;
  handleTargetChanged: (target: DeploymentTarget) => void;
  handleTargetCreated: (target: DeploymentTarget) => void;
  handleTargetDetached: (targetId: string) => void;
  envProvisioningEnabled: boolean;
  previewDeploymentsEnabled: boolean;
  ciRunTrackingEnabled: boolean;
  deploymentHistoryEnabled: boolean;
  driftDetectionEnabled: boolean;
  driftRepairEnabled: boolean;
  projectTargetManagementEnabled: boolean;
  workflowSettingsPreviewEnabled: boolean;
  workflowUpdatePrEnabled: boolean;
  ciRuns: ProjectCiRunsResponse | null;
  ciRunsError: string | null;
  deployments: ProjectDeploymentsResponse | null;
  deploymentsError: string | null;
  drift: ProjectDriftResponse | null;
  driftError: string | null;
  runningDriftCheck: boolean;
  runDriftDetection: () => Promise<void>;
  repairDriftFinding: (
    findingId: string,
    action: ProjectDriftRepairAction,
  ) => Promise<string>;
  audit: ProjectAuditEventsResponse | null;
  auditError: string | null;
  workflow: ProjectWorkflowSettingsViewModel;
}

function loadOverview(projectId: string): Promise<ProjectOverviewResponse> {
  return projectsRepository.overview(projectId);
}

function loadCiRuns(projectId: string): Promise<ProjectCiRunsResponse> {
  return projectsRepository.ciRuns(projectId);
}

function loadDeployments(
  projectId: string,
): Promise<ProjectDeploymentsResponse> {
  return projectsRepository.deployments(projectId);
}

function loadDrift(projectId: string): Promise<ProjectDriftResponse> {
  return projectsRepository.drift(projectId);
}

function loadAudit(projectId: string): Promise<ProjectAuditEventsResponse> {
  return projectsRepository.audit(projectId);
}

/** ViewModel for the project detail tab set. */
export function useProjectDetailTabsViewModel(options: {
  projectId: string;
  workflowFilesFallback: WorkflowFileMetadata[] | null | undefined;
}): ProjectDetailTabsViewModel {
  const { projectId, workflowFilesFallback } = options;
  const [tab, setTabState] = useState<ProjectDetailTab>("overview");
  const [logFocus, setLogFocus] = useState<DeploymentLogFocus | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [runningDriftCheck, setRunningDriftCheck] = useState(false);

  const caps = useCapabilities();
  const overviewQuery = useLazyProjectQuery<ProjectOverviewResponse>({
    projectId,
    enabled: Boolean(projectId),
    load: loadOverview,
    errorMessage: "Unable to load project overview.",
  });
  const overview = overviewQuery.data;
  const overviewCaps = overviewCapabilityFlags(overview);
  const tabData = overviewTabData(overview, workflowFilesFallback);

  const workflow = useProjectWorkflowSettingsViewModel({
    projectId,
    enabled: isWorkflowSettingsQueryEnabled({
      tab,
      workflowSettingsPreviewEnabled: caps.workflowSettingsPreviewEnabled,
      overviewWorkflowSettings: overviewCaps.workflowSettings,
    }),
  });
  const ciRunsQuery = useLazyProjectQuery<ProjectCiRunsResponse>({
    projectId,
    enabled: isCiRunsQueryEnabled({
      tab,
      ciRunTrackingEnabled: caps.ciRunTrackingEnabled,
      overviewCiRunTracking: overviewCaps.ciRunTracking,
    }),
    load: loadCiRuns,
    errorMessage: "Unable to load CI runs.",
  });
  const deploymentsQuery = useLazyProjectQuery<ProjectDeploymentsResponse>({
    projectId,
    enabled: isDeploymentsQueryEnabled({
      tab,
      deploymentHistoryEnabled: caps.deploymentHistoryEnabled,
      overviewDeploymentHistory: overviewCaps.deploymentHistory,
    }),
    load: loadDeployments,
    errorMessage: "Unable to load deployment history.",
  });
  const driftQuery = useLazyProjectQuery<ProjectDriftResponse>({
    projectId,
    enabled: isDriftQueryEnabled({
      tab,
      driftDetectionEnabled: caps.driftDetectionEnabled,
      overviewDriftDetection: overviewCaps.driftDetection,
    }),
    load: loadDrift,
    errorMessage: "Unable to load drift findings.",
  });
  const auditQuery = useLazyProjectQuery<ProjectAuditEventsResponse>({
    projectId,
    enabled: isAuditQueryEnabled(tab),
    load: loadAudit,
    errorMessage: "Unable to load audit events.",
  });

  const { workflowFiles, deploymentTargets, envMetadata, syncSnapshot } = tabData;
  const syncAvailable = isSyncAvailable({
    projectSyncSnapshotsEnabled: caps.projectSyncSnapshotsEnabled,
    overviewSyncSnapshots: overviewCaps.syncSnapshots,
    snapshotEnabled: tabData.snapshotEnabled,
  });

  function setTab(next: ProjectDetailTab) {
    setLogFocus(null);
    setTabState(next);
  }

  function openTargetLogs(focus: DeploymentLogFocus) {
    setLogFocus(focus);
    setTabState("hosting");
  }

  function handleTargetChanged(target: DeploymentTarget) {
    overviewQuery.setData((current) =>
      applyTargetChange(current, projectId, target),
    );
  }

  function handleTargetCreated(target: DeploymentTarget) {
    overviewQuery.setData((current) =>
      applyTargetCreated(current, projectId, target),
    );
  }

  function handleTargetDetached(targetId: string) {
    overviewQuery.setData((current) =>
      applyTargetDetached(current, projectId, targetId),
    );
  }

  async function syncNow() {
    if (!syncAvailable) return;
    setSyncingProjectId(projectId);
    setSyncMessage(null);
    try {
      const result = await projectsRepository.syncSnapshot(projectId);
      overviewQuery.replace(result.overview);
    } catch {
      setSyncMessage("Unable to create local snapshot right now.");
    } finally {
      setSyncingProjectId(null);
    }
  }

  async function runDriftDetection() {
    setRunningDriftCheck(true);
    driftQuery.clearError();
    try {
      const response = await projectsRepository.runDrift(projectId);
      driftQuery.replace(response);
    } catch {
      driftQuery.fail("Unable to run drift detection.");
    } finally {
      setRunningDriftCheck(false);
    }
  }

  async function repairDriftFinding(
    findingId: string,
    action: ProjectDriftRepairAction,
  ): Promise<string> {
    const response = await projectsRepository.repairDrift(
      projectId,
      findingId,
      action,
    );
    return response.message;
  }

  return {
    tab,
    setTab,
    logFocus,
    openTargetLogs,
    status: overviewQuery.status,
    error: overviewQuery.error,
    overview,
    workflowFiles,
    deploymentTargets,
    envMetadata,
    syncSnapshot,
    syncAvailable,
    syncingProjectId,
    syncMessage,
    syncNow,
    handleTargetChanged,
    handleTargetCreated,
    handleTargetDetached,
    envProvisioningEnabled: caps.envProvisioningEnabled,
    previewDeploymentsEnabled: caps.previewDeploymentsEnabled,
    ciRunTrackingEnabled: caps.ciRunTrackingEnabled,
    deploymentHistoryEnabled: caps.deploymentHistoryEnabled,
    driftDetectionEnabled: caps.driftDetectionEnabled,
    driftRepairEnabled: caps.driftRepairEnabled,
    projectTargetManagementEnabled: caps.projectTargetManagementEnabled,
    workflowSettingsPreviewEnabled: caps.workflowSettingsPreviewEnabled,
    workflowUpdatePrEnabled: caps.workflowUpdatePrEnabled,
    ciRuns: ciRunsQuery.data,
    ciRunsError: ciRunsQuery.error,
    deployments: deploymentsQuery.data,
    deploymentsError: deploymentsQuery.error,
    drift: driftQuery.data,
    driftError: driftQuery.error,
    runningDriftCheck,
    runDriftDetection,
    repairDriftFinding,
    audit: auditQuery.data,
    auditError: auditQuery.error,
    workflow,
  };
}
