"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { useAuthSession } from "@/hooks/use-auth-session";
import { isGuest } from "@/lib/auth/subscription";

import { RunsListContent } from "./runs-list-content";

/**
 * Public view for the runs list route.
 *
 * Owns the session guards and the Suspense boundary; the list itself lives in
 * RunsListContent because that is what reads search params. Sign-out goes
 * through useAuthSession rather than calling logout() here — a view performing
 * its own I/O is the thing this layer exists to prevent.
 */
export function RunsListView() {
  const router = useRouter();
  const { status, session, error: sessionError, refresh, signOut, isSigningOut } =
    useAuthSession();
  const prefersReducedMotion = useReducedMotion();

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading pipeline runs" />;
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
            {sessionError && (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {sessionError}
              </p>
            )}
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/runs">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<PipelineLoader label="Loading pipeline runs" />}>
      <RunsListContent
        guest={isGuest(session)}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
        prefersReducedMotion={prefersReducedMotion}
      />
    </Suspense>
  );
}
