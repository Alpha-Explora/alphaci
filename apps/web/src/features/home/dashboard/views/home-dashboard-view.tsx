"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { useAuthSession } from "@/features/auth/session";

import { HomeDashboardContent } from "./home-dashboard-content";

/**
 * Public view for the home route.
 *
 * Owns the session guards and the WorkspaceProvider the dashboard reads its
 * selection from. Sign-out goes through useAuthSession rather than calling
 * logout() here — a view performing its own I/O is what this layer prevents.
 */
export function HomeDashboardView() {
  const router = useRouter();
  const { status, session, error: sessionError, refresh, signOut, isSigningOut } =
    useAuthSession();
  // Surfaced in the dashboard header rather than swallowed: a failed sign-out
  // leaves the user still signed in, and they need to know that.
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Internal workspace: there is no guest/preview mode. Unauthenticated
  // visitors are sent to sign-in rather than shown a preview dashboard.
  useEffect(() => {
    if (status === "signed-out") router.replace("/login?next=/home");
  }, [status, router]);

  async function handleLogout() {
    setLogoutMessage(null);
    try {
      await signOut();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    }
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading your dashboard" />;
  }

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
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/home">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") {
    return <PipelineLoader label="Redirecting to sign in" />;
  }

  return (
    <WorkspaceProvider>
      <HomeDashboardContent
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
        prefersReducedMotion={prefersReducedMotion}
        enabled={status === "signed-in"}
        sessionError={sessionError}
        logoutMessage={logoutMessage}
      />
    </WorkspaceProvider>
  );
}
