"use client";

import { useState, useEffect, type KeyboardEvent } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import {
  discoverExistingRepo,
  generateWorkflow,
} from "@/features/workflows";
import { createProject, setupProject } from "@/features/projects";
import type {
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  SetupProjectRequest,
  SetupProjectResponse,
  WorkspaceSummary,
} from "@/shared/api/contracts";
// Feature barrel, never a deep path into the slice.
import { getMyWorkspaces } from "@/features/workspace";
import { useCreateProjectForm } from "../view-models/use-create-project-form";
import { useCapabilities } from "@/features/capabilities/current";
import { useDeploymentProvisioningForm } from "../view-models/use-deployment-provisioning-form";
import { useGithubInstallations } from "../view-models/use-github-installations";
import { useProjectOptionsCatalog } from "../view-models/use-project-options-catalog";
import { useProvisionedProjects } from "../view-models/use-provisioned-projects";
import { useWorkflowCatalog } from "../view-models/use-workflow-catalog";
import { useWorkflowHistory } from "../view-models/use-workflow-history";
import { useOnboardingTour } from "../view-models/use-onboarding-tour";
import { useCurrentProjectsTour } from "../view-models/use-current-projects-tour";


import {
  formatApiError,
  statusBannerVariant,
  WORKFLOW_TABS,
  type WorkflowTab,
} from "./workflow-builder-utils";
import { WorkflowCurrentTab } from "./workflow-current-tab";
import { GeneratingOverlay } from "./generating-overlay";
import { WorkflowSetupTab } from "./workflow-setup-tab";
import { WorkflowStudioTabs } from "./workflow-studio-tabs";

interface WorkflowBuilderProps {
  login: string;
  plan: string;
  guest?: boolean;
  onboardingCompleted?: boolean;
  session?: import("@/shared/api/contracts").AuthMeResponse | null;
}

