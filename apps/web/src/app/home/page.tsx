"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  logout,
  getProjects,
  getWorkflowHistory,
  getGithubRepos,
  disconnectProject,
  syncProjects,
} from "@/lib/api/client";
import { completeOnboarding } from "@/lib/api/auth";
import { getRuns } from "@/lib/api/runs";
import type {
  ProvisionedProject,
  WorkflowHistoryItem,
  GitHubRepo,
  RunGroup,
  StageId,
} from "@/lib/api/contracts";
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

/**
 * Build the sequence of page controls for a numbered pager. Small page counts
 * list every page (1 2 3 4 …); larger ones collapse the middle to an ellipsis
 * so the control never grows past first · … · window · … · last.
 */
function buildPageItems(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Repository entry helpers (GitHub-style list rows) ───────────────────────
 * Stack dot colors follow GitHub's language-color convention. Unknown catalog
 * ids fall back to a prettified label with the brand color.
 */
const PROJECT_TYPE_META: Record<string, { label: string; color: string }> = {
  "nextjs-app": { label: "Next.js", color: "#3178c6" },
  "react-app": { label: "React", color: "#61dafb" },
  "node-service": { label: "Node.js", color: "#3c873a" },
  "nestjs-api": { label: "NestJS", color: "#e0234e" },
  "express-api": { label: "Express", color: "#3c873a" },
};

function projectTypeMeta(id: string | null | undefined): {
  label: string;
  color: string;
} {
  if (!id) return { label: "Unknown stack", color: "var(--text-muted)" };
  const known = PROJECT_TYPE_META[id];
  if (known) return known;
  const label = id
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { label, color: "var(--brand)" };
}

function GitHubMarkIcon() {
  return (
    <svg
      className="repo-entry-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
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

type DashTab = "overview" | "repositories" | "activity";
type RepositoryStatusFilter = "all" | "provisioned" | "orphaned";

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

/* ── Page ───────────────────────────────────────────────────────────────────── */

function HomeDashboardContent() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const { selectedWorkspaceId } = useWorkspaceSelection();
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<RunGroup | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  // Hide the header widget entirely if /ci/runs is unavailable (feature off).
  const [runsAvailable, setRunsAvailable] = useState(true);
  const [repoQuery, setRepoQuery] = useState("");
  const [repoStatusFilter, setRepoStatusFilter] =
    useState<RepositoryStatusFilter>("all");
  const [repoPage, setRepoPage] = useState(1);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(
    null,
  );
  // Opt-in "also delete the GitHub repo" checkbox + type-to-confirm input,
  // scoped to whichever row is currently in confirm mode.
  const [deleteGithubRepoOptIn, setDeleteGithubRepoOptIn] = useState(false);
  const [confirmRepoNameInput, setConfirmRepoNameInput] = useState("");
  // Post-disconnect outcome banner. Rendered at the section level (not per
  // row) since the row itself is removed from `projects` once disconnected.
  const [disconnectOutcome, setDisconnectOutcome] = useState<{
    repoFullName: string;
    kind: "github-deleted" | "github-delete-failed" | "missing-scope";
    message?: string;
  } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [repositoryActionError, setRepositoryActionError] = useState<
    string | null
  >(null);
  const [syncResult, setSyncResult] = useState<{
    orphaned: number;
    reachable: number;
    total: number;
  } | null>(null);
  // Welcome modal: shown once for new users (onboardingCompleted === false).
  // Local flag dismisses immediately without waiting for a network response.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showProvisionedProjects = true as boolean;

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

  function loadRepos() {
    setReposLoading(true);
    setReposError(null);
    getGithubRepos()
      .then((response) => {
        setRepos(response.repos);
        setReposError(null);
      })
      .catch(() => setReposError("Could not load GitHub repositories."))
      .finally(() => setReposLoading(false));
  }

  function loadLatestRun() {
    setRunsLoading(true);
    getRuns()
      .then((response) => {
        setLatestRun(response.runs[0] ?? null);
        setRunsAvailable(true);
      })
      .catch(() => {
        setLatestRun(null);
        setRunsAvailable(false);
      })
      .finally(() => setRunsLoading(false));
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
    loadRepos();
    loadLatestRun();
    // Intentionally re-run only on auth/workspace change, not on loader identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedWorkspaceId]);

  useEffect(() => {
    if (activeTab !== "repositories") return;
    void (async () => {
      try {
        await syncProjects();
        const updated = await getProjects(25, {
          workspaceId: selectedWorkspaceId,
        });
        setProjects(updated.items);
      } catch {
        // silently ignore — the manual "Sync with GitHub" button is still available
      }
    })();
  }, [activeTab, selectedWorkspaceId]);

  useEffect(() => {
    setRepoPage(1);
  }, [repoQuery, repoStatusFilter]);

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

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    setRepositoryActionError(null);
    try {
      const result = await syncProjects();
      setSyncResult(result);
      const updated = await getProjects(25, {
        workspaceId: selectedWorkspaceId,
      });
      setProjects(updated.items);
    } catch {
      setRepositoryActionError(
        "GitHub sync failed. Check the connection and try again.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function resetDisconnectConfirm() {
    setConfirmDisconnectId(null);
    setDeleteGithubRepoOptIn(false);
    setConfirmRepoNameInput("");
  }

  async function handleDisconnect(project: ProvisionedProject) {
    setDisconnectingId(project.id);
    setRepositoryActionError(null);
    setDisconnectOutcome(null);
    try {
      const result = await disconnectProject(
        project.id,
        deleteGithubRepoOptIn
          ? {
              deleteGithubRepo: true,
              confirmRepoName: project.repoFullName,
            }
          : undefined,
      );
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      resetDisconnectConfirm();
      if (deleteGithubRepoOptIn) {
        if (result.githubRepoDeleted) {
          setDisconnectOutcome({
            repoFullName: project.repoFullName,
            kind: "github-deleted",
          });
        } else if (result.githubRepoDeleteError?.code === "missing_scope") {
          setDisconnectOutcome({
            repoFullName: project.repoFullName,
            kind: "missing-scope",
          });
        } else {
          setDisconnectOutcome({
            repoFullName: project.repoFullName,
            kind: "github-delete-failed",
            message: result.githubRepoDeleteError?.message,
          });
        }
      }
    } catch {
      setRepositoryActionError(
        "The project could not be disconnected. Please try again.",
      );
    } finally {
      setDisconnectingId(null);
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
    loadRepos();
    loadLatestRun();
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function projectStatusChipClass(status: string) {
    if (status === "provisioned") return "status-chip status-chip-success";
    if (status === "failed") return "status-chip status-chip-danger";
    if (status === "orphaned") return "status-chip status-chip-amber";
    return "status-chip status-chip-brand";
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

  const normalizedRepoQuery = repoQuery.trim().toLowerCase();
  const projectStatusByRepo = new Map(
    projects.map((project) => [project.repoFullName.toLowerCase(), project.status]),
  );
  const projectIdByRepo = new Map(
    projects.map((project) => [project.repoFullName.toLowerCase(), project.id]),
  );
  const statusFilteredRepos =
    repoStatusFilter === "all"
      ? repos
      : repos.filter(
          (repo) =>
            projectStatusByRepo.get(repo.fullName.toLowerCase()) ===
            repoStatusFilter,
        );
  const filteredRepos = normalizedRepoQuery
    ? statusFilteredRepos.filter(
        (repo) =>
          repo.fullName.toLowerCase().includes(normalizedRepoQuery) ||
          (repo.description ?? "").toLowerCase().includes(normalizedRepoQuery),
      )
    : statusFilteredRepos;
  const reposPerPage = 6;
  const repoPageCount = Math.max(1, Math.ceil(filteredRepos.length / reposPerPage));
  const paginatedRepos = filteredRepos.slice(
    (repoPage - 1) * reposPerPage,
    repoPage * reposPerPage,
  );
  const repoPageItems = buildPageItems(repoPage, repoPageCount);

  const uniqueServices = new Set(history.map((h) => h.serviceName)).size;

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

      <div id="main-content" className="dash-page-content">
        {/* ── Welcome header — flat, no outer panel box ─────────────── */}
        <motion.section
          className="welcome-banner-flat"
          aria-label="Welcome"
          custom={0}
          variants={sectionVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
          style={{ marginBottom: "0.75rem" }}
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
                    fontSize: "clamp(1.15rem, 1.9vw, 1.45rem)",
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

        {/* ── Dashboard tab bar ─────────────────────────────────────── */}
        <motion.div
          custom={1}
          variants={sectionVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div
            className="dash-tab-bar"
            role="tablist"
            aria-label="Dashboard sections"
            style={{
              position: "relative",
              display: "flex",
              gap: "0.25rem",
              padding: "0.25rem",
              background: "rgba(17, 17, 22, 0.4)",
              border: "1px solid var(--border-soft)",
              borderRadius: "0.6rem",
              width: "fit-content",
            }}
          >
            {(["overview", "repositories", "activity"] as DashTab[]).map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`dash-tab-${tab}`}
                  aria-controls={`dash-panel-${tab}`}
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    position: "relative",
                    padding: "0.45rem 1.2rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    transition: "color 0.2s ease",
                    color:
                      activeTab === tab
                        ? "var(--text-primary)"
                        : "var(--text-secondary)",
                    zIndex: 1,
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    fontFamily: "inherit",
                  }}
                >
                  {activeTab === tab && (
                    <motion.span
                      layoutId="dash-tab-indicator"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "0.4rem",
                        background: "rgba(88, 166, 255, 0.1)",
                        border: "1px solid rgba(88, 166, 255, 0.3)",
                        boxShadow: "0 0 12px rgba(88, 166, 255, 0.15)",
                        zIndex: -1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                  {tab === "overview"
                    ? "Overview"
                    : tab === "repositories"
                      ? "Repositories"
                      : "Activity"}
                </button>
              ),
            )}
          </div>

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

        {/* ── Tab panels ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* Overview tab */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              id="dash-panel-overview"
              role="tabpanel"
              aria-labelledby="dash-tab-overview"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              <section aria-label="Release pulse">
                <ReleasePulse
                  projects={projects}
                  historyLength={history.length}
                  uniqueServices={uniqueServices}
                  historyLoading={historyLoading}
                  projectsLoading={projectsLoading}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </section>

              {!guest && projectsError ? (
                <div
                  className="error-inline glass-panel"
                  role="alert"
                  style={{
                    background: "rgba(248, 113, 113, 0.05)",
                    border: "1px solid rgba(248, 113, 113, 0.2)",
                    borderRadius: "10px",
                  }}
                >
                  <span
                    className="error-inline-icon"
                    aria-hidden="true"
                    style={{ color: "var(--danger)" }}
                  >
                    !
                  </span>
                  <p
                    className="error-inline-msg"
                    style={{ margin: 0, fontSize: "0.82rem" }}
                  >
                    {projectsError}
                  </p>
                  <button
                    className="error-retry-btn"
                    type="button"
                    onClick={loadProjects}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {!guest && historyError ? (
                <div
                  className="error-inline glass-panel"
                  role="alert"
                  style={{
                    background: "rgba(248, 113, 113, 0.05)",
                    border: "1px solid rgba(248, 113, 113, 0.2)",
                    borderRadius: "10px",
                  }}
                >
                  <span
                    className="error-inline-icon"
                    aria-hidden="true"
                    style={{ color: "var(--danger)" }}
                  >
                    !
                  </span>
                  <p
                    className="error-inline-msg"
                    style={{ margin: 0, fontSize: "0.82rem" }}
                  >
                    {historyError}
                  </p>
                  <button
                    className="error-retry-btn"
                    type="button"
                    onClick={loadHistory}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Repositories tab */}
          {activeTab === "repositories" && (
            <motion.div
              key="repositories"
              id="dash-panel-repositories"
              role="tabpanel"
              aria-labelledby="dash-tab-repositories"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
            >
              {guest ? (
                <div
                  className="glass-panel"
                  style={{
                    textAlign: "center",
                    padding: "3rem 1.5rem",
                    background: "rgba(17, 17, 22, 0.3)",
                    borderRadius: "var(--radius-card)",
                  }}
                >
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      marginBottom: "1.25rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    Sign in to see your repositories.
                  </p>
                  <Link
                    className="primary-button"
                    href="/login"
                    style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
                  >
                    Sign in
                  </Link>
                </div>
              ) : (
                <>
                  {/* The Repositories tab is intentionally a single GitHub
                      repository list. Provisioned projects remain available
                      from the Projects and Overview surfaces. */}
                  {showProvisionedProjects ? <section aria-label="Provisioned projects">
                    {repositoryActionError ? (
                      <div className="error-inline" role="alert">
                        <span className="error-inline-icon" aria-hidden="true">
                          !
                        </span>
                        <p className="error-inline-msg">
                          {repositoryActionError}
                        </p>
                        <button
                          type="button"
                          className="error-retry-btn"
                          onClick={() => setRepositoryActionError(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                    {disconnectOutcome ? (
                      <div
                        className={
                          disconnectOutcome.kind === "github-deleted"
                            ? undefined
                            : "error-inline"
                        }
                        role="status"
                        aria-live="polite"
                        style={
                          disconnectOutcome.kind === "github-deleted"
                            ? {
                                display: "flex",
                                alignItems: "center",
                                gap: "0.55rem",
                                padding: "0.55rem 0.74rem",
                                borderRadius: "0.84rem",
                                border: "1px solid rgba(52, 211, 153, 0.3)",
                                color: "var(--success)",
                                background: "rgba(52, 211, 153, 0.08)",
                                fontSize: "0.86rem",
                                marginTop: "0.75rem",
                              }
                            : undefined
                        }
                      >
                        <span className="error-inline-icon" aria-hidden="true">
                          {disconnectOutcome.kind === "github-deleted"
                            ? "✓"
                            : "!"}
                        </span>
                        <p className="error-inline-msg">
                          {disconnectOutcome.kind === "github-deleted" && (
                            <>
                              Removed from ALPHACI and the GitHub repository{" "}
                              <strong>{disconnectOutcome.repoFullName}</strong>{" "}
                              was deleted.
                            </>
                          )}
                          {disconnectOutcome.kind === "missing-scope" && (
                            <>
                              Removed from ALPHACI, but ALPHACI doesn&apos;t
                              have permission to delete{" "}
                              <strong>{disconnectOutcome.repoFullName}</strong>{" "}
                              on GitHub. Log out and reconnect your GitHub
                              account to grant repository-deletion
                              permission, then delete the repo from GitHub
                              directly if still needed.
                            </>
                          )}
                          {disconnectOutcome.kind === "github-delete-failed" && (
                            <>
                              Removed from ALPHACI, but{" "}
                              <strong>{disconnectOutcome.repoFullName}</strong>{" "}
                              could not be deleted from GitHub
                              {disconnectOutcome.message
                                ? `: ${disconnectOutcome.message}`
                                : "."}{" "}
                              The repository still exists on GitHub and will
                              need to be deleted manually.
                            </>
                          )}
                        </p>
                        <button
                          type="button"
                          className="error-retry-btn"
                          onClick={() => setDisconnectOutcome(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                    <div className="dash-section-label">
                      <div className="dash-section-label-left">
                        <p
                          className="file-path-label"
                          style={{ marginBottom: 0, color: "var(--brand)" }}
                        >
                          projects/provisioned.yml
                        </p>
                        {!projectsLoading && projects.length > 0 && (
                          <span className="dash-count-chip">
                            {projects.length} project
                            {projects.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {projectsLoading ? (
                      <div className="repo-grid">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="skeleton-card glass-panel"
                            style={{
                              minHeight: "6.5rem",
                              background: "rgba(17, 17, 22, 0.3)",
                              animation: "state-pulse 1.5s infinite",
                            }}
                          />
                        ))}
                      </div>
                    ) : projectsError ? (
                      <div
                        className="error-inline glass-panel"
                        role="alert"
                        style={{ background: "rgba(248, 113, 113, 0.05)" }}
                      >
                        <span className="error-inline-icon" aria-hidden="true">
                          !
                        </span>
                        <p className="error-inline-msg">{projectsError}</p>
                        <button
                          className="error-retry-btn"
                          type="button"
                          onClick={loadProjects}
                        >
                          Retry
                        </button>
                      </div>
                    ) : projects.length === 0 ? (
                      <div
                        className="glass-panel"
                        style={{
                          textAlign: "center",
                          padding: "3rem 1.5rem",
                          background: "rgba(17, 17, 22, 0.3)",
                          borderRadius: "var(--radius-card)",
                        }}
                      >
                        <p
                          style={{
                            color: "var(--text-secondary)",
                            marginBottom: "1.25rem",
                            fontSize: "0.88rem",
                          }}
                        >
                          No projects provisioned yet.
                        </p>
                        <Link
                          className="primary-button"
                          href="/workflows"
                          style={{
                            padding: "0.65rem 1.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          Create your first project
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginBottom: "1rem",
                            gap: "0.75rem",
                            alignItems: "center",
                          }}
                        >
                          {syncResult && (
                            <span
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-secondary)",
                              }}
                            >
                              Sync complete — {syncResult.orphaned} orphaned,{" "}
                              {syncResult.reachable} reachable
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleSync()}
                            disabled={isSyncing}
                            className="dash-sync-btn"
                          >
                            {isSyncing ? "Syncing..." : "Sync with GitHub"}
                          </button>
                        </div>
                        <div
                          className="repo-entry-list"
                          aria-label="Provisioned projects"
                        >
                          {projects.map((project) => {
                            const stack = projectTypeMeta(
                              project.projectTypeId,
                            );
                            return (
                              <article
                                key={project.id}
                                className="repo-entry"
                              >
                                {confirmDisconnectId === project.id ? (
                                  <div
                                    role="group"
                                    aria-labelledby={`disconnect-confirm-heading-${project.id}`}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.stopPropagation();
                                        resetDisconnectConfirm();
                                      }
                                    }}
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.85rem",
                                      width: "100%",
                                      background: "rgba(248, 113, 113, 0.05)",
                                      border:
                                        "1px solid rgba(248, 113, 113, 0.2)",
                                      borderRadius: "0.75rem",
                                      padding: "1rem 1.1rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.3rem",
                                      }}
                                    >
                                      <p
                                        id={`disconnect-confirm-heading-${project.id}`}
                                        style={{
                                          margin: 0,
                                          fontSize: "0.88rem",
                                          fontWeight: 700,
                                          color: "var(--danger)",
                                        }}
                                      >
                                        Remove{" "}
                                        {project.repoFullName.split("/")[1] ??
                                          project.repoFullName}{" "}
                                        from ALPHACI?
                                      </p>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: "0.78rem",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        The project is disconnected from
                                        ALPHACI. The GitHub repository itself
                                        is kept unless you opt in below.
                                      </p>
                                    </div>

                                    <label
                                      className="enhancement-option"
                                      style={{ cursor: "pointer" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={deleteGithubRepoOptIn}
                                        onChange={(e) => {
                                          setDeleteGithubRepoOptIn(
                                            e.target.checked,
                                          );
                                          setConfirmRepoNameInput("");
                                        }}
                                        aria-describedby={`disconnect-repo-warn-${project.id}`}
                                      />
                                      <span
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.15rem",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.83rem",
                                            fontWeight: 600,
                                            color: "var(--text-primary)",
                                          }}
                                        >
                                          Also delete the GitHub repository
                                        </span>
                                        <span
                                          id={`disconnect-repo-warn-${project.id}`}
                                          style={{
                                            fontSize: "0.75rem",
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          Permanently deletes{" "}
                                          {project.repoFullName} on GitHub —
                                          this cannot be undone.
                                        </span>
                                      </span>
                                    </label>

                                    {deleteGithubRepoOptIn ? (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.4rem",
                                        }}
                                      >
                                        <label
                                          htmlFor={`confirm-repo-name-${project.id}`}
                                          style={{
                                            fontSize: "0.78rem",
                                            color: "var(--text-secondary)",
                                          }}
                                        >
                                          Type{" "}
                                          <strong
                                            style={{
                                              color: "var(--text-primary)",
                                              fontFamily:
                                                "ui-monospace, monospace",
                                            }}
                                          >
                                            {project.repoFullName}
                                          </strong>{" "}
                                          to confirm:
                                        </label>
                                        <input
                                          id={`confirm-repo-name-${project.id}`}
                                          type="text"
                                          value={confirmRepoNameInput}
                                          onChange={(e) =>
                                            setConfirmRepoNameInput(
                                              e.target.value,
                                            )
                                          }
                                          placeholder={project.repoFullName}
                                          autoComplete="off"
                                          autoFocus
                                          style={{
                                            background:
                                              "rgba(17, 17, 22, 0.6)",
                                            border:
                                              "1px solid rgba(248, 113, 113, 0.3)",
                                            borderRadius: "0.5rem",
                                            padding: "0.5rem 0.75rem",
                                            fontSize: "0.85rem",
                                            color: "var(--text-primary)",
                                            fontFamily:
                                              "ui-monospace, monospace",
                                            outline: "none",
                                            width: "100%",
                                            maxWidth: "26rem",
                                            boxSizing: "border-box",
                                          }}
                                        />
                                      </div>
                                    ) : null}

                                    <div
                                      style={{ display: "flex", gap: "0.5rem" }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleDisconnect(project)
                                        }
                                        disabled={
                                          disconnectingId === project.id ||
                                          (deleteGithubRepoOptIn &&
                                            confirmRepoNameInput !==
                                              project.repoFullName)
                                        }
                                        className="confirm-btn-danger"
                                      >
                                        {disconnectingId === project.id
                                          ? "Removing..."
                                          : deleteGithubRepoOptIn
                                            ? "Delete repo & disconnect"
                                            : "Yes, remove"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={resetDisconnectConfirm}
                                        className="confirm-btn-neutral"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="repo-entry-main">
                                      <div className="repo-entry-title">
                                        <GitHubMarkIcon />
                                        <Link
                                          href={`/projects/${project.id}`}
                                          className="repo-entry-name"
                                        >
                                          {project.repoFullName.split(
                                            "/",
                                          )[1] ?? project.repoFullName}
                                        </Link>
                                        <span
                                          className={projectStatusChipClass(
                                            project.status,
                                          )}
                                        >
                                          {project.status}
                                        </span>
                                        {project.visibility ? (
                                          <span className="status-chip status-chip-muted">
                                            {project.visibility}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="repo-entry-desc">
                                        {project.status === "failed" &&
                                        project.failureReason
                                          ? project.failureReason
                                          : project.serviceName}
                                      </p>
                                      <div className="repo-entry-meta">
                                        <span className="repo-entry-lang">
                                          <span
                                            className="repo-entry-lang-dot"
                                            style={{ background: stack.color }}
                                            aria-hidden="true"
                                          />
                                          {stack.label}
                                        </span>
                                        <span className="repo-entry-meta-item">
                                          {project.workflowPath}
                                        </span>
                                        {project.githubCommitSha ? (
                                          <span className="repo-entry-meta-item">
                                            {project.githubCommitSha.slice(
                                              0,
                                              7,
                                            )}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="repo-entry-actions">
                                      <a
                                        href={
                                          project.githubCommitUrl ??
                                          project.repoUrl ??
                                          `https://github.com/${project.repoFullName}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        className="dash-repo-row-browse"
                                      >
                                        {project.githubCommitUrl
                                          ? "View commit"
                                          : "Browse"}
                                        <svg
                                          width="10"
                                          height="10"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          aria-hidden="true"
                                        >
                                          <line
                                            x1="7"
                                            y1="17"
                                            x2="17"
                                            y2="7"
                                          />
                                          <polyline points="7 7 17 7 17 17" />
                                        </svg>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmDisconnectId(project.id);
                                          setDeleteGithubRepoOptIn(false);
                                          setConfirmRepoNameInput("");
                                        }}
                                        className="dash-disconnect-link"
                                      >
                                        Disconnect
                                      </button>
                                    </div>
                                  </>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </section> : null}

                  {/* ── Connected GitHub repos — compact searchable list ── */}
                  {!reposLoading && repos.length > 0 && (
                    <section aria-label="GitHub repositories">
                      <div className="dash-section-label repositories-toolbar">
                        <div className="dash-section-label-left">
                          <p
                            className="file-path-label"
                            style={{ marginBottom: 0, color: "var(--brand)" }}
                          >
                            repos/github.yml
                          </p>
                          <span className="dash-count-chip">
                            {normalizedRepoQuery
                              ? `${filteredRepos.length} of ${repos.length} repos`
                              : `${repos.length} GitHub repos`}
                          </span>
                        </div>
                        <div className="repo-search">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <input
                            type="search"
                            value={repoQuery}
                            onChange={(e) => setRepoQuery(e.target.value)}
                            placeholder="Search repositories..."
                            aria-label="Search GitHub repositories"
                          />
                          {repoQuery && (
                            <button
                              type="button"
                              onClick={() => setRepoQuery("")}
                              aria-label="Clear repository search"
                            >
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                aria-hidden="true"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="repo-filters" role="group" aria-label="Filter repositories by status">
                          {(["all", "provisioned", "orphaned"] as RepositoryStatusFilter[]).map(
                            (filter) => (
                              <button
                                key={filter}
                                type="button"
                                className={
                                  repoStatusFilter === filter
                                    ? "is-active"
                                    : undefined
                                }
                                onClick={() => setRepoStatusFilter(filter)}
                                aria-pressed={repoStatusFilter === filter}
                              >
                                {filter === "all"
                                  ? "All"
                                  : filter[0].toUpperCase() + filter.slice(1)}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      {filteredRepos.length === 0 ? (
                        <div
                          className="glass-panel"
                          style={{
                            textAlign: "center",
                            padding: "2.25rem 1.5rem",
                            background: "rgba(17, 17, 22, 0.3)",
                            borderRadius: "var(--radius-card)",
                          }}
                        >
                          <p
                            style={{
                              color: "var(--text-secondary)",
                              margin: 0,
                              fontSize: "0.88rem",
                            }}
                          >
                            No repositories match &quot;{repoQuery}&quot;.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div
                            className="repo-entry-list"
                            aria-label="GitHub repositories"
                          >
                          {paginatedRepos.map((repo) => {
                            const provisionedProjectId = projectIdByRepo.get(
                              repo.fullName.toLowerCase(),
                            );
                            return (
                            <article key={repo.id} className="repo-entry">
                              <div className="repo-entry-main">
                                <div className="repo-entry-title">
                                  <GitHubMarkIcon />
                                  <a
                                    href={repo.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="repo-entry-name"
                                  >
                                    {repo.fullName.split("/")[1]}
                                  </a>
                                  <span
                                    className={
                                      repo.private
                                        ? "status-chip status-chip-muted"
                                        : "status-chip status-chip-success"
                                    }
                                  >
                                    {repo.private ? "private" : "public"}
                                  </span>
                                </div>
                                <p className="repo-entry-desc">
                                  {repo.description ??
                                    "No description provided."}
                                </p>
                                <div className="repo-entry-meta">
                                  <span className="repo-entry-meta-item">
                                    <svg
                                      width="11"
                                      height="11"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <line x1="6" y1="3" x2="6" y2="15" />
                                      <circle cx="18" cy="6" r="3" />
                                      <circle cx="6" cy="18" r="3" />
                                      <path d="M18 9a9 9 0 0 1-9 9" />
                                    </svg>
                                    {repo.defaultBranch}
                                  </span>
                                  <span className="repo-entry-meta-item">
                                    Updated {timeAgo(repo.updatedAt)}
                                  </span>
                                </div>
                              </div>

                              <div className="repo-entry-actions">
                                {provisionedProjectId ? (
                                  <Link
                                    href={`/projects/${provisionedProjectId}`}
                                    className="dash-repo-row-view"
                                  >
                                    View project
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      aria-hidden="true"
                                    >
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                      <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                  </Link>
                                ) : null}
                                <a
                                  href={repo.htmlUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="dash-repo-row-browse"
                                >
                                  Browse
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    aria-hidden="true"
                                  >
                                    <line x1="7" y1="17" x2="17" y2="7" />
                                    <polyline points="7 7 17 7 17 17" />
                                  </svg>
                                </a>
                              </div>
                            </article>
                            );
                          })}
                          </div>
                          {repoPageCount > 1 ? (
                            <nav
                              className="repo-pagination"
                              aria-label="Repository pagination"
                            >
                              <button
                                type="button"
                                className="repo-pagination-arrow"
                                onClick={() =>
                                  setRepoPage((page) => Math.max(1, page - 1))
                                }
                                disabled={repoPage === 1}
                                aria-label="Previous page"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="15 18 9 12 15 6" />
                                </svg>
                              </button>
                              {repoPageItems.map((item, index) =>
                                item === "ellipsis" ? (
                                  <span
                                    key={`repo-page-ellipsis-${index}`}
                                    className="repo-pagination-ellipsis"
                                    aria-hidden="true"
                                  >
                                    …
                                  </span>
                                ) : (
                                  <button
                                    key={item}
                                    type="button"
                                    className={`repo-pagination-page${
                                      item === repoPage ? " is-active" : ""
                                    }`}
                                    onClick={() => setRepoPage(item)}
                                    aria-label={`Page ${item}`}
                                    aria-current={
                                      item === repoPage ? "page" : undefined
                                    }
                                  >
                                    {item}
                                  </button>
                                ),
                              )}
                              <button
                                type="button"
                                className="repo-pagination-arrow"
                                onClick={() =>
                                  setRepoPage((page) =>
                                    Math.min(repoPageCount, page + 1),
                                  )
                                }
                                disabled={repoPage === repoPageCount}
                                aria-label="Next page"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </button>
                            </nav>
                          ) : null}
                        </>
                      )}
                    </section>
                  )}
                  {reposError && !reposLoading && (
                    <div
                      className="error-inline glass-panel"
                      role="alert"
                      style={{ background: "rgba(248, 113, 113, 0.05)" }}
                    >
                      <span className="error-inline-icon" aria-hidden="true">
                        !
                      </span>
                      <p className="error-inline-msg">{reposError}</p>
                      <button
                        className="error-retry-btn"
                        type="button"
                        onClick={loadRepos}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Activity tab */}
          {activeTab === "activity" && (
            <motion.div
              key="activity"
              id="dash-panel-activity"
              role="tabpanel"
              aria-labelledby="dash-tab-activity"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <section aria-label="Recent workflows">
                <div className="dash-section-label">
                  <div className="dash-section-label-left">
                    <p
                      className="file-path-label"
                      style={{ marginBottom: 0, color: "var(--brand)" }}
                    >
                      workflows/recent.yml
                    </p>
                    {!historyLoading && history.length > 0 && (
                      <span className="dash-count-chip">
                        {history.length} generated workflows
                      </span>
                    )}
                  </div>
                </div>

                {historyLoading ? (
                  <div className="repo-grid">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="skeleton-card glass-panel"
                        style={{
                          minHeight: "8rem",
                          background: "rgba(17, 17, 22, 0.3)",
                          animation: "state-pulse 1.5s infinite",
                        }}
                      />
                    ))}
                  </div>
                ) : historyError ? (
                  <div
                    className="error-inline glass-panel"
                    role="alert"
                    style={{ background: "rgba(248, 113, 113, 0.05)" }}
                  >
                    <span className="error-inline-icon" aria-hidden="true">
                      !
                    </span>
                    <p className="error-inline-msg">{historyError}</p>
                    <button
                      className="error-retry-btn"
                      type="button"
                      onClick={loadHistory}
                    >
                      Retry
                    </button>
                  </div>
                ) : history.length === 0 ? (
                  <div
                    className="glass-panel"
                    style={{
                      textAlign: "center",
                      padding: "3rem 1.5rem",
                      background: "rgba(17, 17, 22, 0.3)",
                    }}
                  >
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        marginBottom: "1.25rem",
                      }}
                    >
                      No workflow history yet.
                    </p>
                    <Link
                      className="primary-button"
                      href="/workflows"
                      style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
                    >
                      Create your first project
                    </Link>
                  </div>
                ) : (
                  <div className="repo-grid">
                    {history.map((item) => (
                      <article
                        key={item.id}
                        className="repo-card glass-panel repo-card-brand"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span className="status-chip status-chip-brand">
                            {item.stack}
                          </span>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {new Intl.DateTimeFormat("en-PH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(item.createdAt))}
                          </span>
                        </div>

                        <h3
                          style={{
                            fontSize: "1rem",
                            margin: 0,
                            fontWeight: 700,
                          }}
                        >
                          {item.serviceName}
                        </h3>

                        <div className="activity-code-block">
                          <span className="activity-code-label">
                            Workflow File
                          </span>
                          <span className="activity-code-value">
                            {item.outputFileName}
                          </span>
                        </div>

                        <div className="repo-card-meta">
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.7rem",
                            }}
                          >
                            Actions config built
                          </span>
                          <Link
                            href="/workflows"
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--brand)",
                              fontWeight: 600,
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            View Studio
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
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
