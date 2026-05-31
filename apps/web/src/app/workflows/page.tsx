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
        <section className="section-card glass-panel">
          <h1>Loading Create Project...</h1>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>We could not verify your workflow access.</h1>
          <p className="helper-text">Retry session check or return to Home.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => void refresh()}>
              Retry session check
            </button>
            <Link className="ghost-button" href="/login?next=/workflows">
              Go to login
            </Link>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
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
          <Link href="/subscribe">Billing</Link>
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