export function WorkflowBuilder({ guest = false, session, onboardingCompleted }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const reducedMotion = prefersReducedMotion ?? false;

  const requestedTab = searchParams.get("tab");
  // Current Projects is the default landing tab; ?tab=setup deep-links to Create.
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
   * `master` repo was scanned on a branch it does not have.
   */
  const [existingRepoBaseBranch, setExistingRepoBaseBranch] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  /**
   * Teams the caller can create in. Every project belongs to a team, so the
   * Setup tab outside a group context has to name one rather than let the
   * server guess — guessing is what used to drop projects into a personal
   * workspace no teammate could see. `null` means "not loaded yet".
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
  const {
    deploymentOwnershipMode,
    envProvisioningEnabled,
  } = useCapabilities();
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
    const { defaultNodeVersion, nodeVersions } = projectCatalog;
    if (!defaultNodeVersion) return;
    if (!nodeVersions.some((v) => v.value === createForm.nodeVersion)) {
      createForm.setNodeVersion(defaultNodeVersion);
    }
  // Only run when the catalog's version list loads — not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCatalog.defaultNodeVersion]);

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


  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: WorkflowTab) {
    const currentIndex = WORKFLOW_TABS.indexOf(currentTab);
    let nextTab: WorkflowTab | null = null;

    if (event.key === "ArrowRight") {
      nextTab = WORKFLOW_TABS[(currentIndex + 1) % WORKFLOW_TABS.length];
    } else if (event.key === "ArrowLeft") {
      nextTab = WORKFLOW_TABS[(currentIndex - 1 + WORKFLOW_TABS.length) % WORKFLOW_TABS.length];
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
      // Repository ownership is enforced server-side (all repos are created in
      // the configured organization), so the client no longer selects an owner.
    });

    if (!payloadResult.ok) {
      setStatusMessage(payloadResult.message);
      return;
    }

    setIsCreatingProject(true);
    setStatusMessage("Creating GitHub repository, branches, and committing workflow...");

    try {
      const workspaceId = selectedGroupId;
      const requestPayload = {
        ...payloadResult.payload,
        ...(workspaceId ? { workspaceId } : {}),
      };
      const response = await createProject(requestPayload);

      const outputFileName = response.workflowPath.split("/").at(-1) ?? response.workflowPath;

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
        branchesCreated: ["main", "uat", "develop"],
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
      const branchOverride = existingRepoBaseBranch.trim();
      const response = await discoverExistingRepo({
        repoFullName,
        // Omitted, not defaulted: the field is optional so the server can ask
        // the repository which branch it lives on.
        ...(branchOverride ? { baseBranch: branchOverride } : {}),
      });

      setExistingRepoDiscovery(response);
      setCreateResult(null);
      // Show what was actually scanned, so a repo on `master` reads back as
      // `master` rather than leaving the field blank.
      setExistingRepoBaseBranch(response.baseBranch);

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

    const coverage = Number(createForm.coverageThreshold);
    const safeCoverage =
      Number.isFinite(coverage) && coverage >= 0 && coverage <= 100 ? coverage : 80;
    const fallbackServiceName = repoFullName.split("/").at(-1) ?? "service";

    // Mirror the backend's resolveTemplateId formula (existing-repos.service.ts /
    // projects.service.ts): look up the selected recipe's per-project-type
    // template mapping, falling back to the conventional `${projectType}-${recipe}`
    // naming used on disk when no explicit mapping exists.
    const recipeId = projectCatalog.selectedWorkflowRecipeId || "standard";
    const recipe = projectCatalog.recipesForSelectedProject.find((item) => item.id === recipeId);
    const templateId =
      recipe?.templateByProjectType[projectCatalog.selectedProjectTypeId] ??
      `${projectCatalog.selectedProjectTypeId}-${recipeId}`;

    const payload: SetupProjectRequest = {
      templateId,
      repoFullName,
      serviceName: createForm.serviceName || existingRepoDiscovery?.serviceName || fallbackServiceName,
      servicePath: createForm.servicePath || existingRepoDiscovery?.servicePath || ".",
      nodeVersion: createForm.nodeVersion || "24",
      coverageThreshold: safeCoverage,
      outputFileName: createForm.outputFileName || "ci.yml",
      deploymentProvisioning: deploymentProvisioning.payload,
    };

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
    const serviceName = createForm.serviceName || createForm.repoName;
    if (!serviceName) {
      setStatusMessage("Enter a service name to generate a workflow.");
      return;
    }

    const templateId =
      catalog.selectedTemplate?.id ??
      catalog.allTemplates.find((t) => t.stack === projectCatalog.selectedProjectType?.id)?.id ??
      catalog.allTemplates[0]?.id;

    if (!templateId) {
      setStatusMessage("No workflow templates available. Check catalog configuration.");
      return;
    }

    const coverage = Number(createForm.coverageThreshold);
    const safeCoverage =
      Number.isFinite(coverage) && coverage >= 0 && coverage <= 100 ? coverage : 80;

    setIsCreatingProject(true);
    setStatusMessage("Generating workflow YAML...");

    try {
      await generateWorkflow({
        templateId,
        serviceName,
        servicePath: createForm.servicePath || ".",
        nodeVersion: createForm.nodeVersion || "24",
        coverageThreshold: safeCoverage,
      });
      await history.loadHistory(true);
      setActiveTab("current");
      setStatusMessage(
        `Workflow generated for "${serviceName}". Copy or download it from the Generated YAML History section.`,
      );
    } catch (error) {
      setStatusMessage(formatApiError(error, "Workflow generation failed"));
    } finally {
      setIsCreatingProject(false);
    }
  }

  // The top-level Create Project tab creates into a team like every other
  // path — the team is auto-selected when the caller has one and picked when
  // they have several. It used to provision an unowned personal repository.
  function openCreateProject() {
    setActiveTab("setup");
  }

  function handleStudioTabChange(tab: WorkflowTab) {
    setActiveTab(tab);
  }

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <GeneratingOverlay isVisible={isCreatingProject} />
      <section className="workflow-surface">
        {/* Status bar — compact, only shows when needed */}
        {(statusMessage || catalog.catalogError || projectCatalog.projectOptionsError) && (
          <div style={{ padding: "0.5rem var(--layout-gutter) 0" }}>
            {statusMessage && (
              <motion.p
                className={`status-banner ${statusBannerVariant(statusMessage)}`}
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {statusMessage}
              </motion.p>
            )}
            {catalog.catalogError && (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{catalog.catalogError}</p>
              </div>
            )}
            {projectCatalog.projectOptionsError && (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{projectCatalog.projectOptionsError}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab bar — GitHub App status sits right-aligned on the same row */}
        <WorkflowStudioTabs
          activeTab={activeTab}
          onChange={handleStudioTabChange}
          onKeyDown={handleTabKeyDown}
          trailing={
            <>
              {!guest && activeTab === "setup" ? (
                <button
                  type="button"
                  className="gh-app-install-link"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  aria-label="Show guided tour for the Create Project form"
                  onClick={startTour}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">

                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Show guide
                </button>
              ) : null}
              {!guest && activeTab === "current" ? (
                <button
                  type="button"
                  className="gh-app-install-link"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  aria-label="Show guided tour for Current Projects"
                  onClick={startCurrentProjectsTour}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Show guide
                </button>
              ) : null}
            </>
          }
        />

        {/* Tab content — Setup manages its own full-bleed layout; the other
            tabs need the page gutter so cards don't touch the viewport edges */}
        <div style={activeTab === "setup" ? undefined : { padding: "0.5rem var(--layout-gutter) 2.5rem" }}>
          {activeTab === "setup" ? (
            <WorkflowSetupTab
              form={createForm}
              deploymentOwnershipMode={deploymentOwnershipMode}
              deploymentProvisioning={deploymentProvisioning}
              envProvisioningEnabled={envProvisioningEnabled}
              github={github}
              existingRepoBaseBranch={existingRepoBaseBranch}
              existingRepoDiscovery={existingRepoDiscovery}
              existingRepoFullName={existingRepoFullName}
              existingRepoResult={existingRepoResult}
              isCreatingProject={isCreatingProject}
              isDiscoveringExistingRepo={isDiscoveringExistingRepo}
              isSettingUpExistingRepo={isSettingUpExistingRepo}
              setupMode={setupMode}
              onChangeExistingRepoBaseBranch={setExistingRepoBaseBranch}
              onChangeExistingRepoFullName={setExistingRepoFullName}
              onChangeSetupMode={setSetupMode}
              onCreateProject={guest ? () => { window.location.href = "/signup"; } : () => void handleCreateProject(selectedCreateWorkspaceId ?? undefined)}
              onDiscoverExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleDiscoverExistingRepo}
              onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
              onSetupExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleSetupExistingRepo}
              creationScope="choose-team"
              workspaces={workspaces}
              selectedWorkspaceId={selectedCreateWorkspaceId}
              onChangeWorkspace={setSelectedCreateWorkspaceId}
              projectCatalog={projectCatalog}
              onViewProject={() => setActiveTab("current")}
              reducedMotion={reducedMotion}
              createResult={createResult}
            />
          ) : null}
          {activeTab === "current" ? (
            <WorkflowCurrentTab
              latestResult={createResult}
              loadingProjects={projects.loadingProjects}
              onOpenSetup={openCreateProject}
              projects={projects.projects}
              renderGroupCreate={(selectedGroupId, onComplete) => (
                <WorkflowSetupTab
                  form={createForm}
                  deploymentOwnershipMode={deploymentOwnershipMode}
                  deploymentProvisioning={deploymentProvisioning}
                  envProvisioningEnabled={envProvisioningEnabled}
                  github={github}
                  existingRepoBaseBranch={existingRepoBaseBranch}
                  existingRepoDiscovery={existingRepoDiscovery}
                  existingRepoFullName={existingRepoFullName}
                  existingRepoResult={existingRepoResult}
                  isCreatingProject={isCreatingProject}
                  isDiscoveringExistingRepo={isDiscoveringExistingRepo}
                  isSettingUpExistingRepo={isSettingUpExistingRepo}
                  setupMode={setupMode}
                  onChangeExistingRepoBaseBranch={setExistingRepoBaseBranch}
                  onChangeExistingRepoFullName={setExistingRepoFullName}
                  onChangeSetupMode={setSetupMode}
                  onCreateProject={guest ? () => { window.location.href = "/signup"; } : () => void handleCreateProject(selectedGroupId, onComplete)}
                  onDiscoverExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleDiscoverExistingRepo}
                  onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
                  onSetupExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleSetupExistingRepo}
                  projectCatalog={projectCatalog}
                  creationScope="in-team"
                  onViewProject={onComplete}
                  reducedMotion={reducedMotion}
                  createResult={createResult}
                />
              )}
            />
          ) : null}

        </div>
      </section>
    </MotionConfig>
  );
}
