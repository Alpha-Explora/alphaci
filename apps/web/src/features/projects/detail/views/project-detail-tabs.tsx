"use client";

import "./project-repo-switch.css";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { qaScopeFromFolder, withProjectOnPage, type QaScope } from "@/features/checklists";

import { projectStatusVariant } from "../../model/projects-rules";
import type { ProvisionedProject } from "@/features/projects";
import type { AppRole } from "@/shared/api/contracts";
import { cloneValue } from "../model/clone-rules";
import { isStudioTab, seesProjectAsProduct, type ProjectDetailTab } from "../model/project-detail-tab-rules";
import type { ProjectFolderViewModel } from "../view-models/use-project-folder-view-model";
import { useProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";
import { CloneCard } from "./clone-card";
import { ProjectRepoSwitch } from "./project-repo-switch";
import { projectDetailTabGroups } from "./project-detail-tab-config";
import { ProjectDetailTopTabs } from "./project-detail-top-tabs";
import { OverviewTab } from "./overview-tab";
import { PipelineTab } from "./pipeline-tab";
import { HostingTab } from "./hosting-tab";
import { AuditTab } from "./audit-tab";
import { SettingsTab } from "./settings-tab";
import { CodeTabPanel } from "./code-tab-panel";
import { CommitsTabPanel } from "./commits-tab-panel";
import { PullsTabPanel } from "./pulls-tab-panel";
import { ChecklistsTabPanel } from "./checklists-tab-panel";
import { QaStudioTabPanel } from "./qa-studio-tab-panel";
import { PoStudioTabPanel } from "./po-studio-tab-panel";

export { WorkflowStageList } from "./workflow-stage-list";

/**
 * ProjectDetailTabs — the tabbed project detail (Overview / Code / Pipeline /
 * Hosting / Audit / Settings and the rest), extracted from the old split-pane
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
  /** QA / PO Studio: the element in the tab row their preview controls render into. */
  studioToolbarSlot: HTMLElement | null;
}

const TAB_PANELS: Record<
  ProjectDetailTab,
  (props: ProjectDetailTabPanelProps) => ReactNode
> = {
  overview: OverviewTab,
  code: CodeTabPanel,
  commits: CommitsTabPanel,
  pulls: PullsTabPanel,
  checklists: ChecklistsTabPanel,
  pipeline: PipelineTab,
  hosting: HostingTab,
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
  // Five tabs fit beside the title; a Developer's nine and an admin's eleven
  // keep the scrolling strip of their own. Every role's Checklists tab carries
  // the Project's QA, so nothing on the page links away to the Projects page.
  const productView = seesProjectAsProduct(appRole);
  const folderScope = qaScopeFromFolder(folder?.status ?? "idle", folder?.project ?? null);
  const qaScope = withProjectOnPage(folderScope);
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
  // QA / PO Studio's preview controls: an empty slot the studio portals its
  // toolbar into. The QA Team and Product owners have it at the left of their
  // tab row (their five tabs leave the room); an admin's row is full (eleven
  // tabs and the repository switch), so the controls get the line under it.
  const [studioSlot, setStudioSlot] = useState<HTMLDivElement | null>(null);
  const studioControls = studioControlsSlot(vm.tab, setStudioSlot);
  const headerTabs = productView ? <TitleRowTabs controls={studioControls} tabs={tabs} /> : undefined;
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
        tabs={headerTabs}
        clone={clone}
      />
      <div
        className="project-sections"
        data-tour={productView ? undefined : "project-detail-tabs"}
      >
        {productView ? null : (
          <>
            {tabs}
            {studioControls}
          </>
        )}
        <div className="project-sections__body">
          <OverviewLoadBanner status={vm.status} />
          <OverviewErrorBanner message={vm.error} />
          <motion.div
            key={vm.tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <TabPanel
              project={project}
              vm={vm}
              dangerZone={dangerZone}
              qaScope={qaScope}
              studioToolbarSlot={studioSlot}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * Where QA Studio and PO Studio draw their preview controls: an empty element
 * the studio portals its toolbar into (see QaStudioPanel). No other tab has one.
 */
function studioControlsSlot(tab: ProjectDetailTab, ref: (element: HTMLDivElement | null) => void): ReactNode {
  if (!isStudioTab(tab)) return null;
  return <div className="project-studio-controls" ref={ref} />;
}

/**
 * The QA Team's and Product owners' tab row in the title row: the studio's
 * controls (on its tabs) at the left, the tabs at the right. Controls first,
 * so keyboard order follows the one-line row; when the two do not fit, CSS
 * keeps the tabs on the first line and wraps the controls under them.
 */
function TitleRowTabs({ controls, tabs }: Readonly<{ controls: ReactNode; tabs: ReactNode }>) {
  return (
    <div className="project-tabs-bar">
      {controls}
      <div className="project-tabs-bar__tabs" data-tour="project-detail-tabs">
        {tabs}
      </div>
    </div>
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
  tabs,
  clone,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  folder: ProjectFolderViewModel | undefined;
  vm: ProjectDetailTabsViewModel;
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
      projectName={folder.projectName}
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
 * to its sibling repositories ends the tab row (see ProjectDetailTabs). The QA
 * Team and Product owners get no switch (they judge the Project as one
 * product); their sections take its place. No role gets a "Manage project"
 * link: the Checklists tab carries the Project's QA, and repositories are added
 * from the Projects page. The identity and Clone show on Overview only.
 */
function ProjectFolderHeader({
  project,
  external,
  projectName,
  tabs,
  clone,
  identityShown,
}: Readonly<{
  project: ProvisionedProject;
  external: boolean;
  projectName: string;
  tabs?: ReactNode;
  clone?: ReactNode;
  identityShown: boolean;
}>) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={headerClassName("project-detail-header project-folder-header", tabs, identityShown)}
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {tabs ? <div className="project-folder-header__aside">{tabs}</div> : null}
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
