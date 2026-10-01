"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import type { ReactNode } from "react";

import type { CreateProjectResult } from "@/shared/api/contracts";
import { WorkflowStageList } from "@/features/projects/detail";
import { DeploymentProvisioningSummary } from "./setup-result-panel";
import { FlowExplainer } from "@/features/guide/overview";
import {
  ProjectExplorerHost,
  type ProjectExplorerSlot,
} from "@/features/teams/project-folders";
import { useCapabilities } from "@/features/capabilities/current";
import {
  GROUPS_LOAD_ERROR,
  useCurrentProjectsViewModel,
} from "../view-models/use-current-projects-view-model";
import { CreateProjectActions } from "./create-project-menu";
import "./current-projects.css";
import { GuideIcon } from "./studio-icons";

interface HeaderActionsProps {
  /**
   * A guest's "Create project", which sends them to sign up. Everyone else's
   * comes from the explorer: the New Project dialog for a Product owner or
   * admin, nothing for a Developer or QA Team.
   */
  onGuestCreate?: () => void;
  /** Starts the Current Projects tour. Omitted for guests, which hides "Show guide". */
  onStartGuide?: () => void;
}

interface WorkflowCurrentTabProps extends HeaderActionsProps {
  latestResult: CreateProjectResult | null;
  loadingProjects: boolean;
  onOpenSetup: () => void;
  /** Product owner or admin: the no-team state asks for a team, then a Project. */
  canCreateProjects?: boolean;
  guest?: boolean;
}

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 280, damping: 22 },
  },
};

function LatestResultBanner({
  latestResult,
}: Readonly<{ latestResult: CreateProjectResult }>) {
  return (
    <div className="latest-result-banner glass-panel">
      <div className="latest-result-banner__header">
        <span className="latest-result-banner__dot" aria-hidden="true" />
        <p className="eyebrow latest-result-banner__eyebrow">
          Project Created Successfully
        </p>
        <span className="latest-result-banner__sep" aria-hidden="true">
          ·
        </span>
        <span className="latest-result-banner__repo">
          {latestResult.repoFullName}
        </span>
      </div>

      <div className="result-branches latest-result-banner__chips">
        <span className="branch-chip">{latestResult.status}</span>
        <span className="branch-chip">{latestResult.projectTypeId}</span>
        <span className="branch-chip">{latestResult.workflowRecipeId}</span>
        {latestResult.branchesCreated.map((branch) => (
          <span key={branch} className="branch-chip branch-chip--mono">
            {branch}
          </span>
        ))}
      </div>

      <p className="latest-result-banner__meta">
        Workflow file:{" "}
        <strong className="latest-result-banner__filename">
          {latestResult.outputFileName}
        </strong>
        {latestResult.githubCommitUrl ? (
          <a
            href={latestResult.githubCommitUrl}
            target="_blank"
            rel="noreferrer"
            className="latest-result-banner__commit-link"
          >
            commit:{" "}
            <span className="latest-result-banner__sha">
              {latestResult.githubCommitSha.slice(0, 10)}
            </span>
          </a>
        ) : (
          <code className="latest-result-banner__sha-plain">
            {latestResult.githubCommitSha.slice(0, 10)}
          </code>
        )}
      </p>

      <WorkflowStageList files={latestResult.workflowFiles} />
      <DeploymentProvisioningSummary
        result={latestResult.deploymentProvisioning}
      />

      <div className="latest-result-banner__actions">
        <a
          className="latest-result-banner__action-btn latest-result-banner__action-btn--primary"
          href={latestResult.repoUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open Repository
        </a>
        <a
          className="latest-result-banner__action-btn"
          href={`${latestResult.repoUrl}/actions`}
          target="_blank"
          rel="noreferrer"
        >
          Open Actions
        </a>
        <a
          className="latest-result-banner__action-btn"
          href={`${latestResult.repoUrl}/blob/main/${latestResult.workflowPath}`}
          target="_blank"
          rel="noreferrer"
        >
          View Workflow File
        </a>
      </div>

      <p className="latest-result-banner__footer">
        Workflow committed to{" "}
        <code className="file-path-label">{latestResult.workflowPath}</code>{" "}
        on <code className="file-path-label">main</code>. Push to{" "}
        <code className="file-path-label">test</code> to trigger your first
        CI run.
      </p>
    </div>
  );
}

/** The no-team line, by role: who creates the first Project. */
function noTeamLine(canCreateProjects: boolean, guest: boolean): string {
  if (guest) return "Projects live inside a team. Sign up to create one. ";
  return canCreateProjects
    ? "Create a workspace from the picker in the header — a workspace is a team — then create its first Project. "
    : "Projects are created by Product owners. Once one is added to your team it appears here. ";
}

function CurrentTabEmptyState({
  onOpenSetup,
  canCreateProjects,
  guest,
}: Readonly<{ onOpenSetup: () => void; canCreateProjects: boolean; guest: boolean }>) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        background: "rgba(17, 17, 22, 0.3)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        alignItems: "center",
      }}
    >
      <div>
        <p
          style={{
            color: "var(--text-primary)",
            margin: "0 0 0.5rem",
            fontSize: "0.95rem",
            fontWeight: 700,
          }}
        >
          No groups or projects yet.
        </p>
        <p
          style={{
            color: "var(--text-secondary)",
            margin: 0,
            fontSize: "0.85rem",
            maxWidth: "32rem",
          }}
        >
          {noTeamLine(canCreateProjects, guest)}
          ALPHACI provisions the repository and commits a workflow that runs
          through the gated stages below on every change. Open the{" "}
          <Link href="/guide" className="inline-link">
            guide
          </Link>{" "}
          to see how it all fits together.
        </p>
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: "32rem",
          padding: "1rem",
          borderRadius: "var(--radius-card)",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border-soft)",
        }}
      >
        <FlowExplainer variant="compact" />
      </div>
      {guest ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="ghost-button"
            type="button"
            onClick={onOpenSetup}
            style={{
              padding: "0.6rem 1.4rem",
              fontSize: "0.88rem",
              minHeight: "2.5rem",
            }}
          >
            Create a project
          </button>
        </div>
      ) : null}
    </div>
  );
}

