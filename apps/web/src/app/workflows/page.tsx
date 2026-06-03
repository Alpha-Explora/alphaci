"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { WorkflowBuilder } from "../../components/product/workflow-builder";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { isGuest } from "@/lib/auth/subscription";

export default function WorkflowsPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  // No redirect — unauthenticated and non-subscribed users see the page in guest preview mode

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
        <header className="marketing-nav glass-panel">
          <div className="brand-mark">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </div>
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

  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <header className="marketing-nav glass-panel">
          <div className="brand-mark">
            <PipelineLogo size={22} />
            <span>FlowCI Studio</span>
          </div>
          <Link className="ghost-button" href="/login?next=/workflows">Sign in</Link>
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

  // signed-out falls through to guest preview — isGuest() handles the banner
  const guest = isGuest(session);

  return (
    <main className="flow-shell page-shell">
      <FlowBackground />

      <header className="marketing-nav glass-panel">
        <div className="brand-mark">
          <PipelineLogo size={22} />
          <span>FlowCI Studio</span>
        </div>
        <nav aria-label="Primary" className="nav-links">
          <Link href="/home">Dashboard</Link>
          <Link href="/workflows">Workflows</Link>
          {guest
            ? <Link href="/subscribe">Billing</Link>
            : <Link href="/settings">Settings</Link>}
        </nav>
        {!guest && (
          <button className="ghost-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        )}
      </header>

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

      <WorkflowBuilder
        login={session?.user.login ?? "builder"}
        plan={session?.subscription.plan ?? "pro"}
        guest={guest}
      />
    </main>
  );
}
