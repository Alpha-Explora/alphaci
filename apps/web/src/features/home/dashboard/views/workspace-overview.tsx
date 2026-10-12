"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { SIDEBAR_SHOWS_ACTIVITY } from "@/features/workspace/selection";

import {
  RUN_STAGE_LABELS,
  buildWorkspaceAttentionItems,
  computeRunStats,
  failedDeliveryProjects,
  isEmptyWorkspace,
  projectBadgeLabel,
  projectTone,
  shortRepoName,
  syncingAccessAssignments,
  timeAgo,
  workspacePortfolioCounts,
} from "../../model/home-rules";
import type {
  DeliveryPortfolioNode,
  GroupActivityItem,
  GroupSummary,
  MyAssignedRepository,
  ProvisionedProject,
  RunGroup,
  RunStats,
  WorkspaceAttentionItem,
} from "../../model/home-types";
import type { HomeShortcutId } from "../../model/home-persona-types";
import { KeyboardShortcuts } from "./dashboard-chrome";
import { GetStartedJourney } from "./get-started-journey";
import { sectionVariants } from "./motion";
import { PipelineActivity } from "./pipeline-activity";
import { useCountUp } from "./count-up";

/** A dash until the value is known; then the (counting) figure and its suffix. */
function metricText(known: number | null, shown: number | null, suffix: string): string {
  if (known === null) return "—";
  return `${shown ?? known}${suffix}`;
}

/** Container-less metric cell: a quiet mono figure on a hairline, not a card. */
export function DashboardMetric({
  value,
  label,
  loading,
  reduced,
  href,
  suffix,
}: Readonly<{
  /** Null when it is not known: shown as a dash. */
  value: number | null;
  label: string;
  loading: boolean;
  reduced: boolean | null;
  href?: string;
  /** Appended to the figure, e.g. "%". */
  suffix?: string;
}>) {
  const known = loading || value === null ? null : value;
  const animatedValue = useCountUp(reduced ? null : known, 700);
  const content = (
    <>
      <span className="metric-cell-num">
        {metricText(known, reduced ? known : animatedValue, suffix ?? "")}
      </span>
      <span className="metric-cell-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="metric-cell metric-cell--link">
        {content}
      </Link>
    );
  }
  return <div className="metric-cell">{content}</div>;
}

function WorkspaceMetricsRail({
  projects,
  group,
  deliveryProjectCount,
  repositoryCount,
  workflowHistoryCount,
  runs,
  loading,
  reduced,
}: Readonly<{
  projects: ProvisionedProject[];
  group: GroupSummary | null;
  deliveryProjectCount: number;
  repositoryCount: number;
  workflowHistoryCount: number;
  runs: RunGroup[];
  loading: boolean;
  reduced: boolean | null;
}>) {
  const groupLoading = loading && Boolean(group);
  return (
    <motion.section
      className="metrics-rail"
      aria-label="Workspace metrics"
      custom={1}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <DashboardMetric value={projects.length} label="Projects" loading={loading} reduced={reduced} href="/workflows?tab=current" />
      <DashboardMetric value={group?.systemCount ?? 0} label="Systems" loading={groupLoading} reduced={reduced} />
      <DashboardMetric value={deliveryProjectCount} label="Team projects" loading={groupLoading} reduced={reduced} />
      <DashboardMetric value={repositoryCount} label="Repositories" loading={groupLoading} reduced={reduced} />
      <DashboardMetric value={workflowHistoryCount} label="Workflow files" loading={loading} reduced={reduced} href="/workflows?tab=current" />
      <DashboardMetric value={runs.length} label="Recent runs" loading={loading} reduced={reduced} href="/runs" />
    </motion.section>
  );
}

