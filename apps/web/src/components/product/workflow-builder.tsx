"use client";

import { useState, useEffect, type KeyboardEvent } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";

import {
  createProject,
  discoverExistingRepo,
  generateWorkflow,
  setupExistingRepoPullRequest,
} from "@/lib/api/client";
import type {
  CatalogTemplate,
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  SetupExistingRepoPrResponse,
} from "@/lib/api/contracts";
import { useCreateProjectForm } from "@/hooks/use-create-project-form";
import { useDeploymentProvisioningForm } from "@/hooks/use-deployment-provisioning-form";
import { useGithubInstallations } from "@/hooks/use-github-installations";
import { useProjectOptionsCatalog } from "@/hooks/use-project-options-catalog";
import { useProvisionedProjects } from "@/hooks/use-provisioned-projects";
import { useWorkflowCatalog } from "@/hooks/use-workflow-catalog";
import { useWorkflowHistory } from "@/hooks/use-workflow-history";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";

import { WorkflowAllTab } from "./workflow-all-tab";
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
  session?: import("@/lib/api/contracts").AuthMeResponse | null;
}

export function WorkflowBuilder({ guest = false }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const [activeTab, setActiveTab] = useState<WorkflowTab>("setup");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isDiscoveringExistingRepo, setIsDiscoveringExistingRepo] = useState(false);
  const [isSettingUpExistingRepo, setIsSettingUpExistingRepo] = useState(false);
  const [createResult, setCreateResult] = useState<CreateProjectResult | null>(null);
  const [existingRepoDiscovery, setExistingRepoDiscovery] =
    useState<DiscoverExistingRepoResponse | null>(null);
  const [existingRepoResult, setExistingRepoResult] =
    useState<SetupExistingRepoPrResponse | null>(null);
  const [setupMode, setSetupMode] = useState<"new" | "existing">("new");
  const [existingRepoFullName, setExistingRepoFullName] = useState("");
  const [existingRepoBaseBranch, setExistingRepoBaseBranch] = useState("main");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const catalog = useWorkflowCatalog();
  const projectCatalog = useProjectOptionsCatalog();
  const history = useWorkflowHistory(setStatusMessage);
  const projects = useProvisionedProjects(setStatusMessage);
  const createForm = useCreateProjectForm();
  const deploymentProvisioning = useDeploymentProvisioningForm();
  const github = useGithubInstallations(setStatusMessage, () => undefined);

  const { startTour } = useOnboardingTour({
    session: session ?? null,
    guest,
    isSetupTabActive: activeTab === "setup",
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

  function handleUseTemplate(template: CatalogTemplate) {
    catalog.setSelectedTemplate(template);
    setActiveTab("setup");
    setStatusMessage(`Ready to create a project with ${template.name}`);
  }

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
      nextTab = WORKFLOW_TABS.at(-1) ?? "all";
    }

    if (!nextTab) return;

    event.preventDefault();
    setActiveTab(nextTab);

    const nextElement = document.getElementById(`workflow-tab-${nextTab}`);
    if (nextElement instanceof HTMLButtonElement) {
      nextElement.focus();
    }
  }

  async function handleCreateProject() {
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
      const response = await createProject(payloadResult.payload);

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
        branchesCreated: ["main", "uat", "test"],
        additionalWorkflowPaths: response.additionalWorkflowPaths,
        secondaryRepoFullName: response.secondaryRepoFullName,
        secondaryRepoUrl: response.secondaryRepoUrl,
        deploymentProvisioning: response.deploymentProvisioning,
      };

      setCreateResult(result);
      projects.prependCreateResult(response, payloadResult.payload);
      void projects.loadProjects(true);
      setActiveTab("current");
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

  async function handleSetupExistingRepoPullRequest() {
    const repoFullName = existingRepoFullName.trim();
    if (!repoFullName) {
      setStatusMessage("Choose a linked repository before opening a setup PR.");
      return;
    }
    if (!projectCatalog.selectedProjectTypeId) {
      setStatusMessage("Choose a project type before opening a setup PR.");
      return;
    }

    const coverage = Number(createForm.coverageThreshold);
    const safeCoverage =
      Number.isFinite(coverage) && coverage >= 0 && coverage <= 100 ? coverage : 80;
    const fallbackServiceName = repoFullName.split("/").at(-1) ?? "service";

    setIsSettingUpExistingRepo(true);
    setStatusMessage(`Creating a workflow branch and PR for ${repoFullName}...`);

    try {
      const response = await setupExistingRepoPullRequest({
        repoFullName,
        baseBranch: existingRepoBaseBranch.trim() || "main",
        projectTypeId: projectCatalog.selectedProjectTypeId,
        workflowRecipeId: projectCatalog.selectedWorkflowRecipeId || "standard",
        serviceName: createForm.serviceName || existingRepoDiscovery?.serviceName || fallbackServiceName,
        servicePath: createForm.servicePath || existingRepoDiscovery?.servicePath || ".",
        nodeVersion: createForm.nodeVersion || "24",
        coverageThreshold: safeCoverage,
        outputFileName: createForm.outputFileName || "ci.yml",
      });

      setExistingRepoResult(response);
      setCreateResult(null);
      setStatusMessage(`Setup PR opened for ${response.repoFullName}: #${response.pullRequestNumber}.`);
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

  async function copyYaml(yaml: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(yaml);
      setStatusMessage("YAML copied to clipboard.");
    } catch {
      setStatusMessage("Clipboard copy failed. Copy the YAML manually from the preview.");
    }
  }

  function downloadYaml(yaml: string, fileName: string) {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(href);
    setStatusMessage(`Downloaded ${fileName}`);
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
          onChange={setActiveTab}
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
              {!github.hasAllRepositoriesInstallation ? (
                <>
                  <span className="gh-app-status-chip gh-app-status-chip--warn">
                    <span className="gh-app-status-dot" aria-hidden="true" />
                    GitHub App not installed
                  </span>
                  {github.installUrl ? (
                    <a
                      href={github.installUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="gh-app-install-link"
                    >
                      Install GitHub App
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="7" y1="17" x2="17" y2="7" />
                        <polyline points="7 7 17 7 17 17" />
                      </svg>
                    </a>
                  ) : null}
                </>
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
              github={github}
              existingRepoBaseBranch={existingRepoBaseBranch}
              existingRepoDiscovery={existingRepoDiscovery}
              existingRepoFullName={existingRepoFullName}
              existingRepoResult={existingRepoResult}
              isCreatingProject={isCreatingProject}
              isDiscoveringExistingRepo={isDiscoveringExistingRepo}
              isSettingUpExistingRepo={isSettingUpExistingRepo}
              setupMode={setupMode}
              deploymentProvisioning={deploymentProvisioning}
              onChangeExistingRepoBaseBranch={setExistingRepoBaseBranch}
              onChangeExistingRepoFullName={setExistingRepoFullName}
              onChangeSetupMode={setSetupMode}
              onCreateProject={guest ? () => { window.location.href = "/signup"; } : handleCreateProject}
              onDiscoverExistingRepo={guest ? () => { window.location.href = "/signup"; } : handleDiscoverExistingRepo}
              onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
              onSetupExistingRepoPullRequest={guest ? () => { window.location.href = "/signup"; } : handleSetupExistingRepoPullRequest}
              projectCatalog={projectCatalog}
              onViewProject={() => setActiveTab("current")}
              reducedMotion={reducedMotion}
              createResult={createResult}
            />
          ) : null}
          {activeTab === "current" ? (
            <WorkflowCurrentTab
              history={history.history}
              latestResult={createResult}
              loadingHistory={history.loadingHistory}
              loadingProjects={projects.loadingProjects}
              onCopyYaml={guest ? () => { window.location.href = "/signup"; } : (yaml) => void copyYaml(yaml)}
              onDownloadYaml={guest ? () => { window.location.href = "/signup"; } : downloadYaml}
              onOpenSetup={() => setActiveTab("setup")}
              projects={projects.projects}
            />
          ) : null}
          {activeTab === "all" ? (
            <WorkflowAllTab allTemplates={catalog.allTemplates} onUseTemplate={handleUseTemplate} />
          ) : null}
        </div>
      </section>
    </MotionConfig>
  );
}
