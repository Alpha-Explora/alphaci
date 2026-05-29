"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout, getProjects, getWorkflowHistory } from "@/lib/api/client";
import type { ProvisionedProject, WorkflowHistoryItem } from "@/lib/api/contracts";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const quickActions = [
  { label: "Create Project", href: "/workflows" },
  { label: "Manage plan", href: "/subscribe" },
];

export default function HomeDashboardPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
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
      return;
    }

    if (status === "signed-in" && !hasSubscription) {
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
            <Link className="ghost-button" href="/login?next=/home">
              Go to login
            </Link>
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

  const uniqueServices = new Set(history.map((h) => h.serviceName)).size;
  const kpiCards = [
    { label: "Projects created", value: projectsLoading ? "..." : String(projects.length) },
    { label: "Workflows generated", value: historyLoading ? "..." : String(history.length) },
    { label: "Services configured", value: historyLoading ? "..." : String(uniqueServices) },
    {
      label: "Last activity",
      value: historyLoading
        ? "..."
        : history[0]
        ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(history[0].createdAt))
        : "None yet",
    },
  ];

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
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

      <section className="section-card glass-panel">
        <p className="hero-kicker">Home</p>
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
            <span className="user-avatar-placeholder" aria-hidden="true">
              {(session?.user.name ?? session?.user.login ?? "U").slice(0, 1).toUpperCase()}
            </span>
          )}
          <h1>Welcome back, {session?.user.name ?? session?.user.login ?? "builder"}.</h1>
        </div>
        <p>
          You are connected with your OAuth account and an active <strong>{session?.subscription.plan ?? "pro"}</strong>{" "}
          plan.
        </p>

        <div className="hero-actions">
          <Link className="primary-button" href="/workflows">
            Create project
          </Link>
          <Link className="ghost-button" href="/subscribe">
            View subscription
          </Link>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}
      </section>

      <section className="section-card glass-panel">
        <div className="section-header">
          <h2>Release pulse</h2>
          <p>Quick status snapshot.</p>
        </div>
        <div className="kpi-grid">
          {kpiCards.map((kpi) => (
            <article className="kpi-card" key={kpi.label}>
              <p>{kpi.label}</p>
              <h3>{kpi.value}</h3>
            </article>
          ))}
        </div>
        {projectsError ? <p className="error-text">{projectsError}</p> : null}
        {historyError ? <p className="error-text">{historyError}</p> : null}
      </section>

      {history.length > 0 && (
        <section className="section-card glass-panel">
          <div className="section-header">
            <h2>Recent workflows</h2>
            <p>Last {Math.min(history.length, 3)} generated.</p>
          </div>
          <div className="action-grid">
            {history.slice(0, 3).map((item) => (
              <article key={item.id} className="kpi-card">
                <p style={{ fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {item.stack}
                </p>
                <h3 style={{ fontSize: "0.98rem" }}>{item.serviceName}</h3>
                <p>{item.outputFileName}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section-card glass-panel">
        <div className="section-header">
          <h2>Quick actions</h2>
        </div>
        <div className="action-grid">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className="action-tile">
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