export function TeamProjectsList({
  group,
  projects,
  loading,
}: Readonly<{
  group: GroupSummary | null;
  projects: ProvisionedProject[];
  loading: boolean;
}>) {
  return (
    <section className="side-rail-block side-rail-block--grow" aria-label="Team projects">
      <div className="side-rail-head">
        <p className="dashboard-section-kicker">TEAM PROJECTS</p>
        <Link href={group ? `/groups/${group.id}/systems` : "/workflows?tab=current"} className="dashboard-inline-link">All <span aria-hidden="true">→</span></Link>
      </div>
      <div className="side-rail-scroll">
        {loading ? (
          <p className="dashboard-empty">Loading projects…</p>
        ) : (
          <TeamProjectsBody projects={projects} />
        )}
      </div>
    </section>
  );
}

function TeamProjectsBody({
  projects,
}: Readonly<{ projects: ProvisionedProject[] }>) {
  if (!projects.length) {
    return <p className="dashboard-empty">No projects in this workspace yet.</p>;
  }
  return (
    <div className="team-projects-list">
      {projects.slice(0, 4).map((project) => {
        const tone = projectTone(project.status);
        return (
          <Link key={project.id} href="/workflows?tab=current" className="team-project-row">
            <span className={`team-status-dot team-status-dot--${tone}`} aria-hidden="true" />
            <span className="team-project-copy">
              <strong>{shortRepoName(project.repoFullName)}</strong>
              <small>{project.serviceName}</small>
            </span>
            <span className={`team-status-badge team-status-badge--${tone}`}>
              {projectBadgeLabel(project.status)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function QualityCard({
  runStats,
  loading,
}: Readonly<{
  runStats: RunStats;
  loading: boolean;
}>) {
  const streakClass =
    runStats.failureStreak > 0 ? " quality-stat-value--danger" : "";
  return (
    <section className="side-rail-block side-rail-block--divided" aria-label="Quality">
      <p className="dashboard-section-kicker side-rail-kicker">QUALITY</p>
      <div className="quality-card">
        <div className="quality-stat">
          <span className="quality-stat-label">Scanning stage</span>
          <span className="quality-stat-value">
            {runStats.worstStage ? RUN_STAGE_LABELS[runStats.worstStage.stage] : "None"}
          </span>
        </div>
        <div className="quality-stat">
          <span className="quality-stat-label">Failure streak</span>
          <span className={`quality-stat-value${streakClass}`}>
            {loading ? "—" : runStats.failureStreak}
          </span>
        </div>
      </div>
    </section>
  );
}

function ActivityRail({
  group,
  activity,
  canOpenActivity,
}: Readonly<{
  group: GroupSummary | null;
  activity: GroupActivityItem[];
  /** canOpenTeamActivity for the header team; nobody else is offered the link. */
  canOpenActivity: boolean;
}>) {
  return (
    <section className="side-rail-block side-rail-block--divided side-rail-block--grow" aria-labelledby="recent-activity-title">
      <div className="side-rail-head">
        <p className="dashboard-section-kicker" id="recent-activity-title">ACTIVITY</p>
        {group && canOpenActivity ? <Link href={`/groups/${group.id}/activity`} className="dashboard-inline-link">Open <span aria-hidden="true">→</span></Link> : null}
      </div>
      <div className="side-rail-scroll">
        {activity.length ? (
          <div className="dashboard-activity-list">
            {activity.slice(0, 8).map((item) => (
              <div className="dashboard-activity-row" key={item.id}>
                <span className="dashboard-activity-dot" aria-hidden="true" />
                <span><strong>{item.message}</strong><small>{item.actorLabel} · {timeAgo(item.createdAt)}</small></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-empty">No recent activity in this workspace.</p>
        )}
      </div>
    </section>
  );
}

function WorkspacePopulatedOverview({
  group,
  projects,
  runs,
  activity,
  deliveryProjectCount,
  repositoryCount,
  workflowHistoryCount,
  loading,
  reduced,
  runStats,
  attentionItems,
  canOpenActivity,
  showActivity,
  shortcuts,
}: Readonly<{
  group: GroupSummary | null;
  projects: ProvisionedProject[];
  runs: RunGroup[];
  activity: GroupActivityItem[];
  deliveryProjectCount: number;
  repositoryCount: number;
  workflowHistoryCount: number;
  loading: boolean;
  reduced: boolean | null;
  runStats: RunStats;
  attentionItems: WorkspaceAttentionItem[];
  canOpenActivity: boolean;
  showActivity: boolean;
  shortcuts: ReadonlyArray<HomeShortcutId>;
}>) {
  return (
    <>
      <WorkspaceMetricsRail
        projects={projects}
        group={group}
        deliveryProjectCount={deliveryProjectCount}
        repositoryCount={repositoryCount}
        workflowHistoryCount={workflowHistoryCount}
        runs={runs}
        loading={loading}
        reduced={reduced}
      />

      <div className="dashboard-main-grid">
        <PipelineActivity
          runs={runs}
          stats={runStats}
          loading={loading}
          reduced={reduced}
          attentionItems={attentionItems}
        />

        <motion.aside
          className="dashboard-side-col"
          custom={4}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <TeamProjectsList group={group} projects={projects} loading={loading} />
          <QualityCard runStats={runStats} loading={loading} />
          {showActivity ? (
            <ActivityRail group={group} activity={activity} canOpenActivity={canOpenActivity} />
          ) : null}
        </motion.aside>
      </div>

      <KeyboardShortcuts reduced={reduced} shortcuts={shortcuts} />
    </>
  );
}

export function DashboardWorkspaceOverview({
  group,
  portfolio,
  assignments,
  activity,
  projects,
  runs,
  workflowHistoryCount,
  loading,
  reduced,
  canOpenActivity,
  showActivity = SIDEBAR_SHOWS_ACTIVITY,
  shortcuts,
}: Readonly<{
  group: GroupSummary | null;
  portfolio: DeliveryPortfolioNode[];
  assignments: MyAssignedRepository[];
  activity: GroupActivityItem[];
  projects: ProvisionedProject[];
  runs: RunGroup[];
  workflowHistoryCount: number;
  loading: boolean;
  reduced: boolean | null;
  canOpenActivity: boolean;
  /**
   * Whether the Activity rail (and its "Open" link) shows at all. Defaults to
   * SIDEBAR_SHOWS_ACTIVITY: the team feed is hidden for now, like its sidebar
   * entry. Tests pass true to cover the rail itself.
   */
  showActivity?: boolean;
  /** The keyboard shortcuts legend (the team layout's). */
  shortcuts: ReadonlyArray<HomeShortcutId>;
}>) {
  const { deliveryProjectCount, repositoryCount } =
    workspacePortfolioCounts(portfolio);
  const failedProjects = failedDeliveryProjects(projects);
  const syncingAssignments = syncingAccessAssignments(assignments);
  const attentionItems = buildWorkspaceAttentionItems({
    failedProjectCount: failedProjects.length,
    syncingAssignmentCount: syncingAssignments.length,
    groupId: group?.id,
  });
  const empty = isEmptyWorkspace({
    loading,
    projectCount: projects.length,
    deliveryProjectCount,
  });
  const runStats = computeRunStats(runs);
  const flowClass = empty ? "dashboard-flow dashboard-flow--empty" : "dashboard-flow";

  if (empty) {
    return (
      <div className={flowClass}>
        <GetStartedJourney
          projects={projects}
          runs={runs}
          historyCount={workflowHistoryCount}
          reduced={reduced}
        />
      </div>
    );
  }

  return (
    <div className={flowClass}>
      <WorkspacePopulatedOverview
        group={group}
        projects={projects}
        runs={runs}
        activity={activity}
        deliveryProjectCount={deliveryProjectCount}
        repositoryCount={repositoryCount}
        workflowHistoryCount={workflowHistoryCount}
        loading={loading}
        reduced={reduced}
        runStats={runStats}
        attentionItems={attentionItems}
        canOpenActivity={canOpenActivity}
        showActivity={showActivity}
        shortcuts={shortcuts}
      />
    </div>
  );
}
