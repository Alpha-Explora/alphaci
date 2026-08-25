"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/features/workspace/selection";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

import { TeamsDetailContent } from "./teams-detail-content";

/**
 * Public view for the teams route.
 *
 * Owns the session guards and the WorkspaceProvider the content reads its
 * selection from. Sign-out goes through useAuthSession rather than calling
 * logout() here — a view performing its own I/O is what this layer prevents.
 */
export function TeamsDetailView() {
  const router = useRouter();
  const { status, session, error: sessionError, refresh, signOut, isSigningOut } =
    useAuthSession();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login?next=/teams");
  }, [router, status]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (status === "loading") return <PipelineLoader label="Loading team" />;

  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>
              We could not verify your session. Please retry or sign in again.
            </p>
            {sessionError ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {sessionError}
              </p>
            ) : null}
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/teams">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "signed-out") return null;

  return (
    <WorkspaceProvider>
      <TeamsDetailContent
        guest={isGuest(session)}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
        prefersReducedMotion={prefersReducedMotion}
        enabled={status === "signed-in"}
      />
    </WorkspaceProvider>
  );
}
