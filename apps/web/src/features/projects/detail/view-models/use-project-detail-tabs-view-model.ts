"use client";

import { useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import type { DeploymentLogFocus } from "@/features/projects/deployment-logs";
import { projectsRepository } from "../../data/projects-repository";
import type { ProjectStatus } from "../../model/projects-types";
import type {
  AppRole,
  DeploymentTarget,
  ProjectCiRunsResponse,
  ProjectDeploymentsResponse,
  ProjectOverviewResponse,
  WorkflowFileMetadata,
} from "@/shared/api/contracts";
import {
  applyTargetChange,
  applyTargetCreated,
  applyTargetDetached,
  isCiRunsQueryEnabled,
  isDeploymentsQueryEnabled,
  isWorkflowSettingsQueryEnabled,
  overviewCapabilityFlags,
  overviewTabData,
  pipelineConfigurationAvailable,
  pipelineViewFromHash,
  resolvePipelineView,
  resolveVisibleTab,
  shouldHighlightMyQaItems,
  hostingFocusFromHash,
  tabFromHash,
  commitsBranchFromUrl,
  visibleProjectDetailTabs,
  workflowUpdateAccess,
  type HostingFocus,
  type PipelineView,
  type ProjectDetailTab,
  type WorkflowUpdateAccess,
} from "../model/project-detail-tab-rules";
import { useLazyProjectQuery } from "./use-lazy-project-query";
import type { BrowseCommit } from "../model/code-commit-rules";
import { useProjectAuditViewModel, type ProjectAuditViewModel } from "./use-project-audit-view-model";
import { useProjectWorkflowSettingsViewModel } from "./use-project-workflow-settings-view-model";
import type { ProjectWorkflowSettingsViewModel } from "./use-project-workflow-settings-view-model";

export interface ProjectDetailTabsViewModel {
  tab: ProjectDetailTab;
  setTab: (tab: ProjectDetailTab) => void;
  /** The tabs this viewer gets, in strip order. */
  visibleTabs: ProjectDetailTab[];
  /** The viewer's app role, for the QA surfaces. Rights still come from the server. */
  appRole: AppRole | undefined;
  /** The viewer's GitHub login, for recognising their own branches. */
  viewerLogin: string | undefined;
  /** The QA checklists capability: gates QA Studio and the "Returned by QA" card. */
  qaChecklistsEnabled: boolean;
  /**
   * Set once from `?focus=my-qa-items` at mount: a notification deep-link
   * (spec §8.6) asking the Overview to scroll to and briefly highlight the
   * "My QA items" card.
   */
  highlightMyQaItems: boolean;
  /**
   * The Overview's "Open checklist": the Checklists tab, which embeds the
   * Project's QA workspace in the viewer's own view.
   */
  openMyQaItems: () => void;
  /**
   * The target whose logs Hosting should open with, set when the Overview's
   * card asks for its full logs. Cleared by choosing a tab by hand.
   */
  logFocus: DeploymentLogFocus | null;
  openTargetLogs: (focus: DeploymentLogFocus) => void;
  /**
   * What Hosting should bring into view when it opens: `variables` for an old
   * `#environment` link (Production, with the Variables card focused). Read
   * once from the hash at mount; cleared by choosing a tab by hand or by any
   * other deep link.
   */
  hostingFocus: HostingFocus | null;
  /**
   * The pull request the Pull requests tab should open expanded, set when a
   * commit on the Code tab links to it. Cleared by choosing a tab by hand.
   */
  pullFocus: number | null;
  openPullRequest: (pullRequestNumber: number) => void;
  /**
   * The branch the Commits tab opens on, set by a deep link (`#commits` with
   * `?branch=`, or `openCommits(branch)`); null means the server's default.
   * Cleared by choosing a tab by hand.
   */
  commitsBranch: string | null;
  openCommits: (branch?: string | null) => void;
  /**
   * The commit the Code tab opens on, set by the Commits tab's "Browse
   * files"; null means a branch. Cleared by choosing a tab by hand.
   */
  codeCommit: BrowseCommit | null;
  openCodeAt: (commit: BrowseCommit) => void;
  /**
   * The Pipeline tab's view: Runs (the default) or Configuration (the old
   * Workflow tab). `#workflow` opens Configuration; choosing a tab by hand
   * goes back to Runs. Always Runs where Configuration is not offered.
   */
  pipelineView: PipelineView;
  setPipelineView: (view: PipelineView) => void;
  /** Whether the Pipeline tab offers Configuration; without it there is no toggle. */
  pipelineConfigurationAvailable: boolean;
  /** Opens the Pipeline tab on a view: Runs' "Update the workflow", the studios' links. */
  openPipeline: (view: PipelineView) => void;
  status: ProjectStatus;
  error: string | null;
  overview: ProjectOverviewResponse | null;
  workflowFiles: WorkflowFileMetadata[];
  deploymentTargets: DeploymentTarget[];
  envMetadata: ProjectOverviewResponse["environment"]["items"];
  handleTargetChanged: (target: DeploymentTarget) => void;
  handleTargetCreated: (target: DeploymentTarget) => void;
  handleTargetDetached: (targetId: string) => void;
  envProvisioningEnabled: boolean;
  previewDeploymentsEnabled: boolean;
  ciRunTrackingEnabled: boolean;
  deploymentHistoryEnabled: boolean;
  projectTargetManagementEnabled: boolean;
  workflowSettingsPreviewEnabled: boolean;
  workflowUpdatePrEnabled: boolean;
  /** Whether "Update the workflow" (Browser tests card) may send this viewer to the update pull request. */
  workflowUpdateAccess: WorkflowUpdateAccess;
  ciRuns: ProjectCiRunsResponse | null;
  ciRunsError: string | null;
  deployments: ProjectDeploymentsResponse | null;
  deploymentsError: string | null;
  /** Hosting's Retry: read the deployment history again. */
  reloadDeployments: () => void;
  /** The Audit tab's rows, read the first time the tab opens. */
  audit: ProjectAuditViewModel;
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

/** ViewModel for the project detail tab set. */
export function useProjectDetailTabsViewModel(options: {
  projectId: string;
  workflowFilesFallback: WorkflowFileMetadata[] | null | undefined;
  appRole?: AppRole;
  viewerLogin?: string;
}): ProjectDetailTabsViewModel {
  const { projectId, workflowFilesFallback, appRole, viewerLogin } = options;
  // A deep link (#qa) picks the first tab. Safe to read window here: the tab
  // set only mounts client-side, once the project overview has loaded.
  const [selectedTab, setTabState] = useState<ProjectDetailTab>(
    () => (typeof window === "undefined" ? null : tabFromHash(window.location.hash)) ?? "overview",
  );
  const [highlightMyQaItems] = useState<boolean>(() =>
    typeof window === "undefined" ? false : shouldHighlightMyQaItems(window.location.search),
  );
  const [logFocus, setLogFocus] = useState<DeploymentLogFocus | null>(null);
  const [hostingFocus, setHostingFocus] = useState<HostingFocus | null>(() =>
    typeof window === "undefined" ? null : hostingFocusFromHash(window.location.hash),
  );
  const [pullFocus, setPullFocus] = useState<number | null>(null);
  const [codeCommit, setCodeCommit] = useState<BrowseCommit | null>(null);
  const [commitsBranch, setCommitsBranch] = useState<string | null>(() =>
    typeof window === "undefined" ? null : commitsBranchFromUrl(window.location.hash, window.location.search),
  );
  const [selectedPipelineView, setPipelineView] = useState<PipelineView>(() =>
    typeof window === "undefined" ? "runs" : pipelineViewFromHash(window.location.hash),
  );

  const caps = useCapabilities();
  const visibleTabs = visibleProjectDetailTabs(appRole, {
    qaChecklistsEnabled: caps.qaChecklistsEnabled,
  });
  // Derived, not reset by an effect: if the flag turns off under a selected
  // Checklists tab, the strip falls back to Overview on the same render.
  const tab = resolveVisibleTab(selectedTab, visibleTabs);
  const configurationAvailable = pipelineConfigurationAvailable(visibleTabs);
  const pipelineView = resolvePipelineView(selectedPipelineView, configurationAvailable);
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
      pipelineView,
      workflowSettingsPreviewEnabled: caps.workflowSettingsPreviewEnabled,
      overviewWorkflowSettings: overviewCaps.workflowSettings,
    }),
  });
  const ciRunsQuery = useLazyProjectQuery<ProjectCiRunsResponse>({
    projectId,
    enabled: isCiRunsQueryEnabled({
      tab,
      pipelineView,
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
  const audit = useProjectAuditViewModel({ projectId, enabled: tab === "audit" });

  const { workflowFiles, deploymentTargets, envMetadata } = tabData;

  function setTab(next: ProjectDetailTab) {
    setHostingFocus(null);
    setLogFocus(null);
    setPullFocus(null);
    setCommitsBranch(null);
    setCodeCommit(null);
    setPipelineView("runs");
    setTabState(next);
  }

  function openPipeline(view: PipelineView) {
    setTab("pipeline");
    setPipelineView(view);
  }

  function openMyQaItems() {
    setHostingFocus(null);
    setLogFocus(null);
    setPullFocus(null);
    setTabState("checklists");
  }

  function openTargetLogs(focus: DeploymentLogFocus) {
    setHostingFocus(null);
    setPullFocus(null);
    setLogFocus(focus);
    setTabState("hosting");
  }

  function openCommits(branch?: string | null) {
    setHostingFocus(null);
    setLogFocus(null);
    setPullFocus(null);
    setCommitsBranch(branch ?? null);
    setTabState("commits");
  }

  function openPullRequest(pullRequestNumber: number) {
    setHostingFocus(null);
    setLogFocus(null);
    setPullFocus(pullRequestNumber);
    setTabState("pulls");
  }

  function openCodeAt(commit: BrowseCommit) {
    setHostingFocus(null);
    setLogFocus(null);
    setPullFocus(null);
    setCodeCommit(commit);
    setTabState("code");
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

  return {
    tab,
    setTab,
    visibleTabs,
    appRole,
    viewerLogin,
    qaChecklistsEnabled: caps.qaChecklistsEnabled,
    highlightMyQaItems,
    openMyQaItems,
    logFocus,
    openTargetLogs,
    hostingFocus,
    pullFocus,
    openPullRequest,
    commitsBranch,
    openCommits,
    codeCommit,
    openCodeAt,
    pipelineView,
    setPipelineView,
    pipelineConfigurationAvailable: configurationAvailable,
    openPipeline,
    status: overviewQuery.status,
    error: overviewQuery.error,
    overview,
    workflowFiles,
    deploymentTargets,
    envMetadata,
    handleTargetChanged,
    handleTargetCreated,
    handleTargetDetached,
    envProvisioningEnabled: caps.envProvisioningEnabled,
    previewDeploymentsEnabled: caps.previewDeploymentsEnabled,
    ciRunTrackingEnabled: caps.ciRunTrackingEnabled,
    deploymentHistoryEnabled: caps.deploymentHistoryEnabled,
    projectTargetManagementEnabled: caps.projectTargetManagementEnabled,
    workflowSettingsPreviewEnabled: caps.workflowSettingsPreviewEnabled,
    workflowUpdatePrEnabled: caps.workflowUpdatePrEnabled,
    workflowUpdateAccess: workflowUpdateAccess({
      appRole,
      workflowTabVisible: configurationAvailable,
      updatePrEnabled: caps.workflowUpdatePrEnabled,
      settingsPreviewEnabled: caps.workflowSettingsPreviewEnabled,
      projectWorkflowSettings: overviewCaps.workflowSettings,
    }),
    ciRuns: ciRunsQuery.data,
    ciRunsError: ciRunsQuery.error,
    deployments: deploymentsQuery.data,
    deploymentsError: deploymentsQuery.error,
    reloadDeployments: deploymentsQuery.reload,
    audit,
    workflow,
  };
}
