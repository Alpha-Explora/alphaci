"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  RunOverallStatus,
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

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT, delay: delay * 0.06 },
  }),
};

/* ── Sub-components ─────────────────────────────────────────────────────────── */

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

/** Product-facing role label: admin → Lead, delegated_lead → Delegated lead. */
function readableGroupRole(role: GroupSummary["role"]): string {
  if (role === "admin") return "Lead";
  if (role === "delegated_lead") return "Delegated lead";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/* ── Derived run analytics — computed client-side from recentRuns ──────────── */

interface RunStats {
  /** Most-recent-first window used for rate/breakdown (up to 10). */
  sample: RunGroup[];
  /** Whole-number success percentage over finished runs, or null when none. */
  successRate: number | null;
  finishedCount: number;
  successes: number;
  failures: number;
  running: number;
  /** Stage that failed most across the sample, or null when no failures. */
  worstStage: { stage: StageId; count: number } | null;
  /** Consecutive failures counted from the most recent run. */
  failureStreak: number;
  /** Overall statuses, most-recent-first, for the sparkline. */
  outcomes: RunOverallStatus[];
}

function computeRunStats(runs: RunGroup[]): RunStats {
  const sample = runs.slice(0, 10);
  const finished = sample.filter((run) => run.overallStatus !== "running");
  const successes = sample.filter(
    (run) => run.overallStatus === "success",
  ).length;
  const failures = sample.filter(
    (run) => run.overallStatus === "failure",
  ).length;
  const running = runs.filter((run) => run.overallStatus === "running").length;

  const successRate = finished.length
    ? Math.round(
        (finished.filter((run) => run.overallStatus === "success").length /
          finished.length) *
          100,
      )
    : null;

  const stageFailures: Record<StageId, number> = {
    access: 0,
    quality: 0,
    package: 0,
  };
  for (const run of sample) {
    for (const stage of run.stages) {
      if (stage.status === "failure") stageFailures[stage.stage] += 1;
    }
  }
  const rankedStages = (
    Object.entries(stageFailures) as Array<[StageId, number]>
  ).sort((a, b) => b[1] - a[1]);
  const worstStage =
    rankedStages[0] && rankedStages[0][1] > 0
      ? { stage: rankedStages[0][0], count: rankedStages[0][1] }
      : null;

  let failureStreak = 0;
  for (const run of runs) {
    if (run.overallStatus === "failure") failureStreak += 1;
    else break;
  }

  return {
    sample,
    successRate,
    finishedCount: finished.length,
    successes,
    failures,
    running,
    worstStage,
    failureStreak,
    outcomes: runs.map((run) => run.overallStatus),
  };
}

/* ── Success-rate ring — single SVG, count-up drives the arc ───────────────── */

function SuccessRing({
  value,
  display,
  reduced,
}: Readonly<{
  value: number | null;
  display: number | null;
  reduced: boolean | null;
}>) {
  const pct = display ?? 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    value === null
      ? "var(--text-muted)"
      : pct >= 80
        ? "var(--success)"
        : pct >= 50
          ? "var(--accent-amber)"
          : "var(--danger)";
  return (
    <div className="ops-ring">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="ops-ring-bg" cx="32" cy="32" r={radius} />
        <circle
          className="ops-ring-fg"
          cx="32"
          cy="32"
          r={radius}
          style={{
            stroke: color,
            strokeDasharray: circumference,
            strokeDashoffset: value === null ? circumference : offset,
            transition: reduced ? "none" : "stroke-dashoffset 0.12s linear",
          }}
        />
      </svg>
      <span className="ops-ring-val" style={{ color }}>
        {value === null ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

/* ── Sparkline of recent run outcomes (oldest → newest, left → right) ───────── */

function RunSparkline({
  outcomes,
  reduced,
}: Readonly<{ outcomes: RunOverallStatus[]; reduced: boolean | null }>) {
  if (!outcomes.length) {
    return <p className="ops-empty">Outcomes appear after your first run.</p>;
  }
  const bars = outcomes.slice(0, 14).reverse();
  return (
    <div
      className="ops-spark"
      role="img"
      aria-label={`Last ${bars.length} run outcomes, oldest to newest`}
    >
      {bars.map((outcome, index) => (
        <motion.span
          key={index}
          className={`ops-spark-bar ops-spark-bar--${outcome}`}
          title={outcome}
          initial={reduced ? false : { scaleY: 0.15, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            delay: reduced ? 0 : index * 0.028,
            duration: 0.32,
            ease: EASE_OUT,
          }}
        />
      ))}
    </div>
  );
}

/* ── Ops insight rail — the "genuinely useful operational content" ─────────── */

function OpsInsightRail({
  stats,
  loading,
  reduced,
}: Readonly<{ stats: RunStats; loading: boolean; reduced: boolean | null }>) {
  const animatedRate = useCountUp(
    reduced || loading || stats.successRate === null ? null : stats.successRate,
    800,
  );
  const displayRate =
    stats.successRate === null
      ? null
      : reduced
        ? stats.successRate
        : (animatedRate ?? stats.successRate);

  return (
    <aside className="ops-rail" aria-label="Pipeline health insights">
      <div className="ops-ring-card">
        <SuccessRing
          value={loading ? null : stats.successRate}
          display={displayRate}
          reduced={reduced}
        />
        <div className="ops-ring-copy">
          <strong>Success rate</strong>
          <small>
            {stats.finishedCount
              ? `Last ${stats.finishedCount} finished run${stats.finishedCount === 1 ? "" : "s"}`
              : "Awaiting first finished run"}
          </small>
        </div>
      </div>

      <div className="ops-block">
        <span className="ops-block-label">Recent outcomes</span>
        <RunSparkline outcomes={stats.outcomes} reduced={reduced} />
      </div>

      <div className="ops-stat-grid">
        <div className="ops-stat">
          <span className="ops-stat-num">
            {stats.worstStage
              ? RUN_STAGE_LABELS[stats.worstStage.stage]
              : "None"}
          </span>
          <span className="ops-stat-label">Most-failing stage</span>
        </div>
        <div className="ops-stat">
          <span
            className={`ops-stat-num${stats.failureStreak > 0 ? " ops-stat-num--danger" : ""}`}
          >
            {stats.failureStreak}
          </span>
          <span className="ops-stat-label">Failure streak</span>
        </div>
      </div>

      <div className="ops-shortcuts">
        <span className="ops-block-label">Keyboard</span>
        <div className="ops-shortcuts-keys">
          {quickActions.map((action) => (
            <span key={action.cmd} className="ops-kbd-row">
              <kbd className="ops-kbd">{action.shortcut}</kbd>
              <span className="ops-kbd-desc">{action.display}</span>
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ── Run activity card — the star: animated per-stage pipeline ─────────────── */

const runListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const runCardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
};

function RunActivityCard({
  run,
  reduced,
  featured = false,
}: Readonly<{ run: RunGroup; reduced: boolean | null; featured?: boolean }>) {
  const repoShort = shortRepoName(run.repoFullName);
  const stageMap = new Map(run.stages.map((stage) => [stage.stage, stage]));
  const stageSummary = RUN_STAGE_ORDER.map(
    (stage) =>
      `${RUN_STAGE_LABELS[stage]} ${stageMap.get(stage)?.status ?? "pending"}`,
  ).join(", ");

  return (
    <motion.div
      className={`run-card run-card--${run.overallStatus}${featured ? " run-card--featured" : ""}`}
      variants={reduced ? undefined : runCardVariants}
    >
      <Link
        href="/runs"
        className="run-card-link"
        aria-label={`Run for ${repoShort} on ${run.branch}, ${run.overallStatus}. ${stageSummary}. Started ${timeAgo(run.startedAt)}. View run details.`}
      >
        <span className="run-card-accent" aria-hidden="true" />
        <div className="run-card-top">
          <span className="run-card-id">
            <span className="run-card-repo">{repoShort}</span>
            <span className="run-card-branch">@{run.branch}</span>
          </span>
          <span className={`run-status-pill run-status-pill--${run.overallStatus}`}>
            {run.overallStatus === "running" && (
              <span className="run-status-live" aria-hidden="true" />
            )}
            {run.overallStatus}
          </span>
        </div>

        <div className="run-card-pipeline" aria-hidden="true">
          {RUN_STAGE_ORDER.map((stage, index) => {
            const status = stageMap.get(stage)?.status ?? "pending";
            const prevStatus =
              index > 0
                ? (stageMap.get(RUN_STAGE_ORDER[index - 1])?.status ?? "pending")
                : null;
            return (
              <Fragment key={stage}>
                {index > 0 && (
                  <span
                    className={`run-conn${prevStatus === "success" ? " run-conn--active" : ""}${
                      prevStatus === "success" && status === "running"
                        ? " run-conn--flowing"
                        : ""
                    }`}
                  />
                )}
                <span className="run-stage">
                  <span
                    className={`run-stage-dot pipeline-dot pipeline-dot--${status}`}
                  />
                  <span className="run-stage-label">
                    {RUN_STAGE_LABELS[stage]}
                  </span>
                </span>
              </Fragment>
            );
          })}
        </div>

        <div className="run-card-foot">
          <span className="run-card-time">{timeAgo(run.startedAt)}</span>
          <span className="run-card-sha">{run.commitSha.slice(0, 7)}</span>
          <span className="run-card-cta">
            View
            <svg
              width="11"
              height="11"
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
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function RunCardSkeleton() {
  return (
    <div className="run-card run-card--skeleton" aria-hidden="true">
      <div className="run-card-link">
        <div className="run-card-top">
          <span className="run-skel run-skel--repo" />
          <span className="run-skel run-skel--pill" />
        </div>
        <div className="run-skel run-skel--track" />
        <div className="run-skel run-skel--foot" />
      </div>
    </div>
  );
}

/* ── Pipeline Activity — dedicated hero section for runs ────────────────────── */

function PipelineActivity({
  runs,
  stats,
  loading,
  reduced,
}: Readonly<{
  runs: RunGroup[];
  stats: RunStats;
  loading: boolean;
  reduced: boolean | null;
}>) {
  const latest = runs[0] ?? null;
  return (
    <motion.section
      className="runs-hero"
      aria-labelledby="runs-hero-title"
      custom={3}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <div className="dashboard-panel-heading runs-hero-heading">
        <div>
          <p className="dashboard-section-kicker">PIPELINE ACTIVITY</p>
          <h2 id="runs-hero-title">Latest run</h2>
        </div>
        <div className="runs-hero-heading-right">
          {stats.running > 0 && (
            <span className="runs-live-badge">
              <span className="runs-live-dot" aria-hidden="true" />
              {stats.running} running
            </span>
          )}
          <Link href="/runs" className="dashboard-inline-link">
            {runs.length > 0
              ? `View all ${runs.length} run${runs.length === 1 ? "" : "s"}`
              : "View runs"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className="runs-hero-body">
        <motion.div
          className="runs-stream"
          variants={reduced ? undefined : runListVariants}
          initial={reduced ? undefined : "hidden"}
          animate={reduced ? undefined : "visible"}
        >
          {loading ? (
            <RunCardSkeleton />
          ) : latest ? (
            <RunActivityCard run={latest} reduced={reduced} featured />
          ) : (
            <Link href="/workflows?tab=setup" className="runs-empty">
              <span className="runs-empty-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span>
                <strong>No runs yet</strong>
                <small>
                  Push to a provisioned repository and its access → quality →
                  package stages stream here live.
                </small>
              </span>
              <span className="dashboard-row-arrow" aria-hidden="true">→</span>
            </Link>
          )}
        </motion.div>

        <OpsInsightRail stats={stats} loading={loading} reduced={reduced} />
      </div>
    </motion.section>
  );
}

/* ── Get-started journey — shown when the workspace is effectively empty ────── */

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GetStartedJourney({
  projects,
  runs,
  historyCount,
  reduced,
}: Readonly<{
  projects: ProvisionedProject[];
  runs: RunGroup[];
  historyCount: number;
  reduced: boolean | null;
}>) {
  const hasProjects = projects.length > 0;
  const hasProvisioned = projects.some(
    (project) => project.status === "provisioned",
  );
  const hasWorkflow = historyCount > 0 || hasProvisioned;
  const hasRuns = runs.length > 0;

  const steps: Array<{
    title: string;
    desc: string;
    done: boolean;
    href?: string;
    cta?: string;
  }> = [
    {
      title: "Create a project",
      desc: "Name a service and pick what its pipeline should check.",
      done: hasProjects,
      href: "/workflows?tab=setup",
      cta: "Create a project",
    },
    {
      title: "Connect a repository",
      desc: "Link a GitHub repo — ALPHACI writes the Actions workflow into it.",
      done: hasProvisioned,
      href: "/workflows?tab=setup",
      cta: "Connect a repo",
    },
    {
      title: "Pipeline generated",
      desc: "Access, quality and package stages are committed to your repo.",
      done: hasWorkflow,
      href: "/workflows?tab=current",
      cta: "View workflows",
    },
    {
      title: "Push code, watch it run",
      desc: "Every push streams live per-stage status straight to your dashboard.",
      done: hasRuns,
      href: "/runs",
      cta: "Open runs",
    },
    {
      title: "Monitor & iterate",
      desc: "Track success rate, catch failing stages, and tune your pipeline.",
      done: false,
      href: "/guide",
      cta: "Read the guide",
    },
  ];

  const currentIndex = steps.findIndex((step) => !step.done);
  const activeIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;
  const completed = steps.filter((step) => step.done).length;

  return (
    <motion.section
      className="getstarted"
      aria-labelledby="getstarted-title"
      custom={2}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <div className="getstarted-intro">
        <p className="dashboard-section-kicker">GET STARTED</p>
        <h2 id="getstarted-title">Ship your first pipeline</h2>
        <p className="getstarted-lede">
          Your workspace is a clean slate. Follow the path below — each push you
          make will light up live here.
        </p>
        <div className="getstarted-progress" aria-hidden="true">
          <span className="getstarted-progress-bar">
            <motion.span
              className="getstarted-progress-fill"
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: completed / steps.length }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
            />
          </span>
          <span className="getstarted-progress-label">
            {completed} of {steps.length}
          </span>
        </div>
      </div>

      <ol className="getstarted-steps">
        {steps.map((step, index) => {
          const isCurrent = index === activeIndex && !step.done;
          return (
            <motion.li
              key={step.title}
              className={`getstarted-step${step.done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.35,
                ease: EASE_OUT,
                delay: reduced ? 0 : 0.1 + index * 0.08,
              }}
            >
              <span className="getstarted-node" aria-hidden="true">
                {step.done ? <CheckMark /> : index + 1}
              </span>
              <div className="getstarted-copy">
                <strong>{step.title}</strong>
                <small>{step.desc}</small>
                {isCurrent && step.href ? (
                  <Link href={step.href} className="getstarted-cta">
                    {step.cta}
                    <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
              </div>
              <span className="getstarted-state" aria-hidden="true">
                {step.done ? "Done" : isCurrent ? "Now" : ""}
              </span>
            </motion.li>
          );
        })}
      </ol>

      <div className="getstarted-resources">
        <span className="ops-block-label">Resources</span>
        <div className="getstarted-resource-links">
          <Link href="/workflows?tab=setup">Create a project</Link>
          <Link href="/runs">View runs</Link>
          <Link href="/guide">Read the guide</Link>
        </div>
      </div>
    </motion.section>
  );
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
  groups,
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
  groups: GroupSummary[];
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

  const scopeDescription = group
    ? group.description ?? group.businessUnit ?? "Team delivery workspace"
    : "Your provisioned projects and assigned delivery work";

  const runStats = useMemo(() => computeRunStats(runs), [runs]);

  // "Effectively empty" — nothing to operate on yet. Show a guided journey
  // instead of a grid of zeros. Derived entirely from real data.
  const isEmptyWorkspace =
    !loading &&
    projects.length === 0 &&
    runs.length === 0 &&
    deliveryProjectCount === 0;

  const primaryTone = attentionItems.some((item) => item.tone === "danger")
    ? "danger"
    : attentionItems.length
      ? "warn"
      : "ok";

  return (
    <div className={`dashboard-flow${isEmptyWorkspace ? " dashboard-flow--empty" : ""}`}>
      {/* Merged status strip — scope + attention on one compact row */}
      <motion.section
        className="dashboard-statusbar"
        aria-label="Workspace status"
        custom={1}
        variants={sectionVariants}
        initial={reduced ? false : "hidden"}
        animate="visible"
      >
        <div className="statusbar-scope">
          <span
            className={`statusbar-dot statusbar-dot--${loading ? "idle" : primaryTone}`}
            aria-hidden="true"
          />
          <div className="statusbar-scope-copy">
            <span className="statusbar-scope-label">
              {group ? group.name : "Personal workspace"}
            </span>
            <span className="statusbar-scope-sub">
              {group
                ? `${readableGroupRole(group.role)} · ${scopeDescription}`
                : scopeDescription}
            </span>
          </div>
          {group ? (
            <Link
              href={`/groups/${group.id}`}
              className="dashboard-inline-link statusbar-scope-link"
            >
              Open <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>

        <div className="statusbar-attention" role="status">
          {loading ? (
            <span className="statusbar-allclear statusbar-allclear--idle">
              Refreshing signals…
            </span>
          ) : attentionItems.length ? (
            attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`statusbar-chip statusbar-chip--${item.tone}`}
                title={item.detail}
              >
                <span className="statusbar-chip-dot" aria-hidden="true" />
                {item.label}
                <span aria-hidden="true">→</span>
              </Link>
            ))
          ) : (
            <span className="statusbar-allclear">
              <span className="statusbar-chip-dot" aria-hidden="true" />
              All systems operational
            </span>
          )}
        </div>
      </motion.section>

      {isEmptyWorkspace ? (
        <GetStartedJourney
          projects={projects}
          runs={runs}
          historyCount={workflowHistoryCount}
          reduced={reduced}
        />
      ) : (
        <>
          <motion.section
            className="dashboard-metrics dashboard-metrics--slim"
            aria-label="Workspace metrics"
            custom={2}
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

          <div className="dashboard-main-grid">
            <PipelineActivity
              runs={runs}
              stats={runStats}
              loading={loading}
              reduced={reduced}
            />

            <div className="dashboard-side-col">
              <motion.section
                className="dashboard-panel dashboard-panel--scroll"
                aria-labelledby="teams-title"
                custom={4}
                variants={sectionVariants}
                initial={reduced ? false : "hidden"}
                animate="visible"
              >
                <div className="dashboard-panel-heading">
                  <div><p className="dashboard-section-kicker">MY TEAMS</p><h2 id="teams-title">Teams</h2></div>
                  {groups.length ? <Link href="/groups" className="dashboard-inline-link">All <span aria-hidden="true">→</span></Link> : null}
                </div>
                <div className="dashboard-panel-scroll">
                  {loading ? (
                    <p className="dashboard-empty">Loading teams…</p>
                  ) : groups.length ? (
                    <div className="dashboard-teams-list">
                      {groups.map((teamGroup) => (
                        <Link
                          key={teamGroup.id}
                          href={`/groups/${teamGroup.id}`}
                          className={`dashboard-team-row${teamGroup.id === group?.id ? " is-current" : ""}`}
                        >
                          <span className="dashboard-team-mark" aria-hidden="true" />
                          <span>
                            <strong>{teamGroup.name}</strong>
                            <small>{readableGroupRole(teamGroup.role)} · {teamGroup.memberCount} member{teamGroup.memberCount === 1 ? "" : "s"}</small>
                          </span>
                          <span className="dashboard-row-arrow" aria-hidden="true">→</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="dashboard-empty">You&apos;re in a personal workspace — no teams yet.</p>
                  )}
                </div>
              </motion.section>

              <motion.section
                className="dashboard-panel dashboard-panel--scroll"
                aria-labelledby="delivery-overview-title"
                custom={5}
                variants={sectionVariants}
                initial={reduced ? false : "hidden"}
                animate="visible"
              >
                <div className="dashboard-panel-heading">
                  <div>
                    <p className="dashboard-section-kicker">DELIVERY OVERVIEW</p>
                    <h2 id="delivery-overview-title">{group ? "Delivery structure" : "Active projects"}</h2>
                  </div>
                  <Link href={group ? `/groups/${group.id}/systems` : "/workflows?tab=current"} className="dashboard-inline-link">All <span aria-hidden="true">→</span></Link>
                </div>
                <div className="dashboard-panel-scroll">
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
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="dashboard-project-list">
                      {projects.slice(0, 6).map((project) => (
                        <Link key={project.id} href="/workflows?tab=current" className="dashboard-project-row">
                          <span><strong>{shortRepoName(project.repoFullName)}</strong><small>{project.serviceName}</small></span>
                          <span className={`dashboard-status dashboard-status--${project.status}`}>{project.status}</span>
                        </Link>
                      ))}
                      {!projects.length ? <p className="dashboard-empty">No projects in this workspace yet.</p> : null}
                    </div>
                  )}
                </div>
              </motion.section>

              <motion.section
                className="dashboard-panel dashboard-panel--scroll dashboard-panel--activity"
                aria-labelledby="recent-activity-title"
                custom={6}
                variants={sectionVariants}
                initial={reduced ? false : "hidden"}
                animate="visible"
              >
                <div className="dashboard-panel-heading">
                  <div><p className="dashboard-section-kicker">WORKSPACE ACTIVITY</p><h2 id="recent-activity-title">Recent activity</h2></div>
                  {group ? <Link href={`/groups/${group.id}/activity`} className="dashboard-inline-link">Open <span aria-hidden="true">→</span></Link> : null}
                </div>
                <div className="dashboard-panel-scroll">
                  {activity.length ? <div className="dashboard-activity-list">{activity.slice(0, 8).map((item) => (
                    <div className="dashboard-activity-row" key={item.id}>
                      <span className="dashboard-activity-dot" aria-hidden="true" />
                      <span><strong>{item.message}</strong><small>{item.actorLabel} · {timeAgo(item.createdAt)}</small></span>
                    </div>
                  ))}</div> : <p className="dashboard-empty">{group && !isGroupManagerRole(group.role) ? "Team activity is available to group leads." : "No recent activity in this workspace."}</p>}
                </div>
              </motion.section>
            </div>
          </div>
        </>
      )}
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
  const [recentRuns, setRecentRuns] = useState<RunGroup[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  // Welcome modal: shown once for new users (onboardingCompleted === false).
  // Local flag dismisses immediately without waiting for a network response.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<GroupSummary | null>(null);
  // Full team/group list for the "My teams" panel (getMyGroups items).
  const [groups, setGroups] = useState<GroupSummary[]>([]);
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
        setRecentRuns(response.runs);
      })
      .catch(() => {
        setRecentRuns([]);
      })
      .finally(() => setRunsLoading(false));
  }

  function loadWorkspaceOverview() {
    setWorkspaceOverviewLoading(true);
    setWorkspaceOverviewError(null);

    Promise.all([getMyGroups(), getMyAssignedRepositories()])
      .then(async ([groupsResponse, assignmentsResponse]) => {
        setGroups(groupsResponse.items);
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
        setGroups([]);
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
      className="dash-shell dashboard-shell dashboard-shell--fit"
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
        {/* ── Compact welcome header — single row, no latest-run widget ── */}
        <motion.section
          className="welcome-banner-flat home-header"
          aria-label="Welcome"
          custom={0}
          variants={sectionVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
        >
          <div className="welcome-banner-flat-accent" aria-hidden="true" />

          <div className="home-header-row">
            <div className="home-header-id">
              {!guest &&
                (session?.user.avatarUrl ? (
                  <Image
                    src={session.user.avatarUrl}
                    alt={session.user.name ?? session.user.login}
                    className="home-header-avatar"
                    width={40}
                    height={40}
                    unoptimized
                  />
                ) : (
                  <span className="home-header-avatar home-header-avatar--fallback" aria-hidden="true">
                    {avatarInitial}
                  </span>
                ))}
              <div className="home-header-copy">
                <p className="home-header-eyebrow">SYSTEM.DASHBOARD</p>
                <h1 className="home-header-title">
                  {guest
                    ? "ALPHACI Dashboard"
                    : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
                </h1>
              </div>
            </div>

            <div className="home-header-actions">
              {guest ? (
                <>
                  <Link className="primary-button home-header-btn" href="/signup">
                    Sign up free
                  </Link>
                  <Link className="ghost-button home-header-btn" href="/login">
                    Log in
                  </Link>
                </>
              ) : (
                <>
                  <button
                    className="ghost-button home-header-btn"
                    type="button"
                    onClick={refreshDashboard}
                  >
                    Refresh
                  </button>
                  <Link className="primary-button home-header-btn" href="/workflows?tab=setup">
                    Create project
                  </Link>
                </>
              )}
            </div>
          </div>

          {error ? <p className="error-text home-header-msg">{error}</p> : null}
          {logoutMessage ? (
            <p className="error-text home-header-msg">{logoutMessage}</p>
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
          groups={groups}
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
