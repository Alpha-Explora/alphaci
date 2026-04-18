"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FlowBackground } from "@/components/layout/flow-background";
import { WorkflowBuilder } from "../../components/product/workflow-builder";
import { useAuthSession } from "@/hooks/use-auth-session";
import { logout } from "@/lib/api/client";
import { hasActiveSubscription } from "@/lib/auth/subscription";

export default function WorkflowsPage() {
  const router = useRouter();
  const { status, session, error, refresh } = useAuthSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const hasSubscription = hasActiveSubscription(session);

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login?next=/workflows");
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
          <h1>Loading workflow studio...</h1>
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

  if (status !== "signed-in" || !hasSubscription) {
    return (
      <main className="flow-shell page-shell">
        <FlowBackground />
        <section className="section-card glass-panel">
          <h1>Routing you to the right page...</h1>
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
          <Link href="/">Home</Link>
          <Link href="/subscribe">Billing</Link>
          <Link href="/home">Dashboard</Link>
        </nav>
        <button className="ghost-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </header>

      {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}

      <WorkflowBuilder
        login={session?.user.login ?? "builder"}
        plan={session?.subscription.plan ?? "pro"}
      />
    </main>
  );
}
