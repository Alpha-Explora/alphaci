"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, getRuns } from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import type { RunGroup, RunOverallStatus } from "@/lib/api/contracts";
import { isGuest } from "@/lib/auth/subscription";
import { RunCard } from "@/components/product/runs/RunCard";
import { RunsSkeleton } from "@/components/product/runs/RunsSkeleton";
import { relativeTime } from "@/lib/runs/utils";

/* ── Mock toggle ─────────────────────────────────────────────────────────────
   Set NEXT_PUBLIC_USE_MOCK=true in .env.local to use the local fixture instead
   of the real backend. Defaults to false (real API) when the var is absent.
─────────────────────────────────────────────────────────────────────────── */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/* ── Motion constants ────────────────────────────────────────────────────── */

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT, delay: delay * 0.06 },
  }),
};

const STATUS_LABELS: Record<RunOverallStatus, string> = {
  success: "Passed",
  failure: "Failed",
  running: "Running",
  cancelled: "Cancelled",
  partial: "Partial",
};

const STATUS_COLORS: Record<RunOverallStatus, string> = {
  success: "var(--accent-teal)",
  failure: "var(--danger)",
  running: "var(--brand)",
  cancelled: "var(--text-muted)",
  partial: "var(--accent-amber)",
};

/* ── Per-project grouping ────────────────────────────────────────────────────
   Runs are presented inside their project (repository) directory rather than
   as one flat cross-project stream: one collapsible section per repo, newest
   project first, with that project's runs nested inside. */
interface ProjectRunGroup {
  repoFullName: string;
  runs: RunGroup[];
  latestRun: RunGroup;
}

function groupRunsByProject(runs: RunGroup[]): ProjectRunGroup[] {
  const byRepo = new Map<string, RunGroup[]>();
  for (const run of runs) {
    const bucket = byRepo.get(run.repoFullName);
    if (bucket) {
      bucket.push(run);
    } else {
      byRepo.set(run.repoFullName, [run]);
    }
  }

  return Array.from(byRepo.entries())
    .map(([repoFullName, repoRuns]) => {
      const sorted = [...repoRuns].sort(
        (left, right) =>
          new Date(right.startedAt).getTime() -
          new Date(left.startedAt).getTime(),
      );
      return {
        repoFullName,
        runs: sorted,
        latestRun: sorted[0]!,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.latestRun.startedAt).getTime() -
        new Date(left.latestRun.startedAt).getTime(),
    );
}

function ProjectGroupSection({
  group,
  reduced,
  collapsed,
  onToggle,
}: Readonly<{
  group: ProjectRunGroup;
  reduced: boolean;
  collapsed: boolean;
  onToggle: () => void;
}>) {
  const latestStatus = group.latestRun.overallStatus;
  const bodyId = `project-runs-${group.repoFullName.replaceAll(/[^a-zA-Z0-9-]/g, "-")}`;
  const runCountLabel = `${group.runs.length} ${group.runs.length === 1 ? "commit" : "commits"}`;
  const metaText = `Latest ${STATUS_LABELS[latestStatus].toLowerCase()} · ${relativeTime(group.latestRun.startedAt)} · ${runCountLabel}`;

  return (
    <section className="runs-project-group" aria-label={group.repoFullName}>
      <button
        type="button"
        className="runs-project-group-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
      >
        <span className="runs-project-group-folder" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="runs-project-group-name">{group.repoFullName}</span>
        <span className="runs-project-group-meta">
          <span
            className="runs-project-group-status-dot"
            style={{ background: STATUS_COLORS[latestStatus] }}
            aria-hidden="true"
          />
          {metaText}
        </span>
        <span
          className="runs-project-group-chevron"
          style={{
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          }}
          aria-hidden="true"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {!collapsed && (
        <div className="runs-project-group-body" id={bodyId}>
          {group.runs.map((run, i) => (
            <RunCard key={run.runId} run={run} index={i} reduced={reduced} />
          ))}
        </div>
      )}
    </section>
  );
}

function RunsSummaryStrip({
  runs,
  repoFullName,
}: {
  runs: RunGroup[];
  repoFullName?: string;
}) {
  const summary = useMemo(() => {
    const counts = runs.reduce(
      (acc, run) => {
        acc[run.overallStatus] += 1;
        return acc;
      },
      {
        success: 0,
        failure: 0,
        running: 0,
        cancelled: 0,
        partial: 0,
      } satisfies Record<RunOverallStatus, number>,
    );

    const latestRun = runs.reduce<RunGroup | null>((latest, run) => {
      if (!latest) return run;
      return new Date(run.startedAt).getTime() >
        new Date(latest.startedAt).getTime()
        ? run
        : latest;
    }, null);

    return {
      total: runs.length,
      counts,
      latestRun,
      needsAttention: counts.failure + counts.partial + counts.cancelled,
    };
  }, [runs]);

  const latestStatus = summary.latestRun
    ? STATUS_LABELS[summary.latestRun.overallStatus]
    : "None";

  return (
    <section className="runs-summary-strip" aria-label="Pipeline run summary">
      <div className="runs-summary-card runs-summary-card--primary">
        <span>Tracked commits</span>
        <strong>{summary.total}</strong>
        <p>{repoFullName ? "Filtered repository" : "Across all repositories"}</p>
      </div>
      <div className="runs-summary-card">
        <span>Running</span>
        <strong>{summary.counts.running}</strong>
        <p>Active GitHub Actions</p>
      </div>
      <div className="runs-summary-card">
        <span>Needs review</span>
        <strong>{summary.needsAttention}</strong>
        <p>Failed, partial, or cancelled</p>
      </div>
      <div className="runs-summary-card">
        <span>Latest</span>
        <strong>{latestStatus}</strong>
        <p>
          {summary.latestRun
            ? relativeTime(summary.latestRun.startedAt)
            : "No runs yet"}
        </p>
      </div>
    </section>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      className="runs-empty-state"
    >
      <div className="runs-empty-icon">
        <svg
          width="24"
          height="24"
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
      </div>

      <div>
        <h2>No pipeline runs yet</h2>
        <p>
          Push a commit to a connected repository to see your pipeline results
          here. Each run shows exactly what passed, what failed, and how to fix
          it.
        </p>
      </div>

      <Link
        className="ghost-button"
        href="/workflows"
        style={{
          padding: "0.5rem 1.4rem",
          fontSize: "0.88rem",
          minHeight: "2.4rem",
        }}
      >
        Connect a repository
      </Link>
    </div>
  );
}

/* ── Error state ─────────────────────────────────────────────────────────── */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="runs-error-state"
      role="alert"
    >
      <div className="runs-error-body">
        <svg
          width="16"
          height="16"
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
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="ghost-button"
        style={{
          padding: "0.35rem 1rem",
          fontSize: "0.82rem",
          minHeight: "2rem",
        }}
      >
        Retry
      </button>
    </div>
  );
}

