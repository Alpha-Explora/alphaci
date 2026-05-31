"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, getProjects, getWorkflowHistory } from "@/lib/api/client";
import type { ProvisionedProject, WorkflowHistoryItem } from "@/lib/api/contracts";
import { hasActiveSubscription } from "@/lib/auth/subscription";

/* ── Constants ─────────────────────────────────────────────────────────────── */

const quickActions = [
  { label: "create-project",     href: "/workflows",  display: "Create Project" },
  { label: "view-workflows",     href: "/workflows",  display: "View Workflows" },
  { label: "manage-plan",        href: "/subscribe",  display: "Manage Plan" },
];

const pipelineStages = ["Source", "Lint", "Test", "Build", "Deploy"];

const pipelineContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const pipelineDotVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
};

/* ── Sub-components ────────────────────────────────────────────────────────── */

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

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function HomeDashboardPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const prefersReducedMotion = useReducedMotion();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const hasSubscription = hasActiveSubscription(session);

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login?next=/home");
    } else if (status === "signed-in" && !hasSubscription) {
      router.replace("/subscribe");
    }
  }, [hasSubscription, router, status]);

  useEffect(() => {
    if (status !== "signed-in") return;

    getWorkflowHistory(25)
      .then((response) => { setHistory(response.items); setHistoryError(null); })
      .catch(() => setHistoryError("Could not load workflow history."))
      .finally(() => setHistoryLoading(false));
    getProjects(25)
      .then((response) => { setProjects(response.items); setProjectsError(null); })
      .catch(() => setProjectsError("Could not load projects."))
      .finally(() => setProjectsLoading(false));
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

  /* Guard states */
  if (status === "loading") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>Loading your home page...</h1>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>We could not verify your session.</h1>
          <p className="helper-text">Please retry or return to Home.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => void refresh()}>
              Retry session check
            </button>
            <Link className="ghost-button" href="/login?next=/home">Go to login</Link>
          </div>
        </section>
      </main>
    );
  }

  if (status !== "signed-in" || !hasSubscription) {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>Routing you to the correct page...</h1>
        </section>
      </main>
    );
  }

  /* Signed-in view */
  const uniqueServices = new Set(history.map((h) => h.serviceName)).size;
  const lastActivityValue = history[0]
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(history[0].createdAt))
    : "None yet";

  const kpiCards = [
    {
      label: "Workflows generated",
      value: historyLoading ? "..." : String(history.length),
      dominant: true,
    },
    {
      label: "Projects created",
      value: projectsLoading ? "..." : String(projects.length),
      dominant: false,
    },
    {
      label: "Services configured",
      value: historyLoading ? "..." : String(uniqueServices),
      dominant: false,
    },
    {
      label: "Last activity",
      value: historyLoading ? "..." : lastActivityValue,
      dominant: false,
    },
  ];

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase();

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav">
        <div className="brand-mark">
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </div>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/home">Dashboard</Link>
          <Link href="/">Home</Link>
          <Link href="/workflows">Workflows</Link>
          <Link href="/subscribe">Billing</Link>
        </nav>
        <button className="ghost-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </header>

      {/* ── Welcome banner — split layout ──────────────────────────── */}
      <section className="section-card glass-panel" style={{ padding: "clamp(1.4rem, 2.5vw, 2rem)" }}>
        <div className="welcome-banner-split">
          {/* Left: identity + greeting */}
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p className="file-path-label">home/dashboard.yml</p>
            <div className="welcome-header">
              {session?.user.avatarUrl ? (
                <Image
                  src={session.user.avatarUrl}
                  alt={session.user.name ?? session.user.login}
                  className="user-avatar"
                  width={48}
                  height={48}
                  unoptimized
                />
              ) : (
                <span className="user-avatar-placeholder" aria-hidden="true">{avatarInitial}</span>
              )}
              <h1 style={{ fontSize: "clamp(1.3rem, 2.5vw, 1.9rem)" }}>
                Welcome back, {session?.user.name ?? session?.user.login ?? "builder"}.
              </h1>
            </div>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.9rem" }}>
              Connected on{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {session?.subscription.plan ?? "pro"}
              </strong>{" "}
              plan.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/workflows">Create project</Link>
              <Link className="ghost-button" href="/subscribe">View subscription</Link>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
            {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}
          </div>

          {/* Right: pipeline track */}
          <div style={{
            borderLeft: "1px solid var(--border-subtle)",
            paddingLeft: "clamp(1rem, 3vw, 2rem)",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>Pipeline stages</p>
            <PipelineTrack reduced={prefersReducedMotion} />
          </div>
        </div>
      </section>

      {/* ── KPI editorial grid ──────────────────────────────────────── */}
      <section className="section-card glass-panel" style={{ padding: "clamp(1.2rem, 2.2vw, 1.8rem)" }}>
        <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>metrics/release-pulse.yml</p>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>Release pulse</h2>
        <div className="kpi-grid-editorial">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className={`kpi-cell${kpi.dominant ? " kpi-cell-dominant" : ""}`}
            >
              <p>{kpi.label}</p>
              <h3>{kpi.value}</h3>
            </div>
          ))}
        </div>
        {projectsError ? <p className="error-text" style={{ marginTop: "0.75rem" }}>{projectsError}</p> : null}
        {historyError ? <p className="error-text" style={{ marginTop: "0.75rem" }}>{historyError}</p> : null}
      </section>

      {/* ── Recent workflows ────────────────────────────────────────── */}
      {history.length > 0 && (
        <section className="section-card glass-panel" style={{ padding: "clamp(1.2rem, 2.2vw, 1.8rem)" }}>
          <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>workflows/recent.yml</p>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>
            {"Recent workflows "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "0.82rem" }}>
              last {Math.min(history.length, 3)} generated
            </span>
          </h2>
          <div className="kpi-grid-editorial" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {history.slice(0, 3).map((item) => (
              <div key={item.id} className="kpi-cell">
                <p style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand)" }}>
                  {item.stack}
                </p>
                <h3 style={{ fontSize: "0.98rem" }}>{item.serviceName}</h3>
                <p>{item.outputFileName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick actions — command list ─────────────────────────────── */}
      <section className="section-card glass-panel" style={{ padding: "clamp(1.2rem, 2.2vw, 1.8rem)" }}>
        <p className="file-path-label" style={{ marginBottom: "0.75rem" }}>actions/quick.yml</p>
        <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Quick actions</h2>
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
    </main>
  );
}
