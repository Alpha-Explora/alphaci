"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { discoverExistingRepo, generateWorkflow } from "@/features/workflows";
import { createProject, setupProject } from "@/features/projects";
import type {
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  SetupProjectResponse,
  WorkspaceSummary,
} from "@/shared/api/contracts";

// Feature barrel, never a deep path into the slice.
import { getMyWorkspaces } from "@/features/workspace";

import { useCapabilities } from "@/features/capabilities/current";
import { useCreateProjectForm } from "./use-create-project-form";
import { useDeploymentProvisioningForm } from "./use-deployment-provisioning-form";
import { useGithubInstallations } from "./use-github-installations";
import { useProjectOptionsCatalog } from "./use-project-options-catalog";
import { useProvisionedProjects } from "./use-provisioned-projects";
import { useWorkflowCatalog } from "./use-workflow-catalog";
import { useWorkflowHistory } from "./use-workflow-history";
import { useOnboardingTour } from "./use-onboarding-tour";
import { useCurrentProjectsTour } from "./use-current-projects-tour";
import {
  formatApiError,
  WORKFLOW_TABS,
  type WorkflowTab,
} from "../model/workflow-studio-rules";
import {
  buildGenerateWorkflowPayload,
  buildSetupExistingRepoPayload,
} from "../model/studio-command-payloads";

/**
 * ViewModel for the Workflow Studio surface.
 *
 * Owns the tab query state, the user-facing status banner message, the
 * create/discover/setup/generate command handlers, and coordination between
 * the composed hooks. Views render this state and delegate events to the
 * commands here; no fetching or orchestration happens in a view.
 */