/* ── Inner content: search-params-aware ──────────────────────────────────── */

interface RunsContentProps {
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  prefersReducedMotion: boolean | null;
}

function RunsContent({
  guest,
  session,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
}: RunsContentProps) {
  const searchParams = useSearchParams();
  const repoFullName = searchParams.get("repoFullName") ?? undefined;

  const [runs, setRuns] = useState<RunGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedRepos, setCollapsedRepos] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const hasInitializedCollapse = useRef(false);

  const groupedRuns = useMemo(() => groupRunsByProject(runs), [runs]);

  // Keep every repository visible, but start its commit list closed. This
  // preserves a quiet first view without hiding any connected project.
  useEffect(() => {
    if (!hasInitializedCollapse.current && groupedRuns.length > 0) {
      hasInitializedCollapse.current = true;
      setCollapsedRepos(new Set(groupedRuns.map((group) => group.repoFullName)));
    }
  }, [groupedRuns]);

  function toggleRepo(repo: string) {
    setCollapsedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repo)) {
        next.delete(repo);
      } else {
        next.add(repo);
      }
      return next;
    });
  }

  function load() {
    setLoading(true);
    setError(null);

    if (USE_MOCK) {
      // Simulated async delay for realistic skeleton presentation
      const timer = setTimeout(async () => {
        try {
          const { MOCK_RUNS } = await import("@/lib/runs/mock");
          const filtered = repoFullName
            ? MOCK_RUNS.runs.filter((r) => r.repoFullName === repoFullName)
            : MOCK_RUNS.runs;
          setRuns(filtered);
        } finally {
          setLoading(false);
        }
      }, 600);
      return () => clearTimeout(timer);
    }

    getRuns(repoFullName)
      .then((res) => {
        setRuns(res.runs);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            setError("Your session expired. Please sign in again.");
          } else if (err.status === 403) {
            setError("You don't have access to this repository's runs.");
          } else if (err.status === 404) {
            setError("This repository hasn't been set up for CI yet.");
          } else {
            setError(
              "Could not load pipeline runs. Check your connection and try again.",
            );
          }
        } else {
          setError(
            "Could not load pipeline runs. Check your connection and try again.",
          );
        }
      })
      .finally(() => setLoading(false));

    return undefined;
  }

  useEffect(() => {
    if (guest) {
      setLoading(false);
      return;
    }
    const cleanup = load();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoFullName, guest]);

  const reduced = prefersReducedMotion ?? false;
  const visibleRepoName = repoFullName?.split("/")[1] ?? repoFullName;

  return (
    <main
      className="dash-shell"
      suppressHydrationWarning
      style={{ overflowX: "hidden" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />

      {guest && (
        <div className="guest-banner" role="alert">
          <p className="guest-banner-text">
            You are viewing ALPHACI in preview mode. Sign up to see your
            pipeline runs.
          </p>
          <div className="guest-banner-actions">
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
        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          className="workflow-page-header workflow-page-header--compact"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <div className="workflow-page-header-left runs-page-header-left">
            <p className="workflow-page-breadcrumb">
              <span style={{ opacity: 0.55 }}>ALPHACI</span>
              <span className="workflow-page-breadcrumb-sep">/</span>
              <span>Workflows</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">
                {repoFullName
                  ? `Commits for ${visibleRepoName}`
                  : "All Workflow Commits"}
              </h1>
              <div className="workflow-page-studio-badge">
                <span className="workflow-studio-led" aria-hidden="true" />
                Live results
              </div>
            </div>
            {repoFullName && (
              <Link
                href="/runs"
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  marginTop: "0.3rem",
                }}
              >
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
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                All repos
              </Link>
            )}
          </div>
        </motion.div>

        {/* ── Guest gate ──────────────────────────────────────────────── */}
        {guest ? (
          <motion.div
            custom={2}
            variants={sectionVariants}
            initial={reduced ? false : "hidden"}
            animate="visible"
          >
            <div
              className="glass-panel"
              style={{ textAlign: "center", padding: "3rem 1.5rem" }}
            >
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "1.25rem",
                  fontSize: "0.9rem",
                }}
              >
                Sign in to see your pipeline run history.
              </p>
              <Link
                className="primary-button"
                href="/login?next=/runs"
                style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        ) : (
          /* ── Runs list ────────────────────────────────────────────── */
          <motion.section
            aria-label="Pipeline run list"
            aria-live="polite"
            custom={2}
            variants={sectionVariants}
            initial={reduced ? false : "hidden"}
            animate="visible"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <RunsSkeleton />
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ErrorState message={error} onRetry={load} />
                </motion.div>
              ) : runs.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <EmptyState />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="runs-list-stack"
                >
                  <RunsSummaryStrip runs={runs} repoFullName={repoFullName} />
                  <div className="runs-list-toolbar">
                    <div>
                      <span>Commit history</span>
                      <strong>
                        {repoFullName ?? "All connected repositories"}
                      </strong>
                    </div>
                    <p>
                      {runs.length} {runs.length === 1 ? "commit" : "commits"} in{" "}
                      {groupedRuns.length}{" "}
                      {groupedRuns.length === 1 ? "project" : "projects"}
                    </p>
                  </div>
                  {groupedRuns.map((group) => (
                    <ProjectGroupSection
                      key={group.repoFullName}
                      group={group}
                      reduced={reduced}
                      collapsed={collapsedRepos.has(group.repoFullName)}
                      onToggle={() => toggleRepo(group.repoFullName)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </div>
    </main>
  );
}

/* ── Page shell ──────────────────────────────────────────────────────────── */

export default function RunsPage() {
  const router = useRouter();
  const { status, session, error: sessionError, refresh } = useAuthSession();
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

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

  /* ── Guard: loading ─────────────────────────────────────────────────── */
  if (status === "loading") {
    return <PipelineLoader label="Loading pipeline runs" />;
  }

  /* ── Guard: error ───────────────────────────────────────────────────── */
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
            {sessionError && (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {sessionError}
              </p>
            )}
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/runs">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const guest = isGuest(session);

  return (
    <>
      {logoutMessage && <p className="error-text">{logoutMessage}</p>}
      <Suspense fallback={<PipelineLoader label="Loading pipeline runs" />}>
        <RunsContent
          guest={guest}
          session={session}
          onLogout={() => void handleLogout()}
          isLoggingOut={isLoggingOut}
          prefersReducedMotion={prefersReducedMotion}
        />
      </Suspense>
    </>
  );
}
