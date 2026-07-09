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
import type {
  ProvisionedProject,
  WorkflowHistoryItem,
  GitHubRepo,
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

const quickActions = [
  {
    cmd: "new-project",
    href: "/workflows?tab=setup",
    display: "Create Project",
    shortcut: "N",
    accent: "var(--brand)",
  },
  {
    cmd: "view-workflows",
    href: "/workflows?tab=current",
    display: "View Workflows",
    shortcut: "W",
    accent: "var(--accent-violet)",
  },
];

const pipelineStages = ["Source", "Lint", "Test", "Build", "Deploy"];

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

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function PipelineTrack({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <div>
      <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>
        pipeline/stages.yml
      </p>
      <motion.div
        className="pipeline-track"
        aria-label="Pipeline stages"
        variants={reduced ? undefined : pipelineContainerVariants}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "visible"}
      >
        {pipelineStages.map((stage, index) => (
          <span
            key={stage}
            style={{ display: "inline-flex", alignItems: "center" }}
          >
            <motion.span
              className={`pipeline-dot ${index === pipelineStages.length - 1 ? "active" : ""}`}
              variants={reduced ? undefined : pipelineDotVariants}
              title={stage}
              style={{ cursor: "default" }}
            />
            {index < pipelineStages.length - 1 && (
              <motion.span
                className="pipeline-connector"
                variants={reduced ? undefined : pipelineDotVariants}
                aria-hidden="true"
              />
            )}
          </span>
        ))}
      </motion.div>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.45rem",
          flexWrap: "wrap",
        }}
      >
        {pipelineStages.map((stage) => (
          <span key={stage} className="template-tag">
            {stage}
          </span>
        ))}
      </div>
    </div>
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

/* ── BentoGrid ──────────────────────────────────────────────────────────────── */

interface BentoGridProps {
  historyLoading: boolean;
  projectsLoading: boolean;
  historyLength: number;
  projectsLength: number;
  uniqueServices: number;
  lastActivityValue: string;
  prefersReducedMotion: boolean | null;
}