export function useWorkflowStudioViewModel(options: {
  guest: boolean;
  session: import("@/shared/api/contracts").AuthMeResponse | null | undefined;
  onboardingCompleted?: boolean;
}) {
  const { guest, session, onboardingCompleted } = options;

  const searchParams = useSearchParams();
  // Current Projects is the default landing tab; ?tab=setup deep-links to Create.
  const requestedTab = searchParams.get("tab");
  const initialTab: WorkflowTab = requestedTab === "setup" ? "setup" : "current";
  const [activeTab, setActiveTab] = useState<WorkflowTab>(initialTab);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDiscoveringExistingRepo, setIsDiscoveringExistingRepo] = useState(false);
  const [isSettingUpExistingRepo, setIsSettingUpExistingRepo] = useState(false);
  const [createResult, setCreateResult] = useState<CreateProjectResult | null>(null);
  const [existingRepoDiscovery, setExistingRepoDiscovery] =
    useState<DiscoverExistingRepoResponse | null>(null);
  const [existingRepoResult, setExistingRepoResult] =
    useState<SetupProjectResponse | null>(null);
  const [setupMode, setSetupMode] = useState<"new" | "existing">("new");
  const [existingRepoFullName, setExistingRepoFullName] = useState("");
  /**
   * Empty means "ask the repository". Discovery resolves the repo's own
   * default branch when the caller sends nothing; defaulting this to "main"
   * meant the request always carried a branch, so that lookup never ran and a
   * master repo was scanned on a branch it does not have.
   */
  const [existingRepoBaseBranch, setExistingRepoBaseBranch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  /**
   * Teams the caller can create in. Every project belongs to a team, so the
   * Setup tab outside a group context has to name one rather than let the
   * server guess — guessing is what used to drop projects into a personal
   * workspace no teammate could see. null means "not loaded yet".
   */
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [selectedCreateWorkspaceId, setSelectedCreateWorkspaceId] =
    useState<string | null>(null);

  const catalog = useWorkflowCatalog();
  const projectCatalog = useProjectOptionsCatalog();
  const history = useWorkflowHistory(setStatusMessage);
  const projects = useProvisionedProjects(setStatusMessage);
  const createForm = useCreateProjectForm();
  const deploymentProvisioning = useDeploymentProvisioningForm();
  const { deploymentOwnershipMode, envProvisioningEnabled } = useCapabilities();
  const github = useGithubInstallations(setStatusMessage, () => undefined);

  const { startTour } = useOnboardingTour({
    session: session ?? null,
    guest,
    isSetupTabActive: activeTab === "setup",
    onboardingCompleted,
  });

  const { startTour: startCurrentProjectsTour } = useCurrentProjectsTour({
    session: session ?? null,
    guest,
    isCurrentTabActive: activeTab === "current",
    onboardingCompleted,
  });

  useEffect(() => {
    if (guest) return;
    let active = true;
    void getMyWorkspaces()
      .then((response) => {
        if (!active) return;
        setWorkspaces(response.items);
        // Preselect only when there is nothing to choose. With several teams
        // the pick is the caller's, so the field stays empty and the create
        // button waits for it.
        setSelectedCreateWorkspaceId((current) =>
          current ?? (response.items.length === 1 ? response.items[0].id : null),
        );
      })
      .catch(() => {
        // Leave the list unknown rather than empty. An empty list is a claim
        // that the caller belongs to no team, and the panel says so — which
        // would be a lie told by a transient network failure. Unknown falls
        // back to sending no team and letting the server decide, exactly as
        // before this field existed.
      });
    return () => {
      active = false;
    };
  }, [guest]);

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: WorkflowTab,
  ) {
    const currentIndex = WORKFLOW_TABS.indexOf(currentTab);
    let nextTab: WorkflowTab | null = null;
    if (event.key === "ArrowRight") {
      nextTab = WORKFLOW_TABS[(currentIndex + 1) % WORKFLOW_TABS.length];
    } else if (event.key === "ArrowLeft") {
      nextTab =
        WORKFLOW_TABS[(currentIndex - 1 + WORKFLOW_TABS.length) % WORKFLOW_TABS.length];
    } else if (event.key === "Home") {
      nextTab = WORKFLOW_TABS[0];
    } else if (event.key === "End") {
      nextTab = WORKFLOW_TABS.at(-1) ?? "current";
    }
    if (!nextTab) return;
    event.preventDefault();
    setActiveTab(nextTab);
    const nextElement = document.getElementById(`workflow-tab-${nextTab}`);
    if (nextElement instanceof HTMLButtonElement) {
      nextElement.focus();
    }
  }

  function handleStudioTabChange(tab: WorkflowTab) {
    setActiveTab(tab);
  }

  function openIndividualSetup() {
    setActiveTab("setup");
  }

  async function handleCreateProject(
    selectedGroupId?: string,
    onComplete?: () => void,
  ) {
    if (deploymentProvisioning.renderVariablesMissing) {
      setStatusMessage(
        "Add at least one Render environment variable before creating the repository.",
      );
      return;
    }

    const payloadResult = createForm.buildPayload({
      isMicroservicesShape: projectCatalog.isMicroservicesShape,
      isMultiRepoShape: projectCatalog.isMultiRepoShape,
      repoShapeId: projectCatalog.selectedRepoShapeId,
      projectTypeId: projectCatalog.selectedProjectTypeId,
      workflowRecipeId: projectCatalog.selectedWorkflowRecipeId,
      tests: projectCatalog.tests,
      deploymentProvisioning: deploymentProvisioning.payload,
    });

    if (!payloadResult.ok) {
      setStatusMessage(payloadResult.message);
      return;
    }

    setIsCreatingProject(true);
    setStatusMessage("Creating GitHub repository, branches, and committing workflow...");

    try {
      // Group context (in-team) fixes the owner; the top-level Create tab
      // (choose-team) uses the caller's selection, which the effect preselects
      // when they belong to exactly one team.
      const workspaceId = selectedGroupId ?? selectedCreateWorkspaceId ?? undefined;
      const requestPayload = {
        ...payloadResult.payload,
        ...(workspaceId ? { workspaceId } : {}),
      };
      const response = await createProject(requestPayload);

      const outputFileName =
        response.workflowPath.split("/").at(-1) ?? response.workflowPath;

      const result: CreateProjectResult = {
        id: response.id,
        repoFullName: response.repoFullName,
        repoUrl: response.repoUrl,
        status: response.status,
        workflowPath: response.workflowPath,
        workflowFiles: response.workflowFiles,
        outputFileName,
        githubCommitSha: response.githubCommitSha,
        githubCommitUrl: response.githubCommitUrl,
        projectTypeId: response.projectTypeId,
        workflowRecipeId: response.workflowRecipeId,
        branchesCreated: response.branchesCreated ?? [],
        additionalWorkflowPaths: response.additionalWorkflowPaths,
        secondaryRepoFullName: response.secondaryRepoFullName,
        secondaryRepoUrl: response.secondaryRepoUrl,
        deploymentProvisioning: response.deploymentProvisioning,
      };

      setCreateResult(result);
      projects.prependCreateResult(response, requestPayload);
      void projects.loadProjects(true);
      setActiveTab("current");
      onComplete?.();
      setStatusMessage(
        `Repository "${response.repoFullName}" created. Workflow committed to ${response.workflowPath}.`,
      );
    } catch (error) {
      setStatusMessage(formatApiError(error, "Project creation failed"));
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleDiscoverExistingRepo() {
    const repoFullName = existingRepoFullName.trim();
    if (!repoFullName) {
      setStatusMessage("Choose a linked repository before discovery.");
      return;
    }

    setIsDiscoveringExistingRepo(true);
    setStatusMessage(`Scanning ${repoFullName} for a matching workflow recipe...`);

    try {
      const response = await discoverExistingRepo({
        repoFullName,
        baseBranch: existingRepoBaseBranch.trim() || "main",
      });

      setExistingRepoDiscovery(response);
      setCreateResult(null);

      if (response.detectedProjectTypeId) {
        projectCatalog.setSelectedProjectTypeId(response.detectedProjectTypeId);
      }
      if (response.recommendedWorkflowRecipeId) {
        projectCatalog.setSelectedWorkflowRecipeId(response.recommendedWorkflowRecipeId);
      }
      if (response.serviceName) {
        createForm.setServiceName(response.serviceName);
      }
      if (response.servicePath) {
        createForm.setServicePath(response.servicePath);
      }

      const detected = response.detectedProjectTypeId ?? "manual selection required";
      setStatusMessage(`Discovery complete for ${repoFullName}. Detected: ${detected}.`);
    } catch (error) {
      setStatusMessage(formatApiError(error, "Repository discovery failed"));
    } finally {
      setIsDiscoveringExistingRepo(false);
    }
  }

  async function handleSetupExistingRepo() {
    const repoFullName = existingRepoFullName.trim();
    if (!repoFullName) {
      setStatusMessage("Choose a linked repository before setting up CI/CD.");
      return;
    }
    if (!projectCatalog.selectedProjectTypeId) {
      setStatusMessage("Choose a project type before setting up CI/CD.");
      return;
    }

    const payload = buildSetupExistingRepoPayload({
      repoFullName,
      selectedProjectTypeId: projectCatalog.selectedProjectTypeId,
      selectedWorkflowRecipeId: projectCatalog.selectedWorkflowRecipeId,
      recipesForSelectedProject: projectCatalog.recipesForSelectedProject,
      serviceName: createForm.serviceName,
      discoveredServiceName: existingRepoDiscovery?.serviceName,
      servicePath: createForm.servicePath,
      discoveredServicePath: existingRepoDiscovery?.servicePath,
      nodeVersion: createForm.nodeVersion,
      coverageThreshold: createForm.coverageThreshold,
      outputFileName: createForm.outputFileName,
      deploymentProvisioning: deploymentProvisioning.payload,
    });

    setIsSettingUpExistingRepo(true);
    setStatusMessage(`Committing CI/CD workflow to ${repoFullName}...`);

    try {
      const response = await setupProject(payload);

      setExistingRepoResult(response);
      setCreateResult(null);
      projects.prependSetupResult(response, payload);
      void projects.loadProjects(true);
      setActiveTab("current");
      setStatusMessage(
        `CI/CD added to "${response.repoFullName}". Workflow committed to ${response.workflowPath}.`,
      );
    } catch (error) {
      setStatusMessage(formatApiError(error, "Existing repository setup failed"));
    } finally {
      setIsSettingUpExistingRepo(false);
    }
  }

  async function handleGenerateWorkflow() {
    const payloadResult = buildGenerateWorkflowPayload({
      serviceName: createForm.serviceName,
      repoName: createForm.repoName,
      selectedTemplateId: catalog.selectedTemplate?.id,
      allTemplates: catalog.allTemplates,
      selectedProjectTypeId: projectCatalog.selectedProjectType?.id,
      servicePath: createForm.servicePath,
      nodeVersion: createForm.nodeVersion,
      coverageThreshold: createForm.coverageThreshold,
    });
    if (!payloadResult.ok) {
      setStatusMessage(payloadResult.message);
      return;
    }

    setIsCreatingProject(true);
    setStatusMessage("Generating workflow YAML...");

    try {
      await generateWorkflow(payloadResult.payload);
      await history.loadHistory(true);
      setActiveTab("current");
      setStatusMessage(
        `Workflow generated for "${payloadResult.payload.serviceName}". Copy or download it from the Generated YAML History section.`,
      );
    } catch (error) {
      setStatusMessage(formatApiError(error, "Workflow generation failed"));
    } finally {
      setIsCreatingProject(false);
    }
  }

  return {
    activeTab,
    setActiveTab,
    statusMessage,
    isCreatingProject,
    isDiscoveringExistingRepo,
    isSettingUpExistingRepo,
    createResult,
    existingRepoDiscovery,
    existingRepoResult,
    setupMode,
    setSetupMode,
    existingRepoFullName,
    setExistingRepoFullName,
    existingRepoBaseBranch,
    setExistingRepoBaseBranch,
    workspaces,
    selectedCreateWorkspaceId,
    setSelectedCreateWorkspaceId,
    handleTabKeyDown,
    handleStudioTabChange,
    openIndividualSetup,
    handleCreateProject,
    handleDiscoverExistingRepo,
    handleSetupExistingRepo,
    handleGenerateWorkflow,
    catalog,
    projectCatalog,
    history,
    projects,
    createForm,
    deploymentProvisioning,
    deploymentOwnershipMode,
    envProvisioningEnabled,
    github,
    startTour,
    startCurrentProjectsTour,
  };
}

export type WorkflowStudioViewModel = ReturnType<typeof useWorkflowStudioViewModel>;
