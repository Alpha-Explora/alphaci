"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import {
  WorkspaceProvider,
  useWorkspaceSelection,
} from "@/components/layout/workspace-context";
import { WelcomeModal } from "@/components/product/welcome-modal";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  getDeliveryProjectRepositories,
  getGroupActivity,
  getGroupInvitations,
  getGroupSystems,
  getMyAssignedRepositories,
  getMyGroups,
  getSystemDeliveryProjects,
  logout,
  getProjects,
  getWorkflowHistory,
} from "@/lib/api/client";
import { completeOnboarding } from "@/lib/api/auth";
import { getRuns } from "@/lib/api/runs";
import type {
  ProvisionedProject,
  WorkflowHistoryItem,
  RunGroup,
  StageId,
} from "@/lib/api/contracts";
import {
  isGroupManagerRole,
  type DeliveryProject,
  type GroupActivityItem,
  type GroupInvitation,
  type GroupSummary,
  type HierarchyRepository,
  type HierarchySystem,
  type MyAssignedRepository,
} from "@/lib/api/hierarchy-contracts";
import { isGuest } from "@/lib/auth/subscription";

/* ── Animated counter hook ──────────────────────────────────────────────────── */

function useCountUp(target: number | null, duration = 900): number | null {
  const [count, setCount] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    if (target === null || target === 0) {
      const safeTarget = target;
      rafRef.current = requestAnimationFrame(() => {
        setCount(safeTarget);
      });
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const safeTarget = target;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * safeTarget));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return count;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

function QuickActionCreateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function QuickActionWorkflowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function QuickActionRunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
    </svg>
  );
}

const quickActions = [
  {
    cmd: "new-project",
    href: "/workflows?tab=setup",
    display: "Create Project",
    description: "Connect a repo and generate a pipeline",
    shortcut: "N",
    accent: "var(--brand)",
    icon: QuickActionCreateIcon,
  },
  {
    cmd: "view-workflows",
    href: "/workflows?tab=current",
    display: "View Workflows",
    description: "See provisioned projects and history",
    shortcut: "W",
    accent: "var(--accent-violet)",
    icon: QuickActionWorkflowIcon,
  },
  {
    cmd: "view-runs",
    href: "/runs",
    display: "View Runs",
    description: "Check live pipeline stage status",
    shortcut: "R",
    accent: "var(--success)",
    icon: QuickActionRunIcon,
  },
];

// Real pipeline stages reported by GET /ci/runs — mirrors the /runs page.
const RUN_STAGE_ORDER: StageId[] = ["access", "quality", "package"];
const RUN_STAGE_LABELS: Record<StageId, string> = {
  access: "Access",
  quality: "Quality",
  package: "Package",
};

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const pipelineContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const pipelineDotVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.28, ease: EASE_OUT },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT, delay: delay * 0.06 },
  }),
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */

/**
 * Latest-run widget for the dashboard header. Unlike the old decorative
 * pipeline (hardcoded stages, always-green final dot), this renders the real
 * latest run from GET /ci/runs and links through to the /runs page.
 */
