"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, getProjects, getWorkflowHistory, getGithubRepos, disconnectProject, syncProjects } from "@/lib/api/client";
import type { ProvisionedProject, WorkflowHistoryItem, GitHubRepo } from "@/lib/api/contracts";
import { isGuest } from "@/lib/auth/subscription";

/* ── Animated counter hook ──────────────────────────────────────────────────── */

function useCountUp(target: number | null, duration = 900): number | null {
  const [count, setCount] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); }

    // Route null/0 through rAF so all setState calls are async (avoids cascading render lint error)
    if (target === null || target === 0) {
      const safeTarget = target;
      rafRef.current = requestAnimationFrame(() => { setCount(safeTarget); });
      return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    }

    const safeTarget = target;
    const start      = performance.now();

    function tick(now: number) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * safeTarget));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return count;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

const quickActions = [
  { label: "create-project",  href: "/workflows", display: "Create Project" },
  { label: "view-workflows",  href: "/workflows", display: "View Workflows" },
  { label: "manage-plan",     href: "/subscribe", display: "Manage Plan" },
];

const pipelineStages = ["Source", "Lint", "Test", "Build", "Deploy"];

const pipelineContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const pipelineDotVariants = {
  hidden:  { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
};

type DashTab = "overview" | "repositories" | "activity";

/* ── Sub-components ─────────────────────────────────────────────────────────── */

// AppNav is now imported from @/components/layout/app-nav

function PipelineTrack({ reduced }: Readonly<{ reduced: boolean | null }>) {
  return (
    <div>
      <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>pipeline/stages.yml</p>
      <motion.div
        className="pipeline-track"
        aria-label="Pipeline stages"
        variants={reduced ? undefined : pipelineContainerVariants}
        initial={reduced ? undefined : "hidden"}
        animate={reduced ? undefined : "visible"}
      >
        {pipelineStages.map((stage, index) => (
          <span key={stage} style={{ display: "inline-flex", alignItems: "center" }}>
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
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
        {pipelineStages.map((stage) => (
          <span key={stage} className="template-tag">{stage}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Skeleton value placeholder (hoisted outside BentoGrid to avoid re-mount on every render) */

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

/* ── BentoGrid with animated counters ──────────────────────────────────────── */

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
  // Animated counters — only fire once values are loaded
  const animatedHistory  = useCountUp(prefersReducedMotion || historyLoading  ? null : historyLength);
  const animatedProjects = useCountUp(prefersReducedMotion || projectsLoading ? null : projectsLength);
  const animatedServices = useCountUp(prefersReducedMotion || historyLoading  ? null : uniqueServices);

  const displayHistory  = prefersReducedMotion ? historyLength  : (animatedHistory  ?? historyLength);
  const displayProjects = prefersReducedMotion ? projectsLength : (animatedProjects ?? projectsLength);
  const displayServices = prefersReducedMotion ? uniqueServices : (animatedServices ?? uniqueServices);

  return (
    <div className="kpi-bento-grid">
      {/* Cell 1: Workflows Generated — dominant */}
      <div className="bento-card bento-card-dominant">
        <div className="bento-card-title">
          <span
            aria-hidden="true"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--brand)",
              animation: "flowPulse 1.8s infinite",
            }}
          />
          Workflows Generated
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
        <div className="bento-card-value counter-number">
          {historyLoading ? <SkeletonValue wide /> : displayHistory}
        </div>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Managed GitHub Action build &amp; test recipes
        </p>
        {!historyLoading && historyLength > 0 && (
          <span className="trend-up" style={{ marginTop: "0.5rem" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Active
          </span>
        )}
      </div>

      {/* Cell 2: Projects Created */}
      <div className="bento-card">
        <div className="bento-card-title">Projects Created</div>
        <svg className="bento-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        <div className="bento-card-value counter-number">
          {projectsLoading ? <SkeletonValue /> : displayProjects}
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Active repositories
        </p>
      </div>

      {/* Cell 3: Services Configured */}
      <div className="bento-card">
        <div className="bento-card-title">Services</div>
        <svg className="bento-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <div className="bento-card-value counter-number">
          {historyLoading ? <SkeletonValue /> : displayServices}
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Unique services
        </p>
      </div>

      {/* Cell 4: Last Activity */}
      <div className="bento-card">
        <div className="bento-card-title">Last Activity</div>
        <svg className="bento-card-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <div className="bento-card-value" style={{ fontSize: "1.35rem", fontWeight: 700 }}>
          {historyLoading ? (
            <span
              style={{
                display: "block",
                height: "2rem",
                width: "6rem",
                background: "var(--bg-elevated)",
                borderRadius: "6px",
                animation: "state-pulse 1.5s infinite",
              }}
            />
          ) : lastActivityValue}
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Latest compilation run
        </p>
      </div>

      {/* Cell 5: Quick Actions */}
      <div className="bento-card" style={{ gridColumn: "span 3", minHeight: "160px", background: "rgba(15, 23, 42, 0.4)" }}>
        <div className="bento-card-title" style={{ marginBottom: "0.75rem" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Quick actions
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", width: "100%", marginTop: "auto" }}>
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="command-item-bento"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid var(--border-soft)",
                borderRadius: "0.75rem",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "0.82rem",
                fontWeight: 600,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--brand)";
                e.currentTarget.style.background = "var(--brand-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-soft)";
                e.currentTarget.style.background = "rgba(15, 23, 42, 0.6)";
              }}
            >
              <span style={{ fontFamily: "ui-monospace, monospace", color: "var(--brand)" }}>{action.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{action.display}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function HomeDashboardPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut]     = useState(false);
  const [logoutMessage, setLogoutMessage]   = useState<string | null>(null);
  const [activeTab, setActiveTab]           = useState<DashTab>("overview");
  const [history, setHistory]               = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects]             = useState<ProvisionedProject[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [historyError, setHistoryError]     = useState<string | null>(null);
  const [projectsError, setProjectsError]   = useState<string | null>(null);
  const [repos, setRepos]                   = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading]     = useState(true);
  const [reposError, setReposError]         = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId]     = useState<string | null>(null);
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing]               = useState(false);
  const [syncResult, setSyncResult]             = useState<{ orphaned: number; reachable: number; total: number } | null>(null);

  function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    getWorkflowHistory(25)
      .then((response) => { setHistory(response.items); setHistoryError(null); })
      .catch(() => setHistoryError("Could not load workflow history."))
      .finally(() => setHistoryLoading(false));
  }

  function loadProjects() {
    setProjectsLoading(true);
    setProjectsError(null);
    getProjects(25)
      .then((response) => { setProjects(response.items); setProjectsError(null); })
      .catch(() => setProjectsError("Could not load projects."))
      .finally(() => setProjectsLoading(false));
  }

  function loadRepos() {
    setReposLoading(true);
    setReposError(null);
    getGithubRepos()
      .then((response) => { setRepos(response.repos); setReposError(null); })
      .catch(() => setReposError("Could not load GitHub repositories."))
      .finally(() => setReposLoading(false));
  }

  useEffect(() => {
    if (status !== "signed-in") return;
    loadHistory();
    loadProjects();
    loadRepos();
  }, [status]);

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
    try {
      const result = await syncProjects();
      setSyncResult(result);
      // Refresh provisioned projects list
      const updated = await getProjects(25);
      setProjects(updated.items);
    } catch {
      // silently ignore
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect(id: string) {
    setDisconnectingId(id);
    try {
      await disconnectProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setConfirmDisconnectId(null);
    } catch {
      // silently ignore
    } finally {
      setDisconnectingId(null);
    }
  }

  /* ── Guard: loading ─────────────────────────────────────────────────────── */
  if (status === "loading") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <header className="dash-nav">
          <Link className="brand-mark" href="/home">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </Link>
        </header>
        <div className="state-body">
          <div className="state-card">
            <div className="state-spinner" role="status" aria-label="Loading dashboard" />
            <h1>Loading your dashboard</h1>
            <p>Verifying your session and fetching your data.</p>
          </div>
        </div>
      </main>
    );
  }

  /* ── Guard: error ───────────────────────────────────────────────────────── */
  if (status === "error") {
    return (
      <main className="dash-shell">
      <FlowBackground />
      <header className="dash-nav">
        <Link className="brand-mark" href="/home">
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </Link>
        <div className="nav-right">
          <Link className="ghost-button" href="/login?next=/home" style={{ padding: "0.2rem 0.75rem", fontSize: "0.82rem", minHeight: "1.8rem" }}>Sign in</Link>
        </div>
      </header>
        <div className="state-body">
          <div className="state-card">
            <div className="state-icon" style={{ background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.2)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1>Session verification failed</h1>
            <p>We could not verify your session. Please retry or sign in again.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => void refresh()}>
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/home">Go to login</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Signed-in or guest preview ─────────────────────────────────────────── */
  const guest = isGuest(session);

  const uniqueServices = new Set(history.map((h) => h.serviceName)).size;
  const lastActivityValue = history[0]
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(history[0].createdAt))
    : "None yet";

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  return (
    <main className="dash-shell" suppressHydrationWarning style={{ overflowX: "hidden" }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      {guest && (
        <div className="guest-banner glass-panel" role="alert" style={{
          background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%)",
          border: "1px solid var(--border-brand)",
          boxShadow: "0 4px 20px rgba(56, 189, 248, 0.05)",
          padding: "1rem var(--layout-gutter)",
          borderRadius: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}>
          <p className="guest-banner-text" style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>
            You are viewing FlowCI Studio in preview mode. Sign up to unlock all features.
          </p>
          <div className="guest-banner-actions" style={{ display: "flex", gap: "0.5rem" }}>
            <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}>
              Sign up free
            </Link>
            <Link className="ghost-button" href="/login" style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>
              Log in
            </Link>
          </div>
        </div>
      )}

      <div id="main-content" style={{ padding: "1.5rem var(--layout-gutter) 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Editorial welcome banner ──────────────────────────────── */}
        <section className="welcome-editorial glass-panel" aria-label="Welcome" style={{
          position: "relative",
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 41, 59, 0.80) 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "var(--radius-card)",
          padding: "1.5rem",
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
        }}>
          {/* Thin gradient top accent bar */}
          <div aria-hidden="true" style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, var(--brand), var(--brand-accent))",
          }} />
          <div className="welcome-editorial-top" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem", marginBottom: "1.25rem" }}>
            <div className="welcome-editorial-identity" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {!guest && (session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  className="welcome-editorial-avatar"
                  width={44}
                  height={44}
                  style={{ borderRadius: "50%", border: "2px solid var(--border-brand)", boxShadow: "0 0 12px var(--brand-glow)" }}
                  unoptimized
                />
              ) : (
                <span className="welcome-editorial-avatar-placeholder" aria-hidden="true" style={{
                  width: 44,
                  height: 44,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: "var(--brand-light)",
                  border: "2px solid var(--border-brand)",
                  color: "var(--brand)",
                }}>{avatarInitial}</span>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                <p className="file-path-label" style={{ marginBottom: 0, fontSize: "0.72rem", color: "var(--brand)", letterSpacing: "0.08em" }}>SYSTEM.DASHBOARD</p>
                <h1 className="welcome-editorial" style={{ padding: 0, border: "none", margin: 0, display: "block", fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)", fontWeight: 800 }}>
                  {guest
                    ? "FlowCI Studio Dashboard"
                    : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
                </h1>
              </div>
            </div>

            {/* Right: pipeline track (visible on md+ only) */}
            <div style={{
              borderLeft: "1px solid var(--border)",
              paddingLeft: "clamp(0.75rem, 1.5vw, 1.25rem)",
              alignSelf: "start",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }} className="pipeline-track-aside">
              <p className="eyebrow" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>LIVE STATUS PIPELINE</p>
              <PipelineTrack reduced={prefersReducedMotion} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid var(--border-soft)", paddingTop: "1rem" }}>
            <p className="welcome-editorial-sub" style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {guest
                ? "You are browsing in guest mode. Sign up to unlock all features."
                : <>Connected on{" "}<strong style={{ color: "var(--brand)", textShadow: "0 0 10px rgba(56, 189, 248, 0.25)" }}>{session?.subscription.plan ?? "pro"}</strong>{" "}plan.</>}
            </p>
            <div className="welcome-editorial-actions" style={{ display: "flex", gap: "0.5rem" }}>
              {guest ? (
                <>
                  <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2.2rem" }}>Sign up free</Link>
                  <Link className="ghost-button" href="/login" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2.2rem" }}>Log in</Link>
                </>
              ) : (
                <>
                  <Link className="primary-button" href="/workflows" style={{ padding: "0.4rem 1.2rem", fontSize: "0.8rem", minHeight: "2.2rem" }}>Create project</Link>
                  <Link className="ghost-button" href="/subscribe" style={{ padding: "0.4rem 1.2rem", fontSize: "0.8rem", minHeight: "2.2rem" }}>Subscription</Link>
                </>
              )}
            </div>
          </div>

          {error        ? <p className="error-text" style={{ marginTop: "1rem" }}>{error}</p>         : null}
          {logoutMessage ? <p className="error-text" style={{ marginTop: "1rem" }}>{logoutMessage}</p> : null}
        </section>

        {/* ── Dashboard tab bar ─────────────────────────────────────── */}
        <div className="dash-tab-bar" role="tablist" aria-label="Dashboard sections" style={{
          position: "relative",
          display: "flex",
          gap: "0.25rem",
          padding: "0.25rem",
          background: "rgba(15, 23, 42, 0.4)",
          border: "1px solid var(--border-soft)",
          borderRadius: "0.6rem",
          width: "fit-content",
          marginBottom: "0.5rem"
        }}>
          {(["overview", "repositories", "activity"] as DashTab[]).map((tab) => (
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
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                zIndex: 1,
                fontWeight: 600,
                fontSize: "0.85rem"
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
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {tab === "overview"      ? "Overview"
               : tab === "repositories" ? "Repositories"
               : "Activity"}
            </button>
          ))}
        </div>

        {/* ── Overview tab ──────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            id="dash-panel-overview"
            role="tabpanel"
            aria-labelledby="dash-tab-overview"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* Bento Grid layout */}
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

            {/* Error states */}
            {!guest && projectsError ? (
              <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.2)", borderRadius: "10px" }}>
                <span className="error-inline-icon" aria-hidden="true" style={{ color: "var(--danger)" }}>⚠</span>
                <p className="error-inline-msg" style={{ margin: 0, fontSize: "0.82rem" }}>{projectsError}</p>
                <button className="error-retry-btn" type="button" onClick={loadProjects}>Retry</button>
              </div>
            ) : null}
            {!guest && historyError ? (
              <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)", border: "1px solid rgba(248, 113, 113, 0.2)", borderRadius: "10px" }}>
                <span className="error-inline-icon" aria-hidden="true" style={{ color: "var(--danger)" }}>⚠</span>
                <p className="error-inline-msg" style={{ margin: 0, fontSize: "0.82rem" }}>{historyError}</p>
                <button className="error-retry-btn" type="button" onClick={loadHistory}>Retry</button>
              </div>
            ) : null}
          </motion.div>
        )}

        {/* ── Repositories tab ──────────────────────────────────────── */}
        {activeTab === "repositories" && (
          <motion.div
            key="repositories"
            id="dash-panel-repositories"
            role="tabpanel"
            aria-labelledby="dash-tab-repositories"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {guest ? (
              <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 1.5rem", background: "rgba(15, 23, 42, 0.3)", borderRadius: "var(--radius-card)" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>Sign in to see your repositories.</p>
                <Link className="primary-button" href="/login" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Sign in</Link>
              </div>
            ) : (
              <>
                {/* ── Provisioned Projects (always shown for authenticated users) ── */}
                <section aria-label="Provisioned projects">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <p className="file-path-label" style={{ marginBottom: 0, color: "var(--brand)" }}>projects/provisioned.yml</p>
                    {!projectsLoading && projects.length > 0 && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", background: "rgba(255,255,255,0.04)", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid var(--border-soft)" }}>
                        {projects.length} project{projects.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {projectsLoading ? (
                    <div className="repo-grid">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="skeleton-card glass-panel" style={{ minHeight: "6.5rem", background: "rgba(15, 23, 42, 0.3)", animation: "state-pulse 1.5s infinite" }} />
                      ))}
                    </div>
                  ) : projectsError ? (
                    <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)" }}>
                      <span className="error-inline-icon" aria-hidden="true">⚠</span>
                      <p className="error-inline-msg">{projectsError}</p>
                      <button className="error-retry-btn" type="button" onClick={loadProjects}>Retry</button>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 1.5rem", background: "rgba(15, 23, 42, 0.3)", borderRadius: "var(--radius-card)" }}>
                      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem", fontSize: "0.88rem" }}>No projects provisioned yet.</p>
                      <Link className="primary-button" href="/workflows" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Create your first project</Link>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '0.75rem', alignItems: 'center' }}>
                        {syncResult && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Sync complete — {syncResult.orphaned} orphaned, {syncResult.reachable} reachable
                          </span>
                        )}
                        <button
                          onClick={() => void handleSync()}
                          disabled={isSyncing}
                          style={{
                            padding: '0.4rem 0.9rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid rgba(56,189,248,0.3)',
                            background: 'rgba(56,189,248,0.08)',
                            color: 'var(--brand)',
                            cursor: isSyncing ? 'not-allowed' : 'pointer',
                            opacity: isSyncing ? 0.6 : 1,
                          }}
                        >
                          {isSyncing ? 'Syncing...' : 'Sync with GitHub'}
                        </button>
                      </div>
                    <div className="repo-grid" aria-label="Provisioned projects">
                      {projects.map((project) => (
                        <article key={project.id} className="repo-card glass-panel" style={{ borderLeft: project.status === "provisioned" ? "3px solid var(--success)" : project.status === "failed" ? "3px solid var(--danger)" : project.status === "orphaned" ? "3px solid rgba(251,146,60,0.8)" : "3px solid var(--brand)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                            <a
                              href={project.repoUrl ?? `https://github.com/${project.repoFullName}`}
                              target="_blank"
                              rel="noreferrer"
                              className="repo-card-title"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                              </svg>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {project.repoFullName.split("/")[1] ?? project.repoFullName}
                              </span>
                            </a>
                            <span style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "4px",
                              background: project.status === "provisioned" ? "rgba(52, 211, 153, 0.1)" : project.status === "failed" ? "rgba(248, 113, 113, 0.1)" : project.status === "orphaned" ? "rgba(251, 146, 60, 0.1)" : "rgba(56, 189, 248, 0.1)",
                              color: project.status === "provisioned" ? "var(--success)" : project.status === "failed" ? "var(--danger)" : project.status === "orphaned" ? "rgb(251,146,60)" : "var(--brand)",
                              border: project.status === "provisioned" ? "1px solid rgba(52, 211, 153, 0.2)" : project.status === "failed" ? "1px solid rgba(248, 113, 113, 0.2)" : project.status === "orphaned" ? "1px solid rgba(251, 146, 60, 0.3)" : "1px solid rgba(56, 189, 248, 0.2)",
                            }}>
                              {project.status}
                            </span>
                          </div>

                          <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", margin: 0, fontFamily: "ui-monospace, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {project.serviceName}
                          </p>

                          <div className="repo-card-meta">
                            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontFamily: "ui-monospace, monospace" }}>
                              {project.workflowPath}
                            </span>
                            {project.githubCommitUrl ? (
                              <a href={project.githubCommitUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                View commit
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="7" y1="17" x2="17" y2="7"></line>
                                  <polyline points="7 7 17 7 17 17"></polyline>
                                </svg>
                              </a>
                            ) : (
                              <a href={project.repoUrl ?? `https://github.com/${project.repoFullName}`} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                Browse
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="7" y1="17" x2="17" y2="7"></line>
                                  <polyline points="7 7 17 7 17 17"></polyline>
                                </svg>
                              </a>
                            )}
                          </div>

                          {/* Disconnect confirmation or button */}
                          {confirmDisconnectId === project.id ? (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1, alignSelf: 'center' }}>
                                Remove from FlowCI? GitHub repo is untouched.
                              </span>
                              <button
                                onClick={() => void handleDisconnect(project.id)}
                                disabled={disconnectingId === project.id}
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: 600, borderRadius: '5px', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)', color: 'var(--danger)', cursor: 'pointer' }}
                              >
                                {disconnectingId === project.id ? 'Removing...' : 'Yes, remove'}
                              </button>
                              <button
                                onClick={() => setConfirmDisconnectId(null)}
                                style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDisconnectId(project.id)}
                              style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'rgba(248,113,113,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
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

                {/* ── Connected GitHub repos (only shown when available via OAuth token) ── */}
                {!reposLoading && repos.length > 0 && (
                  <section aria-label="GitHub repositories">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <p className="file-path-label" style={{ marginBottom: 0, color: "var(--brand)" }}>repos/github.yml</p>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", background: "rgba(255,255,255,0.04)", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid var(--border-soft)" }}>
                        {repos.length} GitHub repos
                      </span>
                    </div>
                    <div className="repo-grid" aria-label="GitHub repositories">
                      {repos.map((repo) => (
                        <article key={repo.id} className="repo-card glass-panel">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="repo-card-title">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                              </svg>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {repo.fullName.split("/")[1]}
                              </span>
                            </a>
                            <span style={{
                              fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", padding: "0.1rem 0.4rem", borderRadius: "4px",
                              background: repo.private ? "rgba(255, 255, 255, 0.05)" : "rgba(52, 211, 153, 0.1)",
                              color: repo.private ? "var(--text-muted)" : "var(--success)",
                              border: repo.private ? "1px solid var(--border-soft)" : "1px solid rgba(52, 211, 153, 0.2)",
                            }}>
                              {repo.private ? "private" : "public"}
                            </span>
                          </div>
                          {repo.description ? (
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {repo.description}
                            </p>
                          ) : (
                            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0, fontStyle: "italic" }}>No description provided.</p>
                          )}
                          <div className="repo-card-meta">
                            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontFamily: "ui-monospace, monospace" }}>ID: {repo.id}</span>
                            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              Browse
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="7" y1="17" x2="17" y2="7"></line>
                                <polyline points="7 7 17 7 17 17"></polyline>
                              </svg>
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Activity tab ──────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <motion.div
            key="activity"
            id="dash-panel-activity"
            role="tabpanel"
            aria-labelledby="dash-tab-activity"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <section aria-label="Recent workflows">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <p className="file-path-label" style={{ marginBottom: 0, color: "var(--brand)" }}>workflows/recent.yml</p>
                {!historyLoading && history.length > 0 && (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", background: "rgba(255,255,255,0.04)", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid var(--border-soft)" }}>
                    {history.length} generated workflows
                  </span>
                )}
              </div>

              {historyLoading ? (
                <div className="repo-grid">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton-card glass-panel" style={{ minHeight: "8rem", background: "rgba(15, 23, 42, 0.3)", animation: "state-pulse 1.5s infinite" }} />
                  ))}
                </div>
              ) : historyError ? (
                <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)" }}>
                  <span className="error-inline-icon" aria-hidden="true">⚠</span>
                  <p className="error-inline-msg">{historyError}</p>
                  <button className="error-retry-btn" type="button" onClick={loadHistory}>Retry</button>
                </div>
              ) : history.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 1.5rem", background: "rgba(15, 23, 42, 0.3)" }}>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>No workflow history yet.</p>
                  <Link className="primary-button" href="/workflows" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Create your first project</Link>
                </div>
              ) : (
                <div className="repo-grid">
                  {history.map((item) => (
                    <article key={item.id} className="repo-card glass-panel" style={{ borderLeft: "3px solid var(--brand)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          background: "rgba(56, 189, 248, 0.1)",
                          color: "var(--brand)",
                          border: "1px solid rgba(56, 189, 248, 0.15)",
                        }}>
                          {item.stack}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Intl.DateTimeFormat("en-PH", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                        </span>
                      </div>
                      
                      <h3 style={{ fontSize: "1rem", margin: 0, fontWeight: 700 }}>{item.serviceName}</h3>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", background: "rgba(0,0,0,0.15)", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Workflow File</span>
                        <span style={{ fontSize: "0.75rem", fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.outputFileName}
                        </span>
                      </div>

                      <div className="repo-card-meta">
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                          Actions config built
                        </span>
                        <Link href="/workflows" style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          View Studio
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
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

      </div>
    </main>
  );
}
