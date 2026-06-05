"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { WorkflowBuilder } from "../../components/product/workflow-builder";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { isGuest } from "@/lib/auth/subscription";

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function WorkflowsPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut]   = useState(false);
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
            <div className="state-spinner" role="status" aria-label="Loading workflows" />
            <h1>Loading Create Project</h1>
            <p>Preparing your workflow studio.</p>
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
            <Link className="ghost-button" href="/login?next=/workflows" style={{ padding: "0.2rem 0.75rem", fontSize: "0.82rem", minHeight: "1.8rem" }}>Sign in</Link>
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
            <p>We could not verify your workflow access. Retry or sign in again.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => void refresh()}>
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/workflows">Go to login</Link>
            </div>
            {error ? <p className="error-text" style={{ fontSize: "0.82rem" }}>{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  /* ── Signed-in or guest preview ─────────────────────────────────────────── */
  const guest = isGuest(session);

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

      {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}

      <div id="main-content" style={{ padding: "0" }}>
        <div style={{
          padding: "1.25rem var(--layout-gutter) 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{
            margin: 0,
            fontSize: "0.65rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--brand)",
          }}>
            FlowCI Studio / Workflows
          </p>
          <h1 style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)", margin: 0 }}>
            Create and manage projects
          </h1>
        </div>
        <WorkflowBuilder
          login={session?.user.login ?? "builder"}
          plan={session?.subscription.plan ?? "pro"}
          guest={guest}
        />
      </div>
    </main>
  );
}
