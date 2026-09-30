"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import type {
  CreateProjectResult,
  ProvisionedProject,
} from "@/shared/api/contracts";
import { WorkflowStageList } from "@/features/projects/detail";
import { DeploymentProvisioningSummary } from "./setup-result-panel";
import { FlowExplainer } from "@/features/guide/overview";
import { GroupWorkspacePanel } from "@/features/teams/detail";
import { ProjectExplorerHost } from "@/features/teams/project-folders";
import { useCapabilities } from "@/features/capabilities/current";
import { WorkspaceChecklistsSection } from "@/features/checklists/manage";
import {
  GROUPS_LOAD_ERROR,
  useCurrentProjectsViewModel,
  type CurrentProjectsGroup,
  type CurrentProjectsViewModel,
} from "../view-models/use-current-projects-view-model";
import { GroupPicker } from "./group-picker";
import { GuideIcon, PlusIcon } from "./studio-icons";

type RenderGroupCreate = (groupId: string, onComplete: () => void) => React.ReactNode;

interface HeaderActionsProps {
  /** Admin/lead (or a guest, who is sent to sign up). Hides "Create project" otherwise. */
  canCreateProjects: boolean;
  /** Opens the create view with this group preselected (null when there is none). */
  onCreateProject?: (groupId: string | null) => void;
  /** Starts the Current Projects tour. Omitted for guests, which hides "Show guide". */
  onStartGuide?: () => void;
}

interface WorkflowCurrentTabProps extends Partial<HeaderActionsProps> {
  latestResult: CreateProjectResult | null;
  loadingProjects: boolean;
  onOpenSetup: () => void;
  renderGroupCreate: RenderGroupCreate;
  projects: ProvisionedProject[];
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

function CurrentTabEmptyState({
  onOpenSetup,
}: Readonly<{ onOpenSetup: () => void }>) {
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
          Create a workspace from the picker in the header — a workspace is
          a team — then create a repository inside it. ALPHACI
          provisions the repository and commits a workflow that runs
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
    </div>
  );
}

function groupDescription(group: CurrentProjectsGroup | null): string {
  if (!group) return "Choose a group to see its projects.";
  return group.description || "Projects owned by this group.";
}

function HeaderActions({
  canCreateProjects,
  onCreateProject,
  onStartGuide,
  selectedGroupId,
}: Readonly<HeaderActionsProps & { selectedGroupId: string | null }>) {
  const create = canCreateProjects ? onCreateProject : undefined;
  if (!onStartGuide && !create) return null;
  return (
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
      {create ? (
        <button
          type="button"
          className="primary-button"
          data-testid="create-project-button"
          onClick={() => create(selectedGroupId)}
        >
          <PlusIcon />
          Create project
        </button>
      ) : null}
    </div>
  );
}

/**
 * The page's heading row. Left: the group dropdown (the page's one h1) with the
 * group's description under it. Right: the guide and the create action. With
 * no groups there is nothing to pick, so the heading is plain text.
 */
function CurrentProjectsHeading({ vm }: Readonly<{ vm: CurrentProjectsViewModel }>) {
  const { groups, selectedGroup, status } = vm;
  if (groups.length === 0 && status !== "error") {
    return (
      <div className="current-projects-heading">
        <h1 className="workflow-page-title">Projects</h1>
        <p>No groups yet.</p>
      </div>
    );
  }
  return (
    <div className="current-projects-heading">
      <GroupPicker
        options={groups}
        selectedId={selectedGroup?.id ?? null}
        label={selectedGroup?.name ?? "Choose a group"}
        error={status === "error" ? GROUPS_LOAD_ERROR : null}
        onSelect={vm.selectGroup}
      />
      <p>{groupDescription(selectedGroup)}</p>
    </div>
  );
}

function CurrentProjectsHeader({
  vm,
  actions,
}: Readonly<{ vm: CurrentProjectsViewModel; actions: HeaderActionsProps }>) {
  return (
    <div className="project-detail-header current-projects-header">
      <CurrentProjectsHeading vm={vm} />
      <HeaderActions {...actions} selectedGroupId={vm.selectedGroup?.id ?? null} />
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

function SelectedGroupContent({
  group,
  renderGroupCreate,
  onDeleted,
}: Readonly<{
  group: CurrentProjectsGroup;
  renderGroupCreate: RenderGroupCreate;
  onDeleted: (groupId: string) => void;
}>) {
  const { qaChecklistsEnabled } = useCapabilities();
  return (
    <motion.div key={group.id} variants={pageVariants} initial="hidden" animate="show">
      {/* The same explorer and checklist templates as the Teams page, gated
          by the same capability, so the two surfaces never disagree. */}
      <ProjectExplorerHost
        groupId={group.group.id}
        groupName={group.group.name}
        qaChecklistsEnabled={qaChecklistsEnabled}
      >
        {(explorer) => (
          <GroupWorkspacePanel
            group={group.group}
            projects={group.projects}
            renderCreateProject={(onComplete) =>
              renderGroupCreate(group.group.id, onComplete)
            }
            onDeleted={onDeleted}
            projectExplorer={explorer}
            qaChecklists={
              qaChecklistsEnabled ? (
                <WorkspaceChecklistsSection
                  key={group.group.id}
                  workspaceId={group.group.id}
                  projects={group.projects.map((project) => ({
                    id: project.id,
                    name: project.repoFullName,
                    detail: project.serviceName,
                  }))}
                />
              ) : null
            }
          />
        )}
      </ProjectExplorerHost>
    </motion.div>
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
  renderGroupCreate,
}: Readonly<{
  vm: CurrentProjectsViewModel;
  onOpenSetup: () => void;
  renderGroupCreate: RenderGroupCreate;
}>) {
  if (vm.status === "error") return <GroupsLoadError onRetry={vm.retry} />;
  if (!vm.selectedGroup) return <CurrentTabEmptyState onOpenSetup={onOpenSetup} />;
  return (
    <SelectedGroupContent
      group={vm.selectedGroup}
      renderGroupCreate={renderGroupCreate}
      onDeleted={vm.removeGroup}
    />
  );
}

/**
 * Current Projects: one team at a time, straight on the page. The heading is a
 * dropdown of the caller's groups; under it sits the selected team's workspace
 * (Overview, Members, Projects, Checklist templates, Activity, Settings). The
 * per-project detail lives on the full page (/projects/[id]).
 *
 * There is no individual/personal side. A workspace IS a team and every project
 * belongs to one.
 */
export function WorkflowCurrentTab({
  latestResult,
  loadingProjects,
  onOpenSetup,
  renderGroupCreate,
  projects,
  canCreateProjects = false,
  onCreateProject,
  onStartGuide,
}: Readonly<WorkflowCurrentTabProps>) {
  const vm = useCurrentProjectsViewModel({ projects, loadingProjects });

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
          <CurrentProjectsHeader
            vm={vm}
            actions={{ canCreateProjects, onCreateProject, onStartGuide }}
          />
          <CurrentTabContent
            vm={vm}
            onOpenSetup={onOpenSetup}
            renderGroupCreate={renderGroupCreate}
          />
        </div>
      )}
    </motion.section>
  );
}
