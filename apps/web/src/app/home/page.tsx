"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, getProjects, getWorkflowHistory, getGithubRepos } from "@/lib/api/client";
import type { ProvisionedProject, WorkflowHistoryItem, GitHubRepo } from "@/lib/api/contracts";
import { isGuest } from "@/lib/auth/subscription";

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

/* ── Nav links (shared) ─────────────────────────────────────────────────────── */

const navItems = [
  { label: "Dashboard",  href: "/home" },
  { label: "Workflows",  href: "/workflows" },
];

/* ── Sub-components ─────────────────────────────────────────────────────────── */

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

/* ── Shared Navbar ──────────────────────────────────────────────────────────── */

interface NavbarProps {
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
}

function AppNav({ guest, session, onLogout, isLoggingOut }: Readonly<NavbarProps>) {
  const pathname = usePathname();
  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  return (
    <header className="dash-nav">
      <Link className="brand-mark" href="/home">
        <PipelineLogo size={22} />
        <span>FlowCI Studio</span>
      </Link>

      <span className="nav-separator" aria-hidden="true" />

      <nav aria-label="Primary" className="nav-links">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "nav-active" : ""}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        {guest
          ? <Link href="/subscribe" className={pathname === "/subscribe" ? "nav-active" : ""}>Billing</Link>
          : <Link href="/settings" className={pathname === "/settings" ? "nav-active" : ""}>Settings</Link>}
      </nav>

      <div className="nav-right">
        {!guest && (
          <>
            <div className="user-pill" aria-label={`Signed in as ${session?.user.login ?? "user"}`}>
              {session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  className="user-pill-avatar"
                  width={26}
                  height={26}
                  unoptimized
                />
              ) : (
                <span className="user-pill-placeholder" aria-hidden="true">{avatarInitial}</span>
              )}
              <span className="user-pill-login">{session?.user.login ?? "user"}</span>
              {session?.subscription.plan && (
                <span className="user-pill-plan">{session.subscription.plan}</span>
              )}
            </div>

            <button
              className="sign-out-icon-btn"
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? "Signing out…" : "Sign out"}
              title={isLoggingOut ? "Signing out…" : "Sign out"}
            >
              {isLoggingOut ? (
                <span className="btn-spinner" aria-hidden="true" style={{ width: "13px", height: "13px", borderWidth: "1.5px" }} />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              )}
            </button>
          </>
        )}

        {guest && (
          <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.82rem", minHeight: "2.2rem" }}>
            Sign up
          </Link>
        )}
      </div>
    </header>
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

  const kpiCards = [
    { label: "Workflows generated", value: historyLoading ? null : String(history.length), dominant: true },
    { label: "Projects created",    value: projectsLoading ? null : String(projects.length), dominant: false },
    { label: "Services configured", value: historyLoading ? null : String(uniqueServices), dominant: false },
    { label: "Last activity",       value: historyLoading ? null : lastActivityValue, dominant: false },
  ];

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      {guest && (
        <div className="guest-banner" role="alert">
          <p className="guest-banner-text">
            You are viewing FlowCI Studio in preview mode. Sign up to unlock all features.
          </p>
          <div className="guest-banner-actions">
            <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}>
              Sign up free
            </Link>
            <Link className="ghost-button" href="/login" style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>
              Log in
            </Link>
          </div>
        </div>
      )}

      <div id="main-content" style={{ padding: "0 clamp(1rem, 3vw, 2rem)", flex: 1 }}>

        {/* ── Editorial welcome banner ──────────────────────────────── */}
        <section className="welcome-editorial" aria-label="Welcome">
          <div className="welcome-editorial-top">
            <div className="welcome-editorial-identity">
              {!guest && (session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  className="welcome-editorial-avatar"
                  width={36}
                  height={36}
                  unoptimized
                />
              ) : (
                <span className="welcome-editorial-avatar-placeholder" aria-hidden="true" style={{ width: 36, height: 36, fontSize: '1rem' }}>{avatarInitial}</span>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                <p className="file-path-label" style={{ marginBottom: 0, fontSize: "0.7rem" }}>home/dashboard.yml</p>
                <h1 className="welcome-editorial" style={{ padding: 0, border: "none", margin: 0, display: "block", fontSize: "clamp(1.2rem, 2vw, 1.5rem)" }}>
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
              gap: "0.25rem",
            }} className="pipeline-track-aside">
              <p className="eyebrow">Pipeline stages</p>
              <PipelineTrack reduced={prefersReducedMotion} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <p className="welcome-editorial-sub">
              {guest
                ? "You are browsing in guest mode. Sign up to unlock all features."
                : <>Connected on{" "}<strong style={{ color: "var(--text-primary)" }}>{session?.subscription.plan ?? "pro"}</strong>{" "}plan.</>}
            </p>
            <div className="welcome-editorial-actions">
              {guest ? (
                <>
                  <Link className="primary-button" href="/signup" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2rem" }}>Sign up free</Link>
                  <Link className="ghost-button" href="/login" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2rem" }}>Log in</Link>
                </>
              ) : (
                <>
                  <Link className="primary-button" href="/workflows" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2rem" }}>Create project</Link>
                  <Link className="ghost-button" href="/subscribe" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2rem" }}>Subscription</Link>
                </>
              )}
            </div>
          </div>

          {error        ? <p className="error-text">{error}</p>         : null}
          {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}
        </section>

        {/* ── Dashboard tab bar ─────────────────────────────────────── */}
        <div className="dash-tab-bar" role="tablist" aria-label="Dashboard sections">
          {(["overview", "repositories", "activity"] as DashTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`dash-tab-${tab}`}
              aria-controls={`dash-panel-${tab}`}
              aria-selected={activeTab === tab}
              className={`dash-tab-btn${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
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
            {/* KPI grid */}
            <section aria-label="Release pulse">
              <p className="file-path-label" style={{ marginBottom: "0.65rem" }}>metrics/release-pulse.yml</p>
              <h2 style={{ margin: "0 0 0.85rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>Release pulse</h2>
              <div className="kpi-grid-editorial">
                {kpiCards.map((kpi) => (
                  <div key={kpi.label} className={`kpi-cell${kpi.dominant ? " kpi-cell-dominant" : ""}`}>
                    <p>{kpi.label}</p>
                    <h3>
                      {kpi.value === null
                        ? <span className="kpi-skeleton-value" aria-label="Loading…" />
                        : kpi.value}
                    </h3>
                  </div>
                ))}
              </div>
            </section>

            {/* Error states */}
            {!guest && projectsError ? (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{projectsError}</p>
                <button className="error-retry-btn" type="button" onClick={loadProjects}>Retry</button>
              </div>
            ) : null}
            {!guest && historyError ? (
              <div className="error-inline" role="alert">
                <span className="error-inline-icon" aria-hidden="true">⚠</span>
                <p className="error-inline-msg">{historyError}</p>
                <button className="error-retry-btn" type="button" onClick={loadHistory}>Retry</button>
              </div>
            ) : null}

            {/* Quick actions */}
            <section aria-label="Quick actions">
              <p className="file-path-label" style={{ marginBottom: "0.65rem" }}>actions/quick.yml</p>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>Quick actions</h2>
              <nav className="command-list" aria-label="Quick actions">
                {quickActions.map((action) => (
                  <Link key={action.label} href={action.href} className="command-item">
                    {action.label}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginLeft: "auto" }}>
                      {action.display}
                    </span>
                  </Link>
                ))}
              </nav>
            </section>
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
          >
            {guest ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>Sign in to see your GitHub repositories.</p>
                <Link className="primary-button" href="/login" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Sign in</Link>
              </div>
            ) : (
              <section aria-label="GitHub repositories">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <p className="file-path-label" style={{ marginBottom: 0 }}>repos/github.yml</p>
                  {!reposLoading && repos.length > 0 && (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {repos.length} repo{repos.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", letterSpacing: "-0.02em" }}>GitHub repositories</h2>

                {reposLoading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    {[0, 1, 2].map((i) => <div key={i} className="skeleton-card" style={{ minHeight: "3.2rem" }} />)}
                  </div>
                ) : reposError ? (
                  <div className="error-inline" role="alert">
                    <span className="error-inline-icon" aria-hidden="true">⚠</span>
                    <p className="error-inline-msg">{reposError}</p>
                    <button className="error-retry-btn" type="button" onClick={loadRepos}>Retry</button>
                  </div>
                ) : repos.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>No GitHub repositories found on your account.</p>
                ) : (
                  <ul className="repo-full-list" aria-label="GitHub repositories">
                    {repos.map((repo) => (
                      <li key={repo.id} className="repo-full-item">
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="repo-full-name"
                        >
                          {repo.fullName}
                        </a>
                        <div className="repo-full-meta">
                          {repo.description ? (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", maxWidth: "24ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {repo.description}
                            </span>
                          ) : null}
                          <span className={`repo-visibility-badge${repo.private ? "" : " public"}`}>
                            {repo.private ? "private" : "public"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
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
              <p className="file-path-label" style={{ marginBottom: "0.65rem" }}>workflows/recent.yml</p>
              <h2 style={{ margin: "0 0 0.85rem", fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
                Recent workflows
                {!historyLoading && history.length > 0 && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.82rem", marginLeft: "0.5rem" }}>
                    {history.length} generated
                  </span>
                )}
              </h2>

              {historyLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem" }}>
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton-card" style={{ minHeight: "5rem" }} />)}
                </div>
              ) : historyError ? (
                <div className="error-inline" role="alert">
                  <span className="error-inline-icon" aria-hidden="true">⚠</span>
                  <p className="error-inline-msg">{historyError}</p>
                  <button className="error-retry-btn" type="button" onClick={loadHistory}>Retry</button>
                </div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>No workflow history yet.</p>
                  <Link className="primary-button" href="/workflows" style={{ padding: "0.65rem 1.5rem", fontSize: "0.9rem" }}>Create your first project</Link>
                </div>
              ) : (
                <div className="kpi-grid-editorial" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                  {history.map((item) => (
                    <div key={item.id} className="kpi-cell" style={{ gap: "0.4rem" }}>
                      <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand)", margin: 0 }}>
                        {item.stack}
                      </p>
                      <h3 style={{ fontSize: "0.95rem", margin: 0 }}>{item.serviceName}</h3>
                      <p style={{ fontSize: "0.78rem", margin: 0 }}>{item.outputFileName}</p>
                    </div>
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