const NO_EXPLORER_ACTIONS: ProjectExplorerSlot["actions"] = {
  createEmptyProject: null,
  addRepositoryHref: null,
};

/**
 * The page's heading row. Left: "Projects" (the page's one h1) with the
 * team's Project count. Right: the guide, then the create actions — the
 * primary "Create project" (the New Project dialog: Product owner, admin)
 * and, for an admin, the "⋯" menu's Add repository with no Project chosen.
 * A Developer adds repositories from a Project's card or detail instead.
 *
 * No team dropdown: the team is the one selected in the header, and a second
 * picker here is how the page and the header used to disagree.
 */
function CurrentProjectsHeader({
  count,
  actions,
  explorerActions = NO_EXPLORER_ACTIONS,
}: Readonly<{
  count: number | null;
  actions: HeaderActionsProps;
  explorerActions?: ProjectExplorerSlot["actions"];
}>) {
  const { onGuestCreate, onStartGuide } = actions;
  const create = onGuestCreate ?? explorerActions.createEmptyProject;
  return (
    <div className="project-detail-header current-projects-header">
      <div className="current-projects-heading" data-tour="projects-list">
        <h1 className="workflow-page-title current-projects-title">
          Projects
          {count === null ? null : (
            <span className="group-section-count" aria-label={`${count} ${count === 1 ? "Project" : "Projects"}`}>
              {count}
            </span>
          )}
        </h1>
      </div>
      <div className="current-projects-actions">
        {onStartGuide ? (
          <button
            type="button"
            className="ghost-button"
            aria-label="Show guided tour for Current Projects"
            onClick={onStartGuide}
          >
            <GuideIcon />
            Show guide
          </button>
        ) : null}
        <CreateProjectActions
          onCreateProject={create}
          onCreateEmptyProject={null}
          addRepositoryHref={explorerActions.addRepositoryHref}
        />
      </div>
    </div>
  );
}

