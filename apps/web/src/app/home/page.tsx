"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
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
  StageStatus,
} from "@/lib/api/contracts";
import {
  isGroupManagerRole,
  type DeliveryProject,
  type GroupActivityItem,
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

type ProjectTone = "ok" | "warn" | "danger" | "muted";

/** Map a provisioned-project status to a status-badge tone + friendly label. */
function projectTone(status: ProvisionedProject["status"]): ProjectTone {
  if (status === "provisioned") return "ok";
  if (status === "provisioning") return "warn";
  if (status === "failed") return "danger";
  return "muted"; // orphaned
}

function projectBadgeLabel(status: ProvisionedProject["status"]): string {
  if (status === "provisioned") return "Active";
  if (status === "provisioning") return "Provisioning";
  if (status === "failed") return "Failed";
  return "Idle"; // orphaned
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

function KeyboardShortcuts({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <motion.section
      className="dashboard-shortcuts"
      aria-label="Keyboard shortcuts"
      custom={3}
      variants={sectionVariants}
      initial={reduced ? false : "hidden"}
      animate="visible"
    >
      <span className="dashboard-shortcuts-label">Keyboard shortcuts</span>
      <div className="dashboard-shortcuts-keys">
        {quickActions.map((action) => (
          <span key={action.cmd} className="dashboard-shortcut">
            <kbd>{action.shortcut}</kbd>
            <span>{action.display}</span>
          </span>
        ))}
      </div>
    </motion.section>
  );
}

/* ── Run activity card — the star: a full-width horizontal pipeline track ───── */

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

type ConnectorTone = "success" | "danger" | "flowing" | "pending";

/** Colour a connector segment from the stages it links: green while progress
 *  holds, red into a failing stage, an animated flow into a running stage. */
function connectorTone(prev: StageStatus, next: StageStatus): ConnectorTone {
  if (next === "failure") return "danger";
  if (prev === "success" && next === "success") return "success";
  if (prev === "success" && next === "running") return "flowing";
  return "pending";
}

function RunActivityCard({
  run,
  reduced,
  featured = false,
}: Readonly<{ run: RunGroup; reduced: boolean | null; featured?: boolean }>) {
  const repoShort = shortRepoName(run.repoFullName);
  const stageMap = new Map(run.stages.map((stage) => [stage.stage, stage]));
  const stages = RUN_STAGE_ORDER.map((stage) => ({
    id: stage,
    status: (stageMap.get(stage)?.status ?? "pending") as StageStatus,
  }));
  const stageSummary = stages
    .map((stage) => `${RUN_STAGE_LABELS[stage.id]} ${stage.status}`)
    .join(", ");

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

        <div className="run-card-main">
          <div className="run-card-head">
            <span className="run-card-repo">{repoShort}</span>
            <span className="run-card-branch-pill">{run.branch}</span>
            {run.overallStatus === "running" ? (
              <span className="run-status-live" aria-hidden="true" />
            ) : null}
          </div>

          <div className="run-track" aria-hidden="true">
            <span className="run-track-cap">{RUN_STAGE_LABELS.access}</span>
            <div className="run-track-line">
              {stages.map((stage, index) => {
                const seg =
                  index > 0
                    ? connectorTone(stages[index - 1].status, stage.status)
                    : null;
                return (
                  <Fragment key={stage.id}>
                    {seg ? (
                      <span
                        className={`run-track-seg run-track-seg--${seg}`}
                      />
                    ) : null}
                    <span
                      className={`run-track-dot pipeline-dot pipeline-dot--${stage.status}`}
                    />
                  </Fragment>
                );
              })}
            </div>
            <span className="run-track-cap">{RUN_STAGE_LABELS.package}</span>
          </div>

          <div className="run-card-foot">
            <span className="run-card-time">{timeAgo(run.startedAt)}</span>
            <span className="run-card-sha">{run.commitSha.slice(0, 7)}</span>
          </div>
        </div>

        <div className="run-card-side">
          <span className={`run-status-word run-status-word--${run.overallStatus}`}>
            {run.overallStatus}
          </span>
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
        <div className="run-card-main">
          <div className="run-card-head">
            <span className="run-skel run-skel--repo" />
          </div>
          <div className="run-skel run-skel--track" />
          <div className="run-skel run-skel--foot" />
        </div>
        <span className="run-skel run-skel--pill" />
      </div>
    </div>
  );
}

/* ── Pipeline Activity — the animated runs hero ─────────────────────────────── */

interface AttentionItem {
  tone: string;
  label: string;
  detail: string;
  href: string;
}

function PipelineActivity({
  runs,
  stats,
  loading,
  reduced,
  attentionItems,
}: Readonly<{
  runs: RunGroup[];
  stats: RunStats;
  loading: boolean;
  reduced: boolean | null;
  attentionItems: AttentionItem[];
}>) {
  const runningCount = stats.running;
  const latest = runs[0] ?? null;
  const rest = runs.slice(1, 4);

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
          <h2 id="runs-hero-title">Latest runs</h2>
        </div>
        <div className="runs-hero-heading-right">
          {runningCount > 0 ? (
            <span className="runs-live-badge">
              <span className="runs-live-dot" aria-hidden="true" />
              {runningCount} running
            </span>
          ) : null}
          <Link href="/runs" className="dashboard-inline-link">
            {runs.length ? `View all ${runs.length} runs` : "Open runs"}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {/* Operational signal folded in from the retired scope banner:
         the one line answering "is anything wrong?". */}
      <div className="runs-hero-status" role="status">
        {loading ? (
          <span className="runs-hero-signal runs-hero-signal--idle">
            Refreshing signals…
          </span>
        ) : attentionItems.length ? (
          attentionItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`runs-hero-chip runs-hero-chip--${item.tone}`}
              title={item.detail}
            >
              <span className="runs-hero-chip-dot" aria-hidden="true" />
              {item.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))
        ) : (
          <span className="runs-hero-signal">
            <span className="runs-hero-chip-dot" aria-hidden="true" />
            All systems operational
          </span>
        )}
      </div>

      {loading ? (
        <div className="runs-stream">
          <RunCardSkeleton />
          <RunCardSkeleton />
        </div>
      ) : latest ? (
        <motion.div
          className="runs-stream"
          variants={reduced ? undefined : runListVariants}
          initial={reduced ? false : "hidden"}
          animate="visible"
        >
          <RunActivityCard run={latest} reduced={reduced} featured />
          {rest.map((run) => (
            <RunActivityCard key={run.runId} run={run} reduced={reduced} />
          ))}
        </motion.div>
      ) : (
        <div className="runs-stream">
          <Link href="/workflows?tab=setup" className="runs-empty">
            <span className="runs-empty-icon" aria-hidden="true">
              <QuickActionRunIcon />
            </span>
            <span>
              <strong>No runs yet</strong>
              <small>
                Push to a provisioned repository and its per-stage status
                streams in here live.
              </small>
            </span>
            <span className="dashboard-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      )}

      {/* Recent outcomes sparkline pinned at the foot of the hero. */}
      <div className="runs-outcomes ops-block">
        <span className="ops-block-label">Recent outcomes</span>
        <RunSparkline outcomes={stats.outcomes} reduced={reduced} />
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

/** Container-less metric cell: a quiet mono figure on a hairline, not a card. */
function DashboardMetric({
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

function DashboardWorkspaceOverview({
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
            <DashboardMetric value={workflowHistoryCount} label="Workflows" loading={loading} reduced={reduced} href="/workflows?tab=all" />
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
  const [portfolio, setPortfolio] = useState<DeliveryPortfolioNode[]>([]);
  const [assignments, setAssignments] = useState<MyAssignedRepository[]>([]);
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
          const nextActivity = await getGroupActivity(group.id, { limit: 4 });
          setActivity(nextActivity.items);
        } else {
          setActivity([]);
        }
      })
      .catch(() => {
        setCurrentGroup(null);
        setPortfolio([]);
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
          portfolio={portfolio}
          assignments={assignments}
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