function BentoGrid({
  historyLoading,
  projectsLoading,
  historyLength,
  projectsLength,
  uniqueServices,
  lastActivityValue,
  prefersReducedMotion,
}: Readonly<BentoGridProps>) {
  const animatedHistory = useCountUp(
    prefersReducedMotion || historyLoading ? null : historyLength,
  );
  const animatedProjects = useCountUp(
    prefersReducedMotion || projectsLoading ? null : projectsLength,
  );
  const animatedServices = useCountUp(
    prefersReducedMotion || historyLoading ? null : uniqueServices,
  );

  const displayHistory = prefersReducedMotion
    ? historyLength
    : (animatedHistory ?? historyLength);
  const displayProjects = prefersReducedMotion
    ? projectsLength
    : (animatedProjects ?? projectsLength);
  const displayServices = prefersReducedMotion
    ? uniqueServices
    : (animatedServices ?? uniqueServices);

  return (
    <div className="kpi-bento-grid">
      {/* Cell 1: Workflows Generated — dominant brand, asymmetric wide */}
      <Link
        href="/workflows?tab=all"
        className="bento-card bento-card-dominant bento-card-brand bento-card-link"
        aria-label="View all generated workflows"
      >
        <div className="bento-card-eyebrow">
          <span
            className="bento-pulse-dot bento-pulse-dot--brand"
            aria-hidden="true"
          />
          Workflows Generated
        </div>
        <div className="bento-value-row">
          <div className="bento-card-value counter-number bento-num-brand">
            {historyLoading ? <SkeletonValue wide /> : displayHistory}
          </div>
          {!historyLoading && historyLength > 0 && (
            <span className="bento-trend-up">
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Active
            </span>
          )}
        </div>
        <p className="bento-card-desc">
          GitHub Actions build &amp; test recipes
        </p>
        <div className="bento-sparkbar" aria-hidden="true">
          {[3, 6, 4, 7, 5, 8, 6, 9, 7, 10, 8, 11].map((h, i) => (
            <span
              key={i}
              className="bento-sparkbar-bar"
              style={{ height: `${h * 8}%`, animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
        <svg
          className="bento-card-icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </Link>

      {/* Cell 2: Projects Created — violet tint */}
      <Link
        href="/workflows?tab=current"
        className="bento-card bento-card-accent bento-card-violet bento-card-link"
        aria-label="View active projects"
      >
        <div className="bento-card-eyebrow">
          <span
            className="bento-pulse-dot bento-pulse-dot--violet"
            aria-hidden="true"
          />
          Projects
        </div>
        <div className="bento-card-value counter-number bento-num-violet">
          {projectsLoading ? <SkeletonValue /> : displayProjects}
        </div>
        <p className="bento-card-desc">Active repositories</p>
        <svg
          className="bento-card-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      </Link>

      {/* Cell 3: Services — teal accent */}
      <Link
        href="/hosting"
        className="bento-card bento-card-teal bento-card-link"
        aria-label="Manage deployment services"
      >
        <div className="bento-card-eyebrow">
          <span
            className="bento-pulse-dot bento-pulse-dot--teal"
            aria-hidden="true"
          />
          Services
        </div>
        <div className="bento-card-value counter-number bento-num-teal">
          {historyLoading ? <SkeletonValue /> : displayServices}
        </div>
        <p className="bento-card-desc">Unique services</p>
        <svg
          className="bento-card-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      </Link>

      {/* Cell 4: Last Activity — vertical timeline treatment */}
      <Link
        href="/runs"
        className="bento-card bento-card-activity bento-card-link"
        aria-label="View recent workflow activity"
      >
        <div className="bento-card-eyebrow">
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
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Last Activity
        </div>
        <div className="bento-timeline">
          <span className="bento-timeline-dot" aria-hidden="true" />
          <div className="bento-timeline-content">
            {historyLoading ? (
              <SkeletonValue wide />
            ) : (
              <span className="bento-timeline-date">{lastActivityValue}</span>
            )}
            <span className="bento-timeline-label">Latest run</span>
          </div>
        </div>
      </Link>

      {/* Cell 5: Quick Actions — terminal command rows */}
      <div className="bento-card bento-card-quick-actions">
        <div className="bento-card-eyebrow" style={{ marginBottom: "0.9rem" }}>
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
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          Quick actions
        </div>
        <div className="bento-cmd-list">
          {quickActions.map((action) => (
            <Link
              key={action.cmd}
              href={action.href}
              className="bento-cmd-row"
              style={{ "--cmd-accent": action.accent } as React.CSSProperties}
            >
              <span className="bento-cmd-prompt" aria-hidden="true">
                $
              </span>
              <span className="bento-cmd-name">{action.cmd}</span>
              <span className="bento-cmd-display">{action.display}</span>
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
          ))}
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
  const [repoQuery, setRepoQuery] = useState("");
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(
    null,
  );
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

  async function handleDisconnect(id: string) {
    setDisconnectingId(id);
    setRepositoryActionError(null);
    try {
      await disconnectProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setConfirmDisconnectId(null);
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
  }

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function projectBorderClass(status: string) {
    if (status === "provisioned") return "repo-card-success";
    if (status === "failed") return "repo-card-danger";
    if (status === "orphaned") return "repo-card-amber";
    return "repo-card-brand";
  }

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
  const filteredRepos = normalizedRepoQuery
    ? repos.filter(
        (repo) =>
          repo.fullName.toLowerCase().includes(normalizedRepoQuery) ||
          (repo.description ?? "").toLowerCase().includes(normalizedRepoQuery),
      )
    : repos;

  const uniqueServices = new Set(history.map((h) => h.serviceName)).size;
  const lastActivityValue = history[0]
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
        new Date(history[0].createdAt),
      )
    : "None yet";

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
              "linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.7) 100%)",
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
        >
          <div className="welcome-banner-flat-accent" aria-hidden="true" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            {/* Identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
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
                    fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)",
                    fontWeight: 800,
                  }}
                >
                  {guest
                    ? "ALPHACI Dashboard"
                    : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
                </h1>
              </div>
            </div>

            {/* Pipeline track */}
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
                LIVE STATUS PIPELINE
              </p>
              <PipelineTrack reduced={prefersReducedMotion} />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
              borderTop: "1px solid var(--border-soft)",
              paddingTop: "1rem",
            }}
          >
            {guest && (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                }}
              >
                You are browsing in guest mode. Sign up to unlock all features.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
              {guest ? (
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
              ) : (
                <>
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
                  <Link
                    className="ghost-button"
                    href="/subscribe"
                    style={{
                      padding: "0.4rem 1.2rem",
                      fontSize: "0.8rem",
                      minHeight: "2.2rem",
                    }}
                  >
                    Subscription
                  </Link>
                </>
              )}
            </div>
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
              background: "rgba(15, 23, 42, 0.4)",
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
                        background: "rgba(56, 189, 248, 0.1)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        boxShadow: "0 0 12px rgba(56, 189, 248, 0.15)",
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
                <BentoGrid
                  historyLoading={historyLoading}
                  projectsLoading={projectsLoading}
                  historyLength={history.length}
                  projectsLength={projects.length}
                  uniqueServices={uniqueServices}
                  lastActivityValue={lastActivityValue}
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
                    background: "rgba(15, 23, 42, 0.3)",
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
                  {/* ── Provisioned Projects ── */}
                  <section aria-label="Provisioned projects">
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
                              background: "rgba(15, 23, 42, 0.3)",
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
                          background: "rgba(15, 23, 42, 0.3)",
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
                          className="repo-grid"
                          aria-label="Provisioned projects"
                        >
                          {projects.map((project) => (
                            <article
                              key={project.id}
                              className={`repo-card glass-panel ${projectBorderClass(project.status)}`}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "start",
                                  gap: "0.5rem",
                                }}
                              >
                                <a
                                  href={
                                    project.repoUrl ??
                                    `https://github.com/${project.repoFullName}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="repo-card-title"
                                >
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ flexShrink: 0 }}
                                  >
                                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                  </svg>
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {project.repoFullName.split("/")[1] ??
                                      project.repoFullName}
                                  </span>
                                </a>
                                <span
                                  className={projectStatusChipClass(
                                    project.status,
                                  )}
                                >
                                  {project.status}
                                </span>
                              </div>

                              <p
                                style={{
                                  color: "var(--text-secondary)",
                                  fontSize: "0.78rem",
                                  margin: 0,
                                  fontFamily: "ui-monospace, monospace",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {project.serviceName}
                              </p>

                              <div className="repo-card-meta">
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "0.7rem",
                                    fontFamily: "ui-monospace, monospace",
                                  }}
                                >
                                  {project.workflowPath}
                                </span>
                                {project.githubCommitUrl ? (
                                  <a
                                    href={project.githubCommitUrl}
                                    target="_blank"
                                    rel="noreferrer"
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
                                    View commit
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                    >
                                      <line x1="7" y1="17" x2="17" y2="7" />
                                      <polyline points="7 7 17 7 17 17" />
                                    </svg>
                                  </a>
                                ) : (
                                  <a
                                    href={
                                      project.repoUrl ??
                                      `https://github.com/${project.repoFullName}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
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
                                    Browse
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                    >
                                      <line x1="7" y1="17" x2="17" y2="7" />
                                      <polyline points="7 7 17 7 17 17" />
                                    </svg>
                                  </a>
                                )}
                              </div>

                              {confirmDisconnectId === project.id ? (
                                <div className="repo-card-confirm-row">
                                  <span className="repo-card-confirm-label">
                                    Remove from ALPHACI? GitHub repo is
                                    untouched.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDisconnect(project.id)
                                    }
                                    disabled={disconnectingId === project.id}
                                    className="confirm-btn-danger"
                                  >
                                    {disconnectingId === project.id
                                      ? "Removing..."
                                      : "Yes, remove"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDisconnectId(null)}
                                    className="confirm-btn-neutral"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDisconnectId(project.id)
                                  }
                                  className="dash-disconnect-link"
                                  style={{ marginTop: "0.5rem" }}
                                >
                                  Disconnect
                                </button>
                              )}
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </section>

                  {/* ── Connected GitHub repos — compact searchable list ── */}
                  {!reposLoading && repos.length > 0 && (
                    <section aria-label="GitHub repositories">
                      <div className="dash-section-label">
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
                      </div>

                      {filteredRepos.length === 0 ? (
                        <div
                          className="glass-panel"
                          style={{
                            textAlign: "center",
                            padding: "2.25rem 1.5rem",
                            background: "rgba(15, 23, 42, 0.3)",
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
                        <div
                          className="dash-repo-list"
                          aria-label="GitHub repositories"
                        >
                          {filteredRepos.map((repo) => (
                            <article key={repo.id} className="dash-repo-row">
                              <svg
                                className="dash-repo-row-icon"
                                width="15"
                                height="15"
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
                              <a
                                href={repo.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="dash-repo-row-name"
                              >
                                {repo.fullName.split("/")[1]}
                              </a>
                              <span
                                className={`dash-repo-row-chip ${repo.private ? "status-chip status-chip-muted" : "status-chip status-chip-success"}`}
                              >
                                {repo.private ? "private" : "public"}
                              </span>
                              <p className="dash-repo-row-desc">
                                {repo.description ?? "No description provided."}
                              </p>
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
                            </article>
                          ))}
                        </div>
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
                          background: "rgba(15, 23, 42, 0.3)",
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
                      background: "rgba(15, 23, 42, 0.3)",
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
