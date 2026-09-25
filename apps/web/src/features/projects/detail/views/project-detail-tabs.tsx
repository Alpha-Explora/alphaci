"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { projectStatusVariant } from "../../model/projects-rules";
import type { ProvisionedProject } from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import type { ProjectDetailTab } from "../model/project-detail-tab-rules";
import { useProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { projectDetailTabGroups } from "./project-detail-tab-config";
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
import { ChecklistsTabPanel } from "./checklists-tab-panel";
import { QaStudioTabPanel } from "./qa-studio-tab-panel";

export { WorkflowStageList } from "./workflow-stage-list";

/**
 * ProjectDetailTabs — the tabbed project detail (Overview / Workflow / Runs /
 * Hosting / Environment / Audit / Settings), extracted from the old split-pane
 * Current Projects view so the full project page (/projects/[id]) can render
 * it.
 */
interface ProjectDetailTabsProps {
  project: ProvisionedProject;
  /** The repo sits outside the enforced organisation. Decided by the page. */
  external?: boolean;
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
  /** The viewer's app role. Decides, with the capability flag, whether Checklists shows. */
  appRole?: AppRole;
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
  checklists: ChecklistsTabPanel,
  runs: RunsTab,
  workflow: WorkflowTab,
  hosting: HostingTab,
  environment: EnvironmentTab,
  qa: QaStudioTabPanel,
  audit: AuditTab,
  settings: SettingsTab,
};

export function ProjectDetailTabs({
  project,
  external = false,
  dangerZone,
  appRole,
}: Readonly<ProjectDetailTabsProps>) {
  const vm = useProjectDetailTabsViewModel({
    projectId: project.id,
    workflowFilesFallback: project.workflowFiles,
    appRole,
  });
  const TabPanel = TAB_PANELS[vm.tab];

  return (
    <section
      className="project-detail-panel project-detail-panel--page"
      aria-label="Project detail"
    >
      <ProjectDetailHeader project={project} external={external} />
      <div className="project-sections" data-tour="project-detail-tabs">
        <ProjectDetailTopTabs
          groups={projectDetailTabGroups(vm.visibleTabs)}
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

/**
 * The page's identity. It is the route's only heading, so it is the h1 and
 * wears the same title style as the other full pages.
 */
function ProjectDetailHeader({
  project,
  external,
}: Readonly<{ project: ProvisionedProject; external: boolean }>) {
  return (
    <div className="project-detail-header">
      <div>
        <h1 className="workflow-page-title">{project.repoFullName}</h1>
        <p>{project.serviceName}</p>
      </div>
      <span className="project-detail-header-badges">
        <span
          className={`project-status-badge ${projectStatusVariant(project.status)}`}
        >
          {project.status}
        </span>
        {external ? (
          <span className="project-status-badge external">External</span>
        ) : null}
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
