"use client";

import "./project-repo-switch.css";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { qaScopeFromFolder, withProjectOnPage, type QaScope } from "@/features/checklists";

import { projectStatusVariant } from "../../model/projects-rules";
import type { ProvisionedProject } from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import { seesProjectAsProduct, type ProjectDetailTab } from "../model/project-detail-tab-rules";
import type { ProjectFolderViewModel } from "../view-models/use-project-folder-view-model";
import { useProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { ProjectRepoSwitch } from "./project-repo-switch";
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
import { PoStudioTabPanel } from "./po-studio-tab-panel";

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
  /** The viewer's GitHub login, for the pull request presets. */
  viewerLogin?: string;
  /**
   * The Project this repository sits in. With two or more repositories the
   * header names the Project and offers a switch between them; without it (or
   * with one repository) the header is the repository, as it always was.
   */
  folder?: ProjectFolderViewModel;
}

interface ProjectDetailTabPanelProps {
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: ReactNode;
  /** Where this repository's QA happens: its Project, or the repository itself. */
  qaScope: QaScope;
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
  po: PoStudioTabPanel,
  audit: AuditTab,
  settings: SettingsTab,
};

export function ProjectDetailTabs({
  project,
  external = false,
  dangerZone,
  appRole,
  viewerLogin,
  folder,
}: Readonly<ProjectDetailTabsProps>) {
  const vm = useProjectDetailTabsViewModel({
    projectId: project.id,
    workflowFilesFallback: project.workflowFiles,
    appRole,
    viewerLogin,
  });
  const TabPanel = TAB_PANELS[vm.tab];
  // Five tabs fit beside the title; a Developer's ten and an admin's eleven
  // keep the scrolling strip of their own. Their Checklists tab carries the
  // Project's QA, so nothing on the page links away to the Projects page.
  const productView = seesProjectAsProduct(appRole);
  const folderScope = qaScopeFromFolder(folder?.status ?? "idle", folder?.project ?? null);
  const qaScope = productView ? withProjectOnPage(folderScope) : folderScope;
  const tabs = (
    <ProjectDetailTopTabs
      groups={projectDetailTabGroups(vm.visibleTabs)}
      value={vm.tab}
      onChange={vm.setTab}
      label="Project sections"
      idPrefix="project-detail"
    />
  );
  const headerTabs = productView ? <div data-tour="project-detail-tabs">{tabs}</div> : undefined;

  return (
    <section
      className="project-detail-panel project-detail-panel--page"
      aria-label="Project detail"
    >
      <ProjectPageHeader
        project={project}
        external={external}
        folder={folder}
        vm={vm}
        productView={productView}
        tabs={headerTabs}
      />
      <div
        className="project-sections"
        data-tour={productView ? undefined : "project-detail-tabs"}
      >
        {productView ? null : tabs}
        <div className="project-sections__body">
          <OverviewLoadBanner status={vm.status} />
          <OverviewErrorBanner message={vm.error} />
          <motion.div
            key={vm.tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <TabPanel project={project} vm={vm} dangerZone={dangerZone} qaScope={qaScope} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * The Project header for one repository of a named multi-repository Project,
 * else the repository's own header.
 */
function ProjectPageHeader({
  project,
  external,
  folder,
  vm,
  productView,
  tabs,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  folder: ProjectFolderViewModel | undefined;
  vm: ProjectDetailTabsViewModel;
  productView: boolean;
  tabs: ReactNode;
}>) {
  if (!folder?.projectName) {
    return <ProjectDetailHeader project={project} external={external} tabs={tabs} />;
  }
  return (
    <ProjectFolderHeader
      project={project}
      external={external}
      folder={folder}
      projectName={folder.projectName}
      tab={vm.tab}
      visibleTabs={vm.visibleTabs}
      productView={productView}
      tabs={tabs}
    />
  );
}

/**
 * The page's identity. It is the route's only heading, so it is the h1 and
 * wears the same title style as the other full pages. With `tabs` (the QA
 * Team's and a Product owner's page) the sections sit at its right, under the
 * status badges.
 */
function ProjectDetailHeader({
  project,
  external,
  tabs,
}: Readonly<{ project: ProvisionedProject; external: boolean; tabs?: ReactNode }>) {
  const badges = <ProjectStatusBadges project={project} external={external} />;
  return (
    <div className={`project-detail-header${tabs ? " project-detail-header--tabs" : ""}`}>
      <div>
        <h1 className="workflow-page-title">{project.repoFullName}</h1>
        <p>{project.serviceName}</p>
      </div>
      {tabs ? (
        <div className="project-detail-header__aside">
          {badges}
          {tabs}
        </div>
      ) : (
        badges
      )}
    </div>
  );
}

function ProjectStatusBadges({
  project,
  external,
}: Readonly<{ project: ProvisionedProject; external: boolean }>) {
  return (
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
  );
}

/**
 * The header of one repository of a multi-repository Project: the Project is
 * the title, this repository the subtitle (its status badges beside it,
 * because the status is the repository's, not the Project's), and the switch
 * to its sibling repositories sits at the top right. The QA Team and Product
 * owners get no switch (they judge the Project as one product) and no
 * "Manage project" (their Checklists tab carries the Project's QA); their
 * sections take its place.
 */
function ProjectFolderHeader({
  project,
  external,
  folder,
  projectName,
  tab,
  visibleTabs,
  productView,
  tabs,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  folder: ProjectFolderViewModel;
  projectName: string;
  tab: ProjectDetailTab;
  visibleTabs: ReadonlyArray<ProjectDetailTab>;
  productView: boolean;
  tabs?: ReactNode;
}>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={`project-detail-header project-folder-header${tabs ? " project-detail-header--tabs" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="project-folder-header__identity">
        <span className="project-folder-header__eyebrow">Project</span>
        <h1 className="workflow-page-title">{projectName}</h1>
        <p className="project-folder-header__repo">
          <span className="project-folder-header__repo-name">{project.repoFullName}</span>
          <ProjectStatusBadges project={project} external={external} />
        </p>
      </div>
      <div className="project-folder-header__aside">
        {productView ? null : (
          <ProjectRepoSwitch
            options={folder.options}
            projectName={projectName}
            currentTab={tab}
            visibleTabs={visibleTabs}
          />
        )}
        {folder.manageHref && !productView ? (
          <Link className="project-folder-header__manage" href={folder.manageHref}>
            Manage project
            <span aria-hidden="true" className="project-folder-header__manage-arrow">
              &rarr;
            </span>
          </Link>
        ) : null}
        {tabs}
      </div>
    </motion.div>
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