function LatestRunTrack({
  run,
  loading,
  reduced,
}: Readonly<{
  run: RunGroup | null;
  loading: boolean;
  reduced: boolean | null;
}>) {
  if (loading) {
    return (
      <div className="latest-run-link" aria-label="Loading latest run">
        <div className="pipeline-track" style={{ marginTop: 0 }}>
          {RUN_STAGE_ORDER.map((stage, index) => (
            <span
              key={stage}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <span className="pipeline-dot latest-run-dot--loading" />
              {index < RUN_STAGE_ORDER.length - 1 && (
                <span className="pipeline-connector" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
        <p className="latest-run-meta">Checking latest run</p>
      </div>
    );
  }

  if (!run) {
    return (
      <Link
        href="/runs"
        className="latest-run-link"
        aria-label="No runs yet. Open the runs page."
      >
        <div className="pipeline-track" style={{ marginTop: 0 }}>
          {RUN_STAGE_ORDER.map((stage, index) => (
            <span
              key={stage}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <span
                className="pipeline-dot"
                title={RUN_STAGE_LABELS[stage]}
              />
              {index < RUN_STAGE_ORDER.length - 1 && (
                <span className="pipeline-connector" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
        <p className="latest-run-meta">
          No runs yet. Push to a provisioned repo to see live stages.
        </p>
      </Link>
    );
  }

  const repoShort = run.repoFullName.split("/")[1] ?? run.repoFullName;
  const stageMap = new Map(run.stages.map((s) => [s.stage, s]));

  return (
    <Link
      href="/runs"
      className="latest-run-link"
      aria-label={`Latest run for ${repoShort} on ${run.branch}: ${run.overallStatus}. View run details.`}
    >
      <span className="latest-run-repo">
        {repoShort}
        <span className="latest-run-branch">@{run.branch}</span>
      </span>
      <motion.div
        className="pipeline-track"
        style={{ marginTop: 0 }}
        variants={reduced ? undefined : pipelineContainerVariants}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "visible"}
      >
        {RUN_STAGE_ORDER.map((stageName, index) => {
          const status = stageMap.get(stageName)?.status ?? "pending";
          return (
            <span
              key={stageName}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              <motion.span
                className={`pipeline-dot pipeline-dot--${status}`}
                variants={reduced ? undefined : pipelineDotVariants}
                title={`${RUN_STAGE_LABELS[stageName]}: ${status}`}
              />
              {index < RUN_STAGE_ORDER.length - 1 && (
                <motion.span
                  className={`pipeline-connector${
                    stageMap.get(stageName)?.status === "success"
                      ? " pipeline-connector--active"
                      : ""
                  }`}
                  variants={reduced ? undefined : pipelineDotVariants}
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </motion.div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.45rem",
          flexWrap: "wrap",
        }}
      >
        {RUN_STAGE_ORDER.map((stage) => (
          <span key={stage} className="template-tag">
            {RUN_STAGE_LABELS[stage]}
          </span>
        ))}
      </div>
      <p
        className={`latest-run-meta latest-run-meta--${run.overallStatus}`}
      >
        {run.overallStatus} · {timeAgo(run.startedAt)} · View runs
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </p>
    </Link>
  );
}

function SkeletonValue({ wide = false }: { wide?: boolean }) {
  return (
    <span
      style={{
        display: "block",
        height: "2.5rem",
        width: wide ? "6rem" : "3.5rem",
        background: "var(--bg-elevated)",
        borderRadius: "6px",
        animation: "state-pulse 1.5s infinite",
      }}
    />
  );
}

/* ── ReleasePulse — container-less operational overview ─────────────────────── */

interface ReleasePulseProps {
  projects: ProvisionedProject[];
  historyLength: number;
  uniqueServices: number;
  historyLoading: boolean;
  projectsLoading: boolean;
  prefersReducedMotion: boolean | null;
}

// Kept while the legacy helper is retired behind the new continuous dashboard.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ReleasePulse({
  projects,
  historyLength,
  uniqueServices,
  historyLoading,
  projectsLoading,
  prefersReducedMotion,
}: Readonly<ReleasePulseProps>) {
  const projectsLength = projects.length;

  // Real operational signal, derived from project status — this is what an
  // operator opening the dashboard actually needs to see first.
  const attention = projects.filter(
    (p) => p.status === "failed" || p.status === "orphaned",
  );
  const provisioned = projects.filter(
    (p) => p.status === "provisioned",
  ).length;
  const provisioning = projects.filter(
    (p) => p.status === "provisioning",
  ).length;

  const animatedProjects = useCountUp(
    prefersReducedMotion || projectsLoading ? null : projectsLength,
  );
  const displayProjects = prefersReducedMotion
    ? projectsLength
    : (animatedProjects ?? projectsLength);
  const animatedHistory = useCountUp(
    prefersReducedMotion || historyLoading ? null : historyLength,
  );
  const animatedServices = useCountUp(
    prefersReducedMotion || historyLoading ? null : uniqueServices,
  );
  const displayHistory = prefersReducedMotion
    ? historyLength
    : (animatedHistory ?? historyLength);
  const displayServices = prefersReducedMotion
    ? uniqueServices
    : (animatedServices ?? uniqueServices);

  // Overall system read. Order matters: loading → empty → attention → healthy.
  const health: "loading" | "empty" | "attention" | "ok" = projectsLoading
    ? "loading"
    : projectsLength === 0
      ? "empty"
      : attention.length > 0
        ? "attention"
        : "ok";

  const headline =
    health === "loading"
      ? "Checking your systems"
      : health === "empty"
        ? "Nothing deployed yet"
        : health === "attention"
          ? `${attention.length} project${attention.length > 1 ? "s" : ""} need attention`
          : "All systems operational";

  const subline =
    health === "loading"
      ? "Reading project and workflow status"
      : health === "empty"
        ? "Connect a repository to generate your first pipeline"
        : `${provisioned} provisioned${provisioning ? `, ${provisioning} provisioning` : ""}${attention.length ? `, ${attention.length} flagged` : ""}`;

  const dotClass =
    health === "ok"
      ? "ov-status-dot--ok"
      : health === "attention"
        ? "ov-status-dot--warn"
        : "ov-status-dot--idle";

  return (
    <div className="ov-pulse">
      {/* System status — the one line that answers "is anything wrong?" */}
      <div className="ov-status">
        <span className={`ov-status-dot ${dotClass}`} aria-hidden="true" />
        <div className="ov-status-copy">
          <h2 className="ov-status-headline">{headline}</h2>
          <p className="ov-status-sub">{subline}</p>
        </div>
      </div>

      {/* Body row: operational focus on the left, stat rail on the right */}
      <div className="ov-body-row">
        <div className="ov-body-main">
          {health === "attention" ? (
            <div className="ov-attention-list">
              {attention.map((project) => (
                <Link
                  key={project.id}
                  href="/workflows?tab=current"
                  className="ov-attention-row"
                >
                  <span
                    className={`ov-attention-status ${project.status === "failed" ? "is-failed" : "is-orphaned"}`}
                  >
                    {project.status}
                  </span>
                  <span className="ov-attention-name">
                    {project.repoFullName.split("/")[1] ??
                      project.repoFullName}
                  </span>
                  <span className="ov-attention-reason">
                    {project.failureReason ??
                      (project.status === "orphaned"
                        ? "GitHub webhook or access broke; re-sync to reconnect"
                        : "Provisioning did not finish")}
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : health === "empty" ? (
            <Link href="/workflows?tab=setup" className="ov-nextstep">
              <span className="ov-nextstep-copy">
                <span className="ov-nextstep-title">Connect a repository</span>
                <span className="ov-nextstep-sub">
                  Pick a repo and ALPHACI writes the GitHub Actions pipeline
                  for it
                </span>
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          ) : health === "ok" ? (
            <p className="ov-allclear">
              No failed or orphaned projects. Nothing needs your attention
              right now.
            </p>
          ) : null}
        </div>

        {/* Stat rail — quiet mono figures on a hairline divider, no card chrome */}
        <div className="ov-rail-aside" aria-label="Key metrics">
          <Link href="/workflows?tab=current" className="ov-stat-mini">
            <span className="ov-stat-mini-num">
              {projectsLoading ? <SkeletonValue /> : displayProjects}
            </span>
            <span className="ov-stat-mini-label">Projects</span>
          </Link>
          <div className="ov-stat-mini">
            <span className="ov-stat-mini-num">
              {historyLoading ? <SkeletonValue /> : displayServices}
            </span>
            <span className="ov-stat-mini-label">Services</span>
          </div>
          <Link href="/workflows?tab=all" className="ov-stat-mini">
            <span className="ov-stat-mini-num">
              {historyLoading ? <SkeletonValue /> : displayHistory}
            </span>
            <span className="ov-stat-mini-label">Workflows</span>
          </Link>
        </div>
      </div>

      {/* Quick actions — lean command rows, no container */}
      <div className="ov-actions">
        <p className="ov-section-eyebrow">Quick actions</p>
        <div className="bento-cmd-list">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <Link
                key={action.cmd}
                href={action.href}
                className="bento-cmd-row"
                style={
                  { "--cmd-accent": action.accent } as React.CSSProperties
                }
              >
                <span className="bento-cmd-icon" aria-hidden="true">
                  <ActionIcon />
                </span>
                <span className="bento-cmd-body">
                  <span className="bento-cmd-titleline">
                    <span className="bento-cmd-prompt" aria-hidden="true">
                      $
                    </span>
                    <span className="bento-cmd-name">{action.cmd}</span>
                    <span className="bento-cmd-display">
                      {action.display}
                    </span>
                  </span>
                  <span className="bento-cmd-desc">{action.description}</span>
                </span>
                <span className="bento-cmd-shortcut">{action.shortcut}</span>
                <svg
                  className="bento-cmd-arrow"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type DeliveryPortfolioNode = {
  system: HierarchySystem;
  deliveryProjects: Array<
    DeliveryProject & { repositories: HierarchyRepository[] }
  >;
};

function shortRepoName(repoFullName: string | null | undefined): string {
  if (!repoFullName) return "Repository";
  return repoFullName.split("/")[1] ?? repoFullName;
}

function readableAssignmentState(state: MyAssignedRepository["effectiveState"]): string {
  return state === "active"
    ? "Access active"
    : state === "pending"
      ? "Access syncing"
      : state === "failed"
        ? "Access needs attention"
        : state === "revoking"
          ? "Access is being removed"
          : state === "revoked"
            ? "Access removed"
            : "Access check pending";
}

function DashboardMetric({
  value,
  label,
  loading,
  reduced,
  href,
  accent,
}: Readonly<{
  value: number;
  label: string;
  loading: boolean;
  reduced: boolean | null;
  href?: string;
  accent: "brand" | "violet" | "success" | "amber" | "muted";
}>) {
  const animatedValue = useCountUp(reduced || loading ? null : value, 700);
  const content = (
    <>
      <span className={`dashboard-metric-icon dashboard-metric-icon--${accent}`} aria-hidden="true">
        <span />
      </span>
      <span className="dashboard-metric-copy">
        <strong>{loading ? "—" : (reduced ? value : (animatedValue ?? value))}</strong>
        <span>{label}</span>
      </span>
    </>
  );

  return href ? (
    <Link href={href} className="dashboard-metric dashboard-metric--link">
      {content}
    </Link>
  ) : (
    <div className="dashboard-metric">{content}</div>
  );
}

function DashboardWorkspaceOverview({
  group,
  portfolio,
  assignments,
  invitations,
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
  invitations: GroupInvitation[];
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
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending",
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
    pendingInvitations.length
      ? {
          tone: "warning",
          label: `${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? "" : "s"}`,
          detail: "A teammate is waiting to join this group.",
          href: group ? `/groups/${group.id}/members` : "/settings",
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

  const scopeLabel = group
    ? `${group.name} · ${group.role === "admin" ? "Lead" : group.role === "delegated_lead" ? "Delegated lead" : group.role}`
    : "Personal workspace";
  const scopeDescription = group
    ? group.description ?? group.businessUnit ?? "Team delivery workspace"
    : "Your provisioned projects and assigned delivery work";

  return (
    <div className="dashboard-flow">
      <motion.section
        className="dashboard-scope"
        aria-label="Current dashboard scope"
        custom={1}
        variants={sectionVariants}
        initial={reduced ? false : "hidden"}
        animate="visible"
      >
        <div>
          <p className="dashboard-section-kicker">CURRENT SCOPE</p>
          <h2>{scopeLabel}</h2>
          <p>{scopeDescription}</p>
        </div>
        {group ? (
          <Link href={`/groups/${group.id}`} className="dashboard-inline-link">
            Open group
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </motion.section>

      <motion.section
        className="dashboard-attention"
        aria-label="Items needing attention"
        custom={2}
        variants={sectionVariants}
        initial={reduced ? false : "hidden"}
        animate="visible"
      >
        {loading ? (
          <p className="dashboard-attention-empty">Refreshing workspace signals…</p>
        ) : attentionItems.length ? (
          attentionItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`dashboard-attention-item dashboard-attention-item--${item.tone}`}
            >
              <span className="dashboard-attention-marker" aria-hidden="true" />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="dashboard-row-arrow" aria-hidden="true">→</span>
            </Link>
          ))
        ) : (
          <div className="dashboard-attention-clear" role="status">
            <span className="dashboard-attention-marker" aria-hidden="true" />
            <span>
              <strong>All systems operational</strong>
              <small>Nothing in this workspace needs your attention right now.</small>
            </span>
          </div>
        )}
      </motion.section>

      <motion.section
        className="dashboard-metrics"
        aria-label="Workspace metrics"
        custom={3}
        variants={sectionVariants}
        initial={reduced ? false : "hidden"}
        animate="visible"
      >
        <DashboardMetric value={projects.length} label="Projects" loading={loading} reduced={reduced} href="/workflows?tab=current" accent="brand" />
        <DashboardMetric value={group?.systemCount ?? 0} label="Systems" loading={loading && Boolean(group)} reduced={reduced} accent="violet" />
        <DashboardMetric value={deliveryProjectCount} label="Delivery projects" loading={loading && Boolean(group)} reduced={reduced} accent="amber" />
        <DashboardMetric value={repositoryCount} label="Repositories" loading={loading && Boolean(group)} reduced={reduced} accent="success" />
        <DashboardMetric value={workflowHistoryCount} label="Workflows" loading={loading} reduced={reduced} href="/workflows?tab=all" accent="violet" />
        <DashboardMetric value={runs.length} label="Recent runs" loading={loading} reduced={reduced} href="/runs" accent="muted" />
      </motion.section>

      <div className="dashboard-primary-grid">
        <motion.section
          className="dashboard-panel dashboard-panel--delivery"
          aria-labelledby="delivery-overview-title"
          custom={4}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-section-kicker">DELIVERY OVERVIEW</p>
              <h2 id="delivery-overview-title">{group ? "Active delivery structure" : "Active projects"}</h2>
            </div>
            <Link href={group ? `/groups/${group.id}/systems` : "/workflows?tab=current"} className="dashboard-inline-link">View all <span aria-hidden="true">→</span></Link>
          </div>
          {loading ? <p className="dashboard-empty">Loading delivery structure…</p> : group && portfolio.length ? (
            <div className="dashboard-tree">
              {portfolio.slice(0, 4).map((node) => (
                <div className="dashboard-tree-system" key={node.system.id}>
                  <Link href={`/groups/${group.id}/systems/${node.system.id}`} className="dashboard-tree-system-head">
                    <span className="dashboard-tree-node-dot" aria-hidden="true" />
                    <span><strong>{node.system.name}</strong><small>{node.deliveryProjects.length} delivery project{node.deliveryProjects.length === 1 ? "" : "s"}</small></span>
                    <span className="dashboard-tree-count">{node.system.status}</span>
                  </Link>
                  {node.deliveryProjects.slice(0, 2).map((deliveryProject) => (
                    <div className="dashboard-tree-project" key={deliveryProject.id}>
                      <Link href={`/groups/${group.id}/delivery-projects/${deliveryProject.id}`}>
                        <span>{deliveryProject.name}</span>
                        <small>{deliveryProject.repositories.length} repo{deliveryProject.repositories.length === 1 ? "" : "s"}</small>
                      </Link>
                      {deliveryProject.repositories.slice(0, 2).map((repository) => (
                        <Link key={repository.id} href={`/groups/${group.id}/repositories/${repository.id}`} className="dashboard-tree-repository">
                          <span>{repository.name}</span>
                          <small className={`dashboard-status dashboard-status--${repository.status}`}>{repository.status}</small>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-project-list">
              {projects.slice(0, 5).map((project) => (
                <Link key={project.id} href="/workflows?tab=current" className="dashboard-project-row">
                  <span><strong>{shortRepoName(project.repoFullName)}</strong><small>{project.serviceName}</small></span>
                  <span className={`dashboard-status dashboard-status--${project.status}`}>{project.status}</span>
                </Link>
              ))}
              {!projects.length ? <p className="dashboard-empty">No projects in this workspace yet.</p> : null}
            </div>
          )}
        </motion.section>

        <motion.section
          className="dashboard-panel dashboard-panel--work"
          aria-labelledby="my-work-title"
          custom={5}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-section-kicker">{group && isGroupManagerRole(group.role) ? "TEAM STATUS" : "MY WORK"}</p>
              <h2 id="my-work-title">{group && isGroupManagerRole(group.role) ? "People and access" : "Assigned repositories"}</h2>
            </div>
          </div>
          {loading ? <p className="dashboard-empty">Loading workspace activity…</p> : assignments.length ? (
            <div className="dashboard-work-list">
              {assignments.slice(0, 5).map((assignment) => (
                <div className="dashboard-work-row" key={assignment.assignmentId}>
                  <span className={`dashboard-work-state dashboard-work-state--${assignment.effectiveState}`} aria-hidden="true" />
                  <span><strong>{assignment.repositoryName}</strong><small>{assignment.systemName ?? assignment.groupName ?? "Assigned delivery work"}</small></span>
                  <small className="dashboard-work-access">{readableAssignmentState(assignment.effectiveState)}</small>
                </div>
              ))}
            </div>
          ) : group && isGroupManagerRole(group.role) ? (
            <div className="dashboard-team-summary">
              <strong>{group.memberCount} active team member{group.memberCount === 1 ? "" : "s"}</strong>
              <span>{pendingInvitations.length ? `${pendingInvitations.length} invitation${pendingInvitations.length === 1 ? " is" : "s are"} waiting.` : "No pending invitations."}</span>
              <Link href={`/groups/${group.id}/members`} className="dashboard-inline-link">Manage members <span aria-hidden="true">→</span></Link>
            </div>
          ) : <p className="dashboard-empty">No repositories are assigned to you in this workspace.</p>}
        </motion.section>
      </div>

      <div className="dashboard-secondary-grid">
        <motion.section
          className="dashboard-panel"
          aria-labelledby="recent-runs-title"
          custom={6}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <div className="dashboard-panel-heading">
            <div><p className="dashboard-section-kicker">PIPELINE ACTIVITY</p><h2 id="recent-runs-title">Recent runs</h2></div>
            <Link href="/runs" className="dashboard-inline-link">View all <span aria-hidden="true">→</span></Link>
          </div>
          {runs.length ? <div className="dashboard-runs-list">{runs.slice(0, 4).map((run) => (
            <Link href="/runs" key={run.runId} className="dashboard-run-row">
              <span><strong>{shortRepoName(run.repoFullName)}</strong><small>{run.branch} · {timeAgo(run.startedAt)}</small></span>
              <span className="dashboard-stage-track" aria-label={`Run ${run.overallStatus}`}>
                {RUN_STAGE_ORDER.map((stage) => <span key={stage} className={`pipeline-dot pipeline-dot--${run.stages.find((item) => item.stage === stage)?.status ?? "pending"}`} />)}
              </span>
              <span className={`dashboard-status dashboard-status--${run.overallStatus}`}>{run.overallStatus}</span>
            </Link>
          ))}</div> : <p className="dashboard-empty">Runs will appear here after a provisioned repository is updated.</p>}
        </motion.section>

        <motion.section
          className="dashboard-panel"
          aria-labelledby="recent-activity-title"
          custom={7}
          variants={sectionVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <div className="dashboard-panel-heading">
            <div><p className="dashboard-section-kicker">WORKSPACE ACTIVITY</p><h2 id="recent-activity-title">Recent activity</h2></div>
            {group ? <Link href={`/groups/${group.id}/activity`} className="dashboard-inline-link">Open activity <span aria-hidden="true">→</span></Link> : null}
          </div>
          {activity.length ? <div className="dashboard-activity-list">{activity.slice(0, 4).map((item) => (
            <div className="dashboard-activity-row" key={item.id}>
              <span className="dashboard-activity-dot" aria-hidden="true" />
              <span><strong>{item.message}</strong><small>{item.actorLabel} · {timeAgo(item.createdAt)}</small></span>
            </div>
          ))}</div> : <p className="dashboard-empty">{group && !isGroupManagerRole(group.role) ? "Team activity is available to group leads." : "No recent activity in this workspace."}</p>}
        </motion.section>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

function HomeDashboardContent() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const { selectedWorkspaceId } = useWorkspaceSelection();
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<RunGroup | null>(null);
  const [recentRuns, setRecentRuns] = useState<RunGroup[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  // Hide the header widget entirely if /ci/runs is unavailable (feature off).
  const [runsAvailable, setRunsAvailable] = useState(true);
  // Welcome modal: shown once for new users (onboardingCompleted === false).
  // Local flag dismisses immediately without waiting for a network response.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<GroupSummary | null>(null);
  const [portfolio, setPortfolio] = useState<DeliveryPortfolioNode[]>([]);
  const [assignments, setAssignments] = useState<MyAssignedRepository[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [activity, setActivity] = useState<GroupActivityItem[]>([]);
  const [workspaceOverviewLoading, setWorkspaceOverviewLoading] = useState(true);
  const [workspaceOverviewError, setWorkspaceOverviewError] = useState<string | null>(null);

  function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    getWorkflowHistory(25)
      .then((response) => {
        setHistory(response.items);
        setHistoryError(null);
      })
      .catch(() => setHistoryError("Could not load workflow history."))
      .finally(() => setHistoryLoading(false));
  }

  function loadProjects() {
    setProjectsLoading(true);
    setProjectsError(null);
    setProjects([]);
    getProjects(25, { workspaceId: selectedWorkspaceId })
      .then((response) => {
        setProjects(response.items);
        setProjectsError(null);
      })
      .catch(() => setProjectsError("Could not load projects."))
      .finally(() => setProjectsLoading(false));
  }

  function loadLatestRun() {
    setRunsLoading(true);
    getRuns()
      .then((response) => {
        setLatestRun(response.runs[0] ?? null);
        setRecentRuns(response.runs);
        setRunsAvailable(true);
      })
      .catch(() => {
        setLatestRun(null);
        setRecentRuns([]);
        setRunsAvailable(false);
      })
      .finally(() => setRunsLoading(false));
  }

  function loadWorkspaceOverview() {
    setWorkspaceOverviewLoading(true);
    setWorkspaceOverviewError(null);

    Promise.all([getMyGroups(), getMyAssignedRepositories()])
      .then(async ([groupsResponse, assignmentsResponse]) => {
        const group = groupsResponse.items.find(
          (item) => item.id === selectedWorkspaceId,
        ) ?? null;
        setCurrentGroup(group);
        setAssignments(
          group
            ? assignmentsResponse.items.filter(
                (assignment) => assignment.groupId === group.id,
              )
            : assignmentsResponse.items.filter(
                (assignment) => !selectedWorkspaceId || assignment.groupId === selectedWorkspaceId,
              ),
        );

        if (!group) {
          setPortfolio([]);
          setInvitations([]);
          setActivity([]);
          return;
        }

        const systems = await getGroupSystems(group.id);
        const nextPortfolio = await Promise.all(
          systems.map(async (system) => {
            const deliveryProjects = await getSystemDeliveryProjects(system.id);
            const projectsWithRepositories = await Promise.all(
              deliveryProjects.map(async (deliveryProject) => ({
                ...deliveryProject,
                repositories: await getDeliveryProjectRepositories(
                  deliveryProject.id,
                ),
              })),
            );
            return { system, deliveryProjects: projectsWithRepositories };
          }),
        );
        setPortfolio(nextPortfolio);

        if (isGroupManagerRole(group.role)) {
          const [nextInvitations, nextActivity] = await Promise.all([
            getGroupInvitations(group.id),
            getGroupActivity(group.id, { limit: 4 }),
          ]);
          setInvitations(nextInvitations);
          setActivity(nextActivity.items);
        } else {
          setInvitations([]);
          setActivity([]);
        }
      })
      .catch(() => {
        setCurrentGroup(null);
        setPortfolio([]);
        setInvitations([]);
        setActivity([]);
        setWorkspaceOverviewError(
          "Some group information could not be loaded. You can still review your projects and runs.",
        );
      })
      .finally(() => setWorkspaceOverviewLoading(false));
  }

  // Internal workspace: there is no guest/preview mode. Unauthenticated
  // visitors are sent to sign-in rather than shown a preview dashboard.
  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login?next=/home");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "signed-in") return;
    loadHistory();
    loadProjects();
    loadLatestRun();
    loadWorkspaceOverview();
    // Intentionally re-run only on auth/workspace change, not on loader identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedWorkspaceId]);

  useEffect(() => {
    function handleDashboardShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        router.push("/workflows?tab=setup");
      } else if (key === "w") {
        event.preventDefault();
        router.push("/workflows?tab=current");
      } else if (key === "r") {
        event.preventDefault();
        router.push("/runs");
      }
    }

    window.addEventListener("keydown", handleDashboardShortcut);
    return () => window.removeEventListener("keydown", handleDashboardShortcut);
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);
    try {
      await logout();
      await refresh();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleWelcomeDismiss() {
    setWelcomeDismissed(true);
    // Fire-and-forget: mark complete server-side. Idempotent if the tour also
    // calls completeOnboarding later.
    completeOnboarding().catch(() => {
      // Non-fatal — the modal is already hidden optimistically.
    });
  }

  function refreshDashboard() {
    loadHistory();
    loadProjects();
    loadLatestRun();
    loadWorkspaceOverview();
  }

  /* ── Guard: loading ─────────────────────────────────────────────────────── */
  if (status === "loading") {
    return <PipelineLoader label="Loading your dashboard" />;
  }

  /* ── Guard: error ───────────────────────────────────────────────────────── */
  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <div
              className="state-icon"
              style={{
                background: "rgba(255,79,79,0.08)",
                border: "1px solid rgba(255,79,79,0.2)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--danger)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1>Session verification failed</h1>
            <p>
              We could not verify your session. Please retry or sign in again.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/home">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Guard: unauthenticated → redirect to sign-in (no guest mode) ───────── */
  if (status === "signed-out") {
    return <PipelineLoader label="Redirecting to sign in" />;
  }

  /* ── Signed-in ──────────────────────────────────────────────────────────── */
  const guest = isGuest(session);

  // Show the welcome modal for authenticated new users who have not yet
  // completed onboarding and have not dismissed it this session.
  const showWelcome =
    status === "signed-in" &&
    !guest &&
    !welcomeDismissed &&
    session?.user.onboardingCompleted === false;

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <main
      className="dash-shell dashboard-shell"
      suppressHydrationWarning
      style={{ overflowX: "hidden" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground variant="calm" />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      {/* Welcome modal — shown once for new authenticated users */}
      {showWelcome && (
        <WelcomeModal
          displayName={session?.user.login ?? session?.user.name ?? "there"}
          onDismiss={handleWelcomeDismiss}
        />
      )}

      {guest && (
        <div
          className="guest-banner glass-panel"
          role="alert"
          style={{
            background:
              "linear-gradient(135deg, rgba(88, 166, 255, 0.08) 0%, rgba(17, 17, 22, 0.7) 100%)",
            border: "1px solid var(--border-brand)",
            padding: "1rem var(--layout-gutter)",
            borderRadius: "0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontWeight: 500,
              fontSize: "0.88rem",
            }}
          >
            You are viewing ALPHACI in preview mode. Sign up to unlock all
            features.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              className="primary-button"
              href="/signup"
              style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}
            >
              Sign up free
            </Link>
            <Link
              className="ghost-button"
              href="/login"
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}
            >
              Log in
            </Link>
          </div>
        </div>
      )}

      <div id="main-content" className="dash-page-content home-dash-content">
        {/* ── Welcome header — flat, no outer panel box ─────────────── */}
        <motion.section
          className="welcome-banner-flat"
          aria-label="Welcome"
          custom={0}
          variants={sectionVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
          style={{ marginBottom: 0 }}
        >
          <div className="welcome-banner-flat-accent" aria-hidden="true" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            {/* Identity + primary actions (moved up from the old footer row) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.1rem",
                  minWidth: 0,
                  flex: "1 1 0",
                }}
              >
              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
              {!guest &&
                (session?.user.avatarUrl ? (
                  <Image
                    src={session.user.avatarUrl}
                    alt={session.user.name ?? session.user.login}
                    className="welcome-editorial-avatar"
                    width={44}
                    height={44}
                    style={{
                      borderRadius: "50%",
                      border: "2px solid var(--border-brand)",
                      boxShadow: "0 0 12px var(--brand-glow)",
                    }}
                    unoptimized
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 44,
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background: "var(--brand-light)",
                      border: "2px solid var(--border-brand)",
                      color: "var(--brand)",
                    }}
                  >
                    {avatarInitial}
                  </span>
                ))}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.7rem",
                    color: "var(--brand)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  SYSTEM.DASHBOARD
                </p>
                <h1
                  style={{
                    padding: 0,
                    border: "none",
                    margin: 0,
                    fontSize: "clamp(1.3rem, 2.1vw, 1.65rem)",
                    fontWeight: 700,
                  }}
                >
                  {guest
                    ? "ALPHACI Dashboard"
                    : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
                </h1>
              </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {guest && (
                  <>
                    <Link
                      className="primary-button"
                      href="/signup"
                      style={{
                        padding: "0.4rem 1rem",
                        fontSize: "0.8rem",
                        minHeight: "2.2rem",
                      }}
                    >
                      Sign up free
                    </Link>
                    <Link
                      className="ghost-button"
                      href="/login"
                      style={{
                        padding: "0.4rem 1rem",
                        fontSize: "0.8rem",
                        minHeight: "2.2rem",
                      }}
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>

              {/* Dashboard controls */}
              <motion.div
                custom={1}
                variants={sectionVariants}
                initial={prefersReducedMotion ? false : "hidden"}
                animate="visible"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "1rem",
                  flexWrap: "wrap",
                  width: "100%",
                }}
              >
                {!guest && (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={refreshDashboard}
                      style={{
                        padding: "0.4rem 1rem",
                        fontSize: "0.8rem",
                        minHeight: "2.2rem",
                      }}
                    >
                      Refresh data
                    </button>
                    <Link
                      className="primary-button"
                      href="/workflows?tab=setup"
                      style={{
                        padding: "0.4rem 1.2rem",
                        fontSize: "0.8rem",
                        minHeight: "2.2rem",
                      }}
                    >
                      Create project
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Latest run — real pipeline state from /ci/runs */}
            {runsAvailable && (
              <div
                style={{
                  borderLeft: "1px solid var(--border)",
                  paddingLeft: "clamp(0.75rem, 1.5vw, 1.25rem)",
                  alignSelf: "start",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
                className="pipeline-track-aside"
              >
                <p className="eyebrow" style={{ fontSize: "0.7rem" }}>
                  LATEST RUN
                </p>
                <LatestRunTrack
                  run={latestRun}
                  loading={runsLoading}
                  reduced={prefersReducedMotion}
                />
              </div>
            )}
          </div>

          {error ? (
            <p className="error-text" style={{ marginTop: "1rem" }}>
              {error}
            </p>
          ) : null}
          {logoutMessage ? (
            <p className="error-text" style={{ marginTop: "1rem" }}>
              {logoutMessage}
            </p>
          ) : null}
        </motion.section>

        {/* One continuous dashboard flow — no internal tabs or modes. */}
        {!guest && (projectsError || historyError || workspaceOverviewError) ? (
          <div className="dashboard-load-errors" role="alert">
            <span aria-hidden="true">!</span>
            <p>{projectsError ?? historyError ?? workspaceOverviewError}</p>
            <button className="error-retry-btn" type="button" onClick={refreshDashboard}>
              Retry
            </button>
          </div>
        ) : null}

        <DashboardWorkspaceOverview
          group={currentGroup}
          portfolio={portfolio}
          assignments={assignments}
          invitations={invitations}
          activity={activity}
          projects={projects}
          runs={recentRuns}
          workflowHistoryCount={history.length}
          loading={projectsLoading || workspaceOverviewLoading || runsLoading || historyLoading}
          reduced={prefersReducedMotion}
        />
      </div>
    </main>
  );
}

export default function HomeDashboardPage() {
  return (
    <WorkspaceProvider>
      <HomeDashboardContent />
    </WorkspaceProvider>
  );
}
