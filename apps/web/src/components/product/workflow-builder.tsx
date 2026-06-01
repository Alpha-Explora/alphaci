"use client";

import { useState, type KeyboardEvent } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";

import { createProject, generateWorkflow } from "@/lib/api/client";
import type { CatalogTemplate, CreateProjectResponse } from "@/lib/api/contracts";
import { useCreateProjectForm } from "@/hooks/use-create-project-form";
import { useGithubInstallations } from "@/hooks/use-github-installations";
import { useProjectOptionsCatalog } from "@/hooks/use-project-options-catalog";
import { useProvisionedProjects } from "@/hooks/use-provisioned-projects";
import { useWorkflowCatalog } from "@/hooks/use-workflow-catalog";
import { useWorkflowHistory } from "@/hooks/use-workflow-history";

import { WorkflowAllTab } from "./workflow-all-tab";
import {
  formatApiError,
  statusBannerVariant,
  WORKFLOW_TABS,
  type WorkflowTab,
} from "./workflow-builder-utils";
import { WorkflowCurrentTab } from "./workflow-current-tab";
import { WorkflowSetupTab } from "./workflow-setup-tab";
import { WorkflowStudioTabs } from "./workflow-studio-tabs";

interface WorkflowBuilderProps {
  login: string;
  plan: string;
  guest?: boolean;
}

export function WorkflowBuilder({ login, plan, guest = false }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const [activeTab, setActiveTab] = useState<WorkflowTab>("setup");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [createResult, setCreateResult] = useState<CreateProjectResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const catalog = useWorkflowCatalog();
  const projectCatalog = useProjectOptionsCatalog();
  const history = useWorkflowHistory(setStatusMessage);
  const projects = useProvisionedProjects(setStatusMessage);
  const createForm = useCreateProjectForm();
  const github = useGithubInstallations(setStatusMessage, () => undefined);

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

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveTab(nextTab);

    const nextElement = document.getElementById(`workflow-tab-${nextTab}`);
    if (nextElement instanceof HTMLButtonElement) {
      nextElement.focus();
    }
  }

  async function handleCreateProject() {
    const createPayload = createForm.buildPayload({
      hasAllRepositoriesInstallation: github.hasAllRepositoriesInstallation,
      repoShapeId: projectCatalog.selectedRepoShapeId,
      projectTypeId: projectCatalog.selectedProjectTypeId,
      workflowRecipeId: projectCatalog.selectedWorkflowRecipeId,
      tests: projectCatalog.tests,
    });

    if (!createPayload.ok) {
      setStatusMessage(createPayload.message);
      return;
    }

    setIsCreatingProject(true);
    setStatusMessage("Creating GitHub repo, writing CI_TOKEN, and committing the workflow...");

    try {
      const response = await createProject(createPayload.payload);
      setCreateResult(response);
      await Promise.all([projects.loadProjects(true), history.loadHistory(true)]);
      projects.prependCreateResult(response, createPayload.payload);
      setActiveTab("current");
      setStatusMessage(`Project created: ${response.repoFullName}. Push a commit to trigger the CI pipeline.`);
    } catch (error) {
      setStatusMessage(formatApiError(error, "Create Project failed"));
    } finally {
      setIsCreatingProject(false);
    }
  }

  async function handleGenerateWorkflow() {
    const serviceName = createForm.serviceName || createForm.repoName;
    if (!serviceName) {
      setStatusMessage("Enter a service name to generate a workflow.");
      return;
    }

    // Resolve template: prefer explicitly selected, then match by project type stack
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
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }

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
      <section className="workflow-surface">
        <header className="product-topbar">
          <div>
            <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
              <a href="/home">Dashboard</a>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Create Project</span>
            </nav>
            <h1>Create and manage projects</h1>
          </div>
          <div className="topbar-controls">
            <p className="status-pill">@{login}</p>
            <p className="status-pill">Plan: {plan}</p>
            <span
              className={`github-status-dot ${github.hasAllRepositoriesInstallation ? "" : "disconnected"}`}
              title={github.hasAllRepositoriesInstallation
                ? "GitHub App installed — all repositories access confirmed"
                : "GitHub App not installed. You are signed in via GitHub OAuth, but the GitHub App must be installed separately to create new repositories. Use the panel below to install it."}
            >
              {github.hasAllRepositoriesInstallation ? "GitHub App: connected" : "GitHub App: not installed →"}
            </span>
          </div>
        </header>

        <section className="intro-panel">
          <p>Create a GitHub repo from the catalog, write CI_TOKEN, and commit the managed workflow.</p>
          {statusMessage ? (
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
          ) : null}
          {catalog.catalogError ? (
            <div className="error-inline" role="alert">
              <span className="error-inline-icon" aria-hidden="true">⚠</span>
              <p className="error-inline-msg">{catalog.catalogError}</p>
            </div>
          ) : null}
          {projectCatalog.projectOptionsError ? (
            <div className="error-inline" role="alert">
              <span className="error-inline-icon" aria-hidden="true">⚠</span>
              <p className="error-inline-msg">{projectCatalog.projectOptionsError}</p>
            </div>
          ) : null}
        </section>

        <div>
          <WorkflowStudioTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            onKeyDown={handleTabKeyDown}
          />

          {activeTab === "setup" ? (
            <WorkflowSetupTab
              form={createForm}
              github={github}
              isCreatingProject={isCreatingProject}
              onCreateProject={guest ? () => { window.location.href = "/signup"; } : handleCreateProject}
              onGenerateWorkflow={guest ? () => { window.location.href = "/signup"; } : handleGenerateWorkflow}
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
