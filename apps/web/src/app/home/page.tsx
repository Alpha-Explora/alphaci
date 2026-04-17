"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

const kpiCards = [
  { label: "Pipeline success", value: "98%" },
  { label: "Avg build time", value: "6m 21s" },
  { label: "Failed runs", value: "2 this week" },
];

const quickActions = [
  { label: "Open workflows", href: "/workflows" },
  { label: "Manage plan", href: "/subscribe" },
];

export default function HomeDashboardPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

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

  async function handleLogout() {
    setIsLoggingOut(true);
    setLogoutMessage(null);

    try {
      await logout();
      await refresh();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the landing link.");
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
          <p className="helper-text">Please retry or return to the landing page.</p>
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

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <p className="brand-mark">FlowCI Studio</p>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/home">Home</Link>
          <Link href="/">Landing</Link>
          <Link href="/workflows">Workflows</Link>
          <Link href="/subscribe">Billing</Link>
        </nav>
        <button className="ghost-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </header>

      <section className="section-card glass-panel">
        <p className="hero-kicker">Home</p>
        <h1>Welcome back, {session?.user.name ?? session?.user.login ?? "builder"}.</h1>
        <p>You are connected to GitHub with an active <strong>{session?.subscription.plan ?? "pro"}</strong> plan.</p>

        <div className="hero-actions">
          <Link className="primary-button" href="/workflows">
            Open workflow studio
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
      </section>

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
