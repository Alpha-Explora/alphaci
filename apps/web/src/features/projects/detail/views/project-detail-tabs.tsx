"use client";

import "./project-repo-switch.css";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { qaScopeFromFolder, withProjectOnPage, type QaScope } from "@/features/checklists";

import { projectStatusVariant } from "../../model/projects-rules";
import type { ProvisionedProject } from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import { cloneValue } from "../model/clone-rules";
import { seesProjectAsProduct, type ProjectDetailTab } from "../model/project-detail-tab-rules";
import type { ProjectFolderViewModel } from "../view-models/use-project-folder-view-model";
import { useProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { CloneCard } from "./clone-card";
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
      trailing={repoSwitchFor(folder, productView, vm)}
    />
  );
  const headerTabs = productView ? <div data-tour="project-detail-tabs">{tabs}</div> : undefined;
  const clone = overviewClone(vm.tab, project);

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
        clone={clone}
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
 * The repository switch, which ends the tab row: it changes which page the
 * tabs belong to, so it sits with them rather than in the header above. Only a
 * named multi-repository Project has one, and the product view never does.
 */
function repoSwitchFor(
  folder: ProjectFolderViewModel | undefined,
  productView: boolean,
  vm: ProjectDetailTabsViewModel,
): ReactNode {
  if (!folder?.projectName || productView) return undefined;
  return (
    <ProjectRepoSwitch
      options={folder.options}
      projectName={folder.projectName}
      currentTab={vm.tab}
      visibleTabs={vm.visibleTabs}
    />
  );
}

/**
 * Clone, on Overview only and for every role: beside the title, so Production
 * Deployment is the panel's first row. A name that cannot be cloned gets no
 * empty column.
 */
function overviewClone(tab: ProjectDetailTab, project: ProvisionedProject): ReactNode {
  if (tab !== "overview" || !cloneValue("https", project.repoFullName, project.repoUrl)) {
    return undefined;
  }
  return <CloneCard repoFullName={project.repoFullName} repoUrl={project.repoUrl} />;
}

/**
 * The Project header for one repository of a named multi-repository Project,
 * else the repository's own header. The identity (title, repository, status)
 * is Overview's: every other tab shows only the aside, so its own content
 * starts at the top.
 */
function ProjectPageHeader({
  project,
  external,
  folder,
  vm,
  productView,
  tabs,
  clone,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  folder: ProjectFolderViewModel | undefined;
  vm: ProjectDetailTabsViewModel;
  productView: boolean;
  tabs: ReactNode;
  clone: ReactNode;
}>) {
  const identityShown = vm.tab === "overview";
  if (!folder?.projectName) {
    return (
      <ProjectDetailHeader
        project={project}
        external={external}
        tabs={tabs}
        clone={clone}
        identityShown={identityShown}
      />
    );
  }
  return (
    <ProjectFolderHeader
      project={project}
      external={external}
      folder={folder}
      projectName={folder.projectName}
      productView={productView}
      tabs={tabs}
      clone={clone}
      identityShown={identityShown}
    />
  );
}

/**
 * The header's modifiers. `--tabs`: the sections are its nav bar (QA Team,
 * Product owner). `--summary`: Overview, the aside across the top and the
 * identity and Clone side by side under it. `--bare`: another tab, the aside
 * alone.
 */
function headerClassName(base: string, tabs: ReactNode, identityShown: boolean): string {
  return [
    base,
    tabs ? "project-detail-header--tabs" : "",
    identityShown ? "project-detail-header--summary" : "project-detail-header--bare",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Off Overview the title is still the route's h1, for screen readers only. */
function HiddenTitle({ title }: Readonly<{ title: string }>) {
  return <h1 className="project-detail-header__sr-title">{title}</h1>;
}

function HeaderClone({ clone }: Readonly<{ clone: ReactNode }>) {
  if (!clone) return null;
  return <div className="project-detail-header__clone">{clone}</div>;
}

/**
 * The page's identity. It is the route's only heading, so it is the h1 and
 * wears the same title style as the other full pages. With `tabs` (the QA
 * Team's and a Product owner's page) the sections are a nav bar above it; on
 * Overview the Clone box sits at its right.
 */
function ProjectDetailHeader({
  project,
  external,
  tabs,
  clone,
  identityShown,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  tabs?: ReactNode;
  clone?: ReactNode;
  identityShown: boolean;
}>) {
  const title = project.repoFullName;
  // Nothing to show off Overview: no empty row, just the heading.
  if (!identityShown && !tabs) return <HiddenTitle title={title} />;
  return (
    <div className={headerClassName("project-detail-header", tabs, identityShown)}>
      {tabs ? <div className="project-detail-header__aside">{tabs}</div> : null}
      {identityShown ? (
        <div className="project-detail-header__identity">
          <h1 className="workflow-page-title">{title}</h1>
          <p className="project-folder-header__repo">
            <span>{project.serviceName}</span>
            <ProjectStatusBadges project={project} external={external} />
          </p>
        </div>
      ) : (
        <HiddenTitle title={title} />
      )}
      <HeaderClone clone={clone} />
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
 * to its sibling repositories ends the tab row (see ProjectDetailTabs). The QA Team and Product
 * owners get no switch (they judge the Project as one product) and no
 * "Manage project" (their Checklists tab carries the Project's QA); their
 * sections take its place. The identity and Clone show on Overview only.
 */
function ProjectFolderHeader({
  project,
  external,
  folder,
  projectName,
  productView,
  tabs,
  clone,
  identityShown,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  folder: ProjectFolderViewModel;
  projectName: string;
  productView: boolean;
  tabs?: ReactNode;
  clone?: ReactNode;
  identityShown: boolean;
}>) {
  const reduceMotion = useReducedMotion();
  const manage = folder.manageHref && !productView ? folder.manageHref : null;
  return (
    <motion.div
      className={headerClassName("project-detail-header project-folder-header", tabs, identityShown)}
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {manage || tabs ? (
        <div className="project-folder-header__aside">
          {manage ? (
            <Link className="project-folder-header__manage" href={manage}>
              Manage project
              <span aria-hidden="true" className="project-folder-header__manage-arrow">
                &rarr;
              </span>
            </Link>
          ) : null}
          {tabs}
        </div>
      ) : null}
      {identityShown ? (
        <div className="project-folder-header__identity">
          <h1 className="workflow-page-title">{projectName}</h1>
          <p className="project-folder-header__repo">
            <span className="project-folder-header__repo-name">{project.repoFullName}</span>
            <ProjectStatusBadges project={project} external={external} />
          </p>
        </div>
      ) : (
        <HiddenTitle title={projectName} />
      )}
      <HeaderClone clone={clone} />
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
