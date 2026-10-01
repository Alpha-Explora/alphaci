"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { repositoryRequiresProject } from "@/features/groups";
import { useCreateProjectForm } from "./use-create-project-form";
import { useDeploymentProvisioningForm } from "./use-deployment-provisioning-form";
import { useGithubInstallations } from "./use-github-installations";
import { useProjectOptionsCatalog } from "./use-project-options-catalog";
import { useProvisionedProjects } from "./use-provisioned-projects";
import { useWorkflowCatalog } from "./use-workflow-catalog";
import { useWorkflowHistory } from "./use-workflow-history";
import { useOnboardingTour } from "./use-onboarding-tour";
import { useCurrentProjectsTour } from "./use-current-projects-tour";
import { useCreateTarget } from "./use-create-target";
import { useTeamProjectOptions } from "./use-team-project-options";
import { roleGateErrorMessage } from "../model/role-gate-rules";
import {
  createRepositoryBlocker,
  preselectedWorkspaceId,
  scopeCreatePayload,
} from "../model/create-target-rules";
import {
  formatApiError,
  searchWithoutTab,
  type WorkflowView,
} from "../model/workflow-studio-rules";
import {
  PROJECT_NAME_TAKEN_MESSAGE,
  isProjectNameTakenError,
  projectNameForRequest,
  validateProjectName,
} from "../model/project-name-rules";
import {
  buildGenerateWorkflowPayload,
  buildSetupExistingRepoPayload,
} from "../model/studio-command-payloads";

