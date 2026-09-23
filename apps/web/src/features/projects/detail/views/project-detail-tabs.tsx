"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { projectStatusVariant } from "../../model/projects-rules";
import type { ProvisionedProject } from "@/features/projects";
import type { ProjectDetailTab } from "../model/project-detail-tab-rules";
import { useProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { PROJECT_DETAIL_TAB_GROUPS } from "./project-detail-tab-config";
import { ProjectDetailTopTabs } from "./project-detail-top-tabs";
import { OverviewTab } from "./overview-tab";
import { WorkflowTab } from "./workflow-tab";
import { RunsTab } from "./runs-tab";
import { HostingTab } from "./hosting-tab";
import { EnvironmentTab } from "./environment-tab";
import { AuditTab } from "./audit-tab";
import { SettingsTab } from "./settings-tab";
import { CodeTabPanel } from "./code-tab-panel";
import { PullsTabPanel } from "./pulls-tab-panel";

export { WorkflowStageList } from "./workflow-stage-list";

/**
 * ProjectDetailTabs — the tabbed project detail (Overview / Workflow / Runs /
 * Hosting / Environment / Audit / Settings), extracted from the old split-pane
 * Current Projects view so the full project page (/projects/[id]) can render
 * it.
 */
interface ProjectDetailTabsProps {
  project: ProvisionedProject;
  /**
   * The delete flow, rendered at the foot of Settings.
   *
   * Passed IN rather than built here because deleting navigates away, and the
   * router push, the confirmation state and the "also delete the GitHub repo"
   * choice all belong to the page that owns the route. This component decides
   * only WHERE it appears — which is Settings, with the rest of the
   * configuration, and nowhere else.
   */
  dangerZone?: ReactNode;
}

interface ProjectDetailTabPanelProps {
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: ReactNode;
}

const TAB_PANELS: Record<
  ProjectDetailTab,
  (props: ProjectDetailTabPanelProps) => ReactNode
> = {
  overview: OverviewTab,
  code: CodeTabPanel,
  pulls: PullsTabPanel,
  runs: RunsTab,
  workflow: WorkflowTab,
  hosting: HostingTab,
  environment: EnvironmentTab,
  audit: AuditTab,
  settings: SettingsTab,
};

export function ProjectDetailTabs({
  project,
  dangerZone,
}: Readonly<ProjectDetailTabsProps>) {
  const vm = useProjectDetailTabsViewModel({
    projectId: project.id,
    workflowFilesFallback: project.workflowFiles,
  });
  const TabPanel = TAB_PANELS[vm.tab];

  return (
    <section className="project-detail-panel" aria-label="Project detail">
      <ProjectDetailHeader project={project} />
      <div className="project-sections" data-tour="project-detail-tabs">
        <ProjectDetailTopTabs
          groups={PROJECT_DETAIL_TAB_GROUPS}
          value={vm.tab}
          onChange={vm.setTab}
          label="Project sections"
          idPrefix="project-detail"
        />
        <div className="project-sections__body">
          <OverviewLoadBanner status={vm.status} />
          <OverviewErrorBanner message={vm.error} />
          <motion.div
            key={vm.tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <TabPanel project={project} vm={vm} dangerZone={dangerZone} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ProjectDetailHeader({
  project,
}: Readonly<{ project: ProvisionedProject }>) {
  return (
    <div className="project-detail-header">
      <div>
        <h3>{project.repoFullName}</h3>
        <p>{project.serviceName}</p>
      </div>
      <span className="project-detail-header-badges">
        <span
          className={`project-status-badge ${projectStatusVariant(project.status)}`}
        >
          {project.status}
        </span>
      </span>
    </div>
  );
}

function OverviewLoadBanner({
  status,
}: Readonly<{ status: ProjectDetailTabsViewModel["status"] }>) {
  if (status !== "loading") return null;
  return <p className="env-empty-state">Loading project overview...</p>;
}

function OverviewErrorBanner({ message }: Readonly<{ message: string | null }>) {
  if (!message) return null;
  return (
    <p className="error-text" style={{ margin: 0 }}>
      {message}
    </p>
  );
}
