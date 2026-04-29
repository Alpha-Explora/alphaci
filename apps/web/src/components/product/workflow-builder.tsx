"use client";

import { useState, type KeyboardEvent } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";

import { setupProject } from "@/lib/api/client";
import type { CatalogTemplate, SetupProjectResponse } from "@/lib/api/contracts";
import { useGithubInstallations } from "@/hooks/use-github-installations";
import { useProjectSetupForm } from "@/hooks/use-project-setup-form";
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
}

export function WorkflowBuilder({ login, plan }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const [activeTab, setActiveTab] = useState<WorkflowTab>("setup");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupProjectResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const catalog = useWorkflowCatalog();
  const history = useWorkflowHistory(setStatusMessage);
  const projects = useProvisionedProjects(setStatusMessage);
  const setupForm = useProjectSetupForm();
  const github = useGithubInstallations(setStatusMessage, setupForm.applyRepoSelection);

  function handleTemplateSelection(template: CatalogTemplate) {
    catalog.setSelectedTemplate(template);
    setStatusMessage(`Selected template: ${template.name}`);
  }

  function handleUseTemplate(template: CatalogTemplate) {
    catalog.setSelectedTemplate(template);
    setActiveTab("setup");
    setStatusMessage(`Ready to set up ${template.name}`);
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

  async function handleSetupProject() {
    const setupPayload = setupForm.buildPayload(catalog.selectedTemplate, github.selectedRepoFullName);
    if (!setupPayload.ok) {
      setStatusMessage(setupPayload.message);
      return;
    }

    setIsSettingUp(true);
    setStatusMessage("Setting up GitHub repo with CI_TOKEN and workflow file...");

    try {
      const response = await setupProject(setupPayload.payload);
      setSetupResult(response);
      await Promise.all([projects.loadProjects(true), history.loadHistory(true)]);
      projects.prependSetupResult(response, setupPayload.payload);
      setActiveTab("current");
      setStatusMessage(`Setup completed for ${response.repoFullName}. Push to the repo to trigger validate-access.`);
    } catch (error) {
      setStatusMessage(formatApiError(error, "Setup failed"));
    } finally {
      setIsSettingUp(false);
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
            <p className="eyebrow">Workflow Studio</p>
            <h1>Build and manage workflows</h1>
          </div>
          <div className="topbar-controls">
            <p className="status-pill">@{login}</p>
            <p className="status-pill">Plan: {plan}</p>
            <p className="status-pill">Source: workflow-core</p>
          </div>
        </header>

        <section className="intro-panel">
          <p>Use tabs to set up, review generated workflows, and browse templates.</p>
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
            <p className="error-text" role="alert">
              {catalog.catalogError}
            </p>
          ) : null}
        </section>

        <WorkflowStudioTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          onKeyDown={handleTabKeyDown}
        />

        {activeTab === "setup" ? (
          <WorkflowSetupTab
            catalog={catalog}
            form={setupForm}
            github={github}
            isSettingUp={isSettingUp}
            onSetupProject={handleSetupProject}
            onTemplateSelect={handleTemplateSelection}
            onViewProject={() => setActiveTab("current")}
            reducedMotion={reducedMotion}
            setupResult={setupResult}
          />
        ) : null}
        {activeTab === "current" ? (
          <WorkflowCurrentTab
            history={history.history}
            loadingHistory={history.loadingHistory}
            loadingProjects={projects.loadingProjects}
            onCopyYaml={(yaml) => void copyYaml(yaml)}
            onDownloadYaml={downloadYaml}
            onOpenSetup={() => setActiveTab("setup")}
            projects={projects.projects}
          />
        ) : null}
        {activeTab === "all" ? (
          <WorkflowAllTab allTemplates={catalog.allTemplates} onUseTemplate={handleUseTemplate} />
        ) : null}
      </section>
    </MotionConfig>
  );
}
