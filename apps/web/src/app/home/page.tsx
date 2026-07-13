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
} from "@/lib/api/client";
import { completeOnboarding } from "@/lib/api/auth";
import { getRuns } from "@/lib/api/runs";
import type {
  ProvisionedProject,
  WorkflowHistoryItem,
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
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<RunGroup | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);
  // Hide the header widget entirely if /ci/runs is unavailable (feature off).
  const [runsAvailable, setRunsAvailable] = useState(true);
  // Welcome modal: shown once for new users (onboardingCompleted === false).
  // Local flag dismisses immediately without waiting for a network response.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

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
    loadLatestRun();
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

        {/* ── Dashboard Content ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
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
