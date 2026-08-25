"use client";

import Link from "next/link";
import { Fragment } from "react";
import { motion } from "framer-motion";

import {
  RUN_STAGE_LABELS,
  isGroupManagerRole,
  computeRunStats,
  projectBadgeLabel,
  projectTone,
  shortRepoName,
  timeAgo,
} from "../../model/home-rules";
import type {
  DeliveryPortfolioNode,
  GroupActivityItem,
  GroupSummary,
  MyAssignedRepository,
  ProvisionedProject,
  RunGroup,
} from "../../model/home-types";
import { KeyboardShortcuts } from "./dashboard-chrome";
import { GetStartedJourney } from "./get-started-journey";
import { sectionVariants } from "./motion";
import { PipelineActivity } from "./pipeline-activity";
import { useCountUp } from "./count-up";

/** Container-less metric cell: a quiet mono figure on a hairline, not a card. */
export function DashboardMetric({
  value,
  label,
  loading,
  reduced,
  href,
}: Readonly<{
  value: number;
  label: string;
  loading: boolean;
  reduced: boolean | null;
  href?: string;
}>) {
  const animatedValue = useCountUp(reduced || loading ? null : value, 700);
  const content = (
    <>
      <span className="metric-cell-num">
        {loading ? "—" : reduced ? value : (animatedValue ?? value)}
      </span>
      <span className="metric-cell-label">{label}</span>
    </>
  );

  return href ? (
    <Link href={href} className="metric-cell metric-cell--link">
      {content}
    </Link>
  ) : (
    <div className="metric-cell">{content}</div>
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
}>) {
  const deliveryProjectCount = portfolio.reduce(
    (count, node) => count + node.deliveryProjects.length,
    0,
  );
  const repositoryCount = portfolio.reduce(
    (count, node) =>
      count +
      node.deliveryProjects.reduce(
        (deliveryCount, deliveryProject) =>
          deliveryCount + deliveryProject.repositories.length,
        0,
      ),
    0,
  );
  const failedProjects = projects.filter(
    (project) => project.status === "failed" || project.status === "orphaned",
  );
  const syncingAssignments = assignments.filter(
    (assignment) =>
      assignment.effectiveState === "failed" ||
      assignment.effectiveState === "pending" ||
      assignment.effectiveState === "unknown",
  );
  const attentionItems = [
    failedProjects.length
      ? {
          tone: "danger",
          label: `${failedProjects.length} project${failedProjects.length === 1 ? "" : "s"} need attention`,
          detail: "Review failed or disconnected delivery work.",
          href: "/workflows?tab=current",
        }
      : null,
    syncingAssignments.length
      ? {
          tone: "warning",
          label: `${syncingAssignments.length} access update${syncingAssignments.length === 1 ? "" : "s"} in progress`,
          detail: "GitHub permissions are still being verified.",
          href: group ? `/groups/${group.id}` : "/workflows?tab=current",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  // "Effectively empty" — nothing to operate on yet. Show a guided journey
  // instead of a grid of zeros. Derived entirely from real data.
  const isEmptyWorkspace =
    !loading &&
    projects.length === 0 &&
    runs.length === 0 &&
    deliveryProjectCount === 0;

  // Single source of run analytics — feeds the hero sparkline + Quality card.
  const runStats = computeRunStats(runs);

  return (
    <div className={`dashboard-flow${isEmptyWorkspace ? " dashboard-flow--empty" : ""}`}>
      {isEmptyWorkspace ? (
        <GetStartedJourney
          projects={projects}
          runs={runs}
          historyCount={workflowHistoryCount}
          reduced={reduced}
        />
      ) : (
        <>
          {/* Metric strip — one framed row of hairline-divided figures. */}
          <motion.section
            className="metrics-rail"
            aria-label="Workspace metrics"
            custom={1}
            variants={sectionVariants}
            initial={reduced ? false : "hidden"}
            animate="visible"
          >
            <DashboardMetric value={projects.length} label="Projects" loading={loading} reduced={reduced} href="/workflows?tab=current" />
            <DashboardMetric value={group?.systemCount ?? 0} label="Systems" loading={loading && Boolean(group)} reduced={reduced} />
            <DashboardMetric value={deliveryProjectCount} label="Team projects" loading={loading && Boolean(group)} reduced={reduced} />
            <DashboardMetric value={repositoryCount} label="Repositories" loading={loading && Boolean(group)} reduced={reduced} />
            <DashboardMetric value={workflowHistoryCount} label="Workflow files" loading={loading} reduced={reduced} href="/workflows?tab=current" />
            <DashboardMetric value={runs.length} label="Recent runs" loading={loading} reduced={reduced} href="/runs" />
          </motion.section>

          {/* Main grid: animated pipeline flow (hero) + narrow ops sidebar. */}
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
              {/* a. Team projects — real provisioned projects, tinted by status. */}
              <section className="side-rail-block side-rail-block--grow" aria-label="Team projects">
                <div className="side-rail-head">
                  <p className="dashboard-section-kicker">TEAM PROJECTS</p>
                  <Link href={group ? `/groups/${group.id}/systems` : "/workflows?tab=current"} className="dashboard-inline-link">All <span aria-hidden="true">→</span></Link>
                </div>
                <div className="side-rail-scroll">
                  {loading ? (
                    <p className="dashboard-empty">Loading projects…</p>
                  ) : projects.length ? (
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
                  ) : (
                    <p className="dashboard-empty">No projects in this workspace yet.</p>
                  )}
                </div>
              </section>

              {/* b. Quality — compact stat card from computeRunStats. */}
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
                    <span className={`quality-stat-value${runStats.failureStreak > 0 ? " quality-stat-value--danger" : ""}`}>
                      {loading ? "—" : runStats.failureStreak}
                    </span>
                  </div>
                </div>
              </section>

              {/* c. Activity — group activity feed, manager-gated as before. */}
              <section className="side-rail-block side-rail-block--divided side-rail-block--grow" aria-labelledby="recent-activity-title">
                <div className="side-rail-head">
                  <p className="dashboard-section-kicker" id="recent-activity-title">ACTIVITY</p>
                  {group ? <Link href={`/groups/${group.id}/activity`} className="dashboard-inline-link">Open <span aria-hidden="true">→</span></Link> : null}
                </div>
                <div className="side-rail-scroll">
                  {activity.length ? <div className="dashboard-activity-list">{activity.slice(0, 8).map((item) => (
                    <div className="dashboard-activity-row" key={item.id}>
                      <span className="dashboard-activity-dot" aria-hidden="true" />
                      <span><strong>{item.message}</strong><small>{item.actorLabel} · {timeAgo(item.createdAt)}</small></span>
                    </div>
                  ))}</div> : <p className="dashboard-empty">{group && !isGroupManagerRole(group.role) ? "Team activity is available to group leads." : "No recent activity in this workspace."}</p>}
                </div>
              </section>
            </motion.aside>
          </div>

          <KeyboardShortcuts reduced={reduced} />
        </>
      )}
    </div>
  );
}