function GroupsLoadError({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="error-inline" role="alert">
      <span className="error-inline-icon" aria-hidden="true">⚠</span>
      <p className="error-inline-msg">{GROUPS_LOAD_ERROR}</p>
      <button type="button" className="ghost-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

/**
 * The header team's Projects: the heading (with the count and the create
 * actions the explorer allows) over the Project cards. Keyed by team, so a
 * header switch starts the explorer afresh rather than showing one team's
 * cards under another's count.
 */
function TeamProjects({
  team,
  linkedFolderId,
  opensNewProject,
  actions,
}: Readonly<{
  team: { id: string; name: string };
  linkedFolderId: string | null;
  opensNewProject: boolean;
  actions: HeaderActionsProps;
}>) {
  const { qaChecklistsEnabled } = useCapabilities();
  return (
    <ProjectExplorerHost
      groupId={team.id}
      groupName={team.name}
      qaChecklistsEnabled={qaChecklistsEnabled}
      initialFolderId={linkedFolderId}
      openNewProjectOnArrival={opensNewProject}
    >
      {(explorer): ReactNode => (
        <>
          <CurrentProjectsHeader
            count={explorer.count}
            actions={actions}
            explorerActions={explorer.actions}
          />
          <motion.div variants={pageVariants} initial="hidden" animate="show">
            {explorer.panel}
          </motion.div>
        </>
      )}
    </ProjectExplorerHost>
  );
}

function CurrentTabSkeleton() {
  return (
    <div className="repo-grid">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton-card glass-panel"
          style={{
            minHeight: "12rem",
            background: "rgba(17, 17, 22, 0.3)",
            animation: "state-pulse 1.5s infinite",
          }}
        />
      ))}
    </div>
  );
}

function CurrentTabContent({
  vm,
  onOpenSetup,
  actions,
  canCreateProjects,
  guest,
}: Readonly<{
  vm: ReturnType<typeof useCurrentProjectsViewModel>;
  onOpenSetup: () => void;
  actions: HeaderActionsProps;
  canCreateProjects: boolean;
  guest: boolean;
}>) {
  if (vm.status === "error" || !vm.team) {
    return (
      <>
        <CurrentProjectsHeader count={null} actions={actions} />
        {vm.status === "error" ? (
          <GroupsLoadError onRetry={vm.retry} />
        ) : (
          <CurrentTabEmptyState
            onOpenSetup={onOpenSetup}
            canCreateProjects={canCreateProjects}
            guest={guest}
          />
        )}
      </>
    );
  }
  return (
    <TeamProjects
      key={vm.team.id}
      team={vm.team}
      linkedFolderId={vm.linkedFolderId}
      opensNewProject={vm.opensNewProject}
      actions={actions}
    />
  );
}

/**
 * Current Projects: the Project cards of the team selected in the header,
 * straight on the page. Each card opens its Project (Manage opens the detail);
 * the per-repository detail lives on the full page (/projects/[id]). The
 * team's members, checklists, activity and settings are pages of their own —
 * Teams, Checklists, Activity, and the Settings page's Team tab.
 *
 * There is no individual/personal side. A workspace IS a team and every project
 * belongs to one.
 */
export function WorkflowCurrentTab({
  latestResult,
  loadingProjects,
  onOpenSetup,
  canCreateProjects = false,
  guest = false,
  onGuestCreate,
  onStartGuide,
}: Readonly<WorkflowCurrentTabProps>) {
  const vm = useCurrentProjectsViewModel({ loadingProjects });
  const actions: HeaderActionsProps = { onGuestCreate, onStartGuide };

  return (
    <motion.section
      className="tab-content-panel"
      id="workflow-panel-current"
      aria-label="Current projects"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "transparent",
        border: "none",
        boxShadow: "none",
        padding: 0,
      }}
    >
      {latestResult ? <LatestResultBanner latestResult={latestResult} /> : null}
      {vm.status === "loading" ? (
        <CurrentTabSkeleton />
      ) : (
        /* --page drops the card chrome (the content IS the page, as on
           /projects/[id]) but keeps the compact button sizing that
           globals.css scopes to .project-detail-panel. */
        <div className="project-detail-panel project-detail-panel--page current-projects-page">
          <CurrentTabContent
            vm={vm}
            onOpenSetup={onOpenSetup}
            actions={actions}
            canCreateProjects={canCreateProjects}
            guest={guest}
          />
        </div>
      )}
    </motion.section>
  );
}