/**
 * ViewModel for the Workflow Studio surface.
 *
 * Owns which view is showing (projects or create), the user-facing status banner message, the
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The projects view is the default; ?tab=setup deep-links to the create view.
  // Every "create a project" link in the app (home, the `n` shortcut, /teams,
  // group pages) relies on this, with an optional &group=<id>.
  const initialView: WorkflowView =
    searchParams.get("tab") === "setup" ? "setup" : "current";
  const [activeView, setActiveView] = useState<WorkflowView>(initialView);

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

  const createTarget = useCreateTarget({
    guest,
    workspaces,
    selectedWorkspaceId: selectedCreateWorkspaceId,
    selectWorkspace: setSelectedCreateWorkspaceId,
    openSetup: () => setActiveView("setup"),
  });
  const linkedGroupId = createTarget.initialGroupId;

  // A Developer files every repository in a Project: without a `?project=`
  // link the wizard asks which, from the team's own Projects.
  const requiresProject = !guest && repositoryRequiresProject(session?.appRole);
  const asksForProject = requiresProject && createTarget.linkedProjectName === null;
  const teamProjects = useTeamProjectOptions({
    groupId: selectedCreateWorkspaceId,
    enabled: asksForProject && activeView === "setup",
  });

  const catalog = useWorkflowCatalog();
  const projectCatalog = useProjectOptionsCatalog();
  const history = useWorkflowHistory(setStatusMessage);
  const projects = useProvisionedProjects(setStatusMessage);
  const createForm = useCreateProjectForm();
  const deploymentProvisioning = useDeploymentProvisioningForm(
    projectCatalog.selectedRepoShapeId,
  );
  const { deploymentOwnershipMode, envProvisioningEnabled } = useCapabilities();
  const github = useGithubInstallations(setStatusMessage, () => undefined);

  const { startTour } = useOnboardingTour({
    session: session ?? null,
    guest,
    isSetupTabActive: activeView === "setup",
    onboardingCompleted,
  });

  const { startTour: startCurrentProjectsTour } = useCurrentProjectsTour({
    session: session ?? null,
    guest,
    isCurrentTabActive: activeView === "current",
    onboardingCompleted,
  });

  useEffect(() => {
    if (guest) return;
    let active = true;
    void getMyWorkspaces()
      .then((response) => {
        if (!active) return;
        setWorkspaces(response.items);
        // Preselect the team a ?group= link named (when the caller is in
        // it), else only when there is nothing to choose. With several teams
        // and no link the pick is the caller's, so the field stays empty and
        // the create button waits for it.
        setSelectedCreateWorkspaceId((current) =>
          preselectedWorkspaceId(current, linkedGroupId, response.items),
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
  }, [guest, linkedGroupId]);

  /**
   * Back to the projects view. A ?tab=setup link is dropped from the URL on
   * the way, so a reload lands where the person is rather than on the form.
   */
  function showProjects() {
    setActiveView("current");
    if (searchParams.get("tab") === null) return;
    const search = searchWithoutTab(searchParams.toString());
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function openIndividualSetup() {
    setActiveView("setup");
  }

  async function handleCreateProject(
    selectedGroupId?: string,
    onComplete?: () => void,
  ) {
    // Group context (in-team) fixes the owner; the top-level Create tab
    // (choose-team) uses the caller's selection, which the effect preselects
    // when they belong to exactly one team.
    const workspaceId = selectedGroupId ?? selectedCreateWorkspaceId ?? undefined;
    // A ?project= link files the repository (both, for a pair) in that team
    // Project — only while creating in that Project's own team. The Project
    // then keeps its own name, so no projectName is asked for or sent.
    const deliveryProjectId = createTarget.deliveryProjectIdFor(workspaceId);
    const blocker = createRepositoryBlocker({
      renderVariablesMissing: deploymentProvisioning.renderVariablesMissing,
      requiresProject,
      deliveryProjectId,
    });
    if (blocker) {
      setStatusMessage(blocker);
      return;
    }

    const payloadResult = createForm.buildPayload({
      projectName: projectNameForRequest(createForm.projectName, deliveryProjectId),
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
    createForm.setProjectNameError(null);
    setStatusMessage("Creating GitHub repository, branches, and committing workflow...");

    try {
      const requestPayload = scopeCreatePayload(
        payloadResult.payload,
        workspaceId,
        deliveryProjectId,
      );
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
      showProjects();
      onComplete?.();
      setStatusMessage(
        `Repository "${response.repoFullName}" created. Workflow committed to ${response.workflowPath}.`,
      );
    } catch (error) {
      if (isProjectNameTakenError(error)) {
        // Refused before any repository was created: the wizard shows this on
        // the Project name field and returns to the Repository step.
        createForm.setProjectNameError(PROJECT_NAME_TAKEN_MESSAGE);
        setStatusMessage(PROJECT_NAME_TAKEN_MESSAGE);
      } else {
        setStatusMessage(roleGateErrorMessage(error, "Project creation failed"));
      }
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
      // Blank means "let the backend choose" (dev, else uat). Sending "main"
      // as a default pinned every scan to a branch onboarding must not touch.
      const baseBranch = existingRepoBaseBranch.trim();
      const response = await discoverExistingRepo({
        repoFullName,
        ...(baseBranch ? { baseBranch } : {}),
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
      setStatusMessage(roleGateErrorMessage(error, "Repository discovery failed"));
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

    const projectName = validateProjectName(createForm.projectName);
    if (!projectName.ok) {
      setStatusMessage(projectName.message);
      return;
    }

    const payload = buildSetupExistingRepoPayload({
      projectName: projectName.name,
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
    createForm.setProjectNameError(null);
    setStatusMessage(`Committing CI/CD workflow to ${repoFullName}...`);

    try {
      const response = await setupProject(payload);

      setExistingRepoResult(response);
      setCreateResult(null);
      projects.prependSetupResult(response, payload);
      void projects.loadProjects(true);
      showProjects();
      setStatusMessage(
        `CI/CD added to "${response.repoFullName}". Workflow committed to ${response.workflowPath}.`,
      );
    } catch (error) {
      if (isProjectNameTakenError(error)) {
        createForm.setProjectNameError(PROJECT_NAME_TAKEN_MESSAGE);
        setStatusMessage(PROJECT_NAME_TAKEN_MESSAGE);
      } else {
        setStatusMessage(roleGateErrorMessage(error, "Existing repository setup failed"));
      }
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
      showProjects();
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
    activeView,
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
    targetProjectLabel: createTarget.label,
    joinedProjectName: createTarget.joinedProjectName,
    /**
     * A Developer's Project select (no `?project=` link to fill it), or null
     * when the caller need not choose: an admin, or a linked Project.
     */
    projectChoice: asksForProject
      ? {
          status: teamProjects.status,
          options: teamProjects.options,
          selectedId: createTarget.chosenProjectId ?? "",
          onSelect: (id: string) =>
            createTarget.chooseProject(teamProjects.options.find((option) => option.id === id) ?? null),
          onRetry: teamProjects.retry,
        }
      : null,
    showProjects,
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
