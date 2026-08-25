"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/features/workspace/selection";
import { WorkflowBuilder } from "./workflow-builder";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

/* Level 0 in the skill's progressive depth: the studio's data belongs to
 * WorkflowBuilder and the hooks it owns, so this surface has no view-model and
 * no data layer of its own. Sign-out is the one action, via useAuthSession. */

export function WorkflowStudioView() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error, refresh, signOut, isSigningOut } =
    useAuthSession();
  // Surfaced rather than swallowed: a failed sign-out leaves the user signed in.
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutMessage(null);
    try {
      await signOut();
      router.push("/");
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    }
  }

  /* ── Guard: loading ─────────────────────────────────────────────────────── */
  if (status === "loading") {
    return <PipelineLoader label="Loading Workflow Studio" />;
  }

  /* ── Guard: error ───────────────────────────────────────────────────────── */
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
              We could not verify your workflow access. Retry or sign in again.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void refresh()}
              >
                Retry
              </button>
              <Link className="ghost-button" href="/login?next=/workflows">
                Go to login
              </Link>
            </div>
            {error ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  /* ── Signed-in or guest preview ─────────────────────────────────────────── */
  const guest = isGuest(session);

  return (
    <WorkspaceProvider>
      <main className="dash-shell" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <FlowBackground />

        <AppNav
          guest={guest}
          session={session}
          onLogout={() => void handleLogout()}
          isLoggingOut={isSigningOut}
        />

        {guest && (
          <div className="guest-banner" role="alert">
            <p className="guest-banner-text">
              You are viewing ALPHACI in preview mode. Sign up to unlock all
              features.
            </p>
            <div className="guest-banner-actions">
              <Link
                className="primary-button"
                href="/signup"
                style={{ padding: "0.4rem 1rem", fontSize: "0.82rem" }}
              >
                Sign up free
              </Link>
              <Link
                className="ghost-button"
                href="/login"
                style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}
              >
                Log in
              </Link>
            </div>
          </div>
        )}

        {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}

        <div id="main-content" style={{ padding: 0 }}>
          {/* Page header — compact single band: breadcrumb + title + studio badge inline */}
          <motion.div
            className="workflow-page-header workflow-page-header--compact"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.28,
              ease: [0.25, 0, 0, 1] as [number, number, number, number],
            }}
          >
            <div className="workflow-page-header-left">
              <p className="workflow-page-breadcrumb">
                <span style={{ opacity: 0.55 }}>ALPHACI</span>
                <span className="workflow-page-breadcrumb-sep">/</span>
                <span>Workflows</span>
              </p>
              <div className="workflow-page-title-row">
                <h1 className="workflow-page-title">
                  Create &amp; Manage Projects
                </h1>
                <div className="workflow-page-studio-badge">
                  <span className="workflow-studio-led" aria-hidden="true" />
                  Studio active
                </div>
              </div>
            </div>
            <div className="workflow-page-signal-strip" aria-label="Workflow operating model">
              <div>
                <span>Mode</span>
                <strong>PR-safe updates</strong>
              </div>
              <div>
                <span>Promotion</span>
                <strong>test &gt; uat &gt; main</strong>
              </div>
              <div>
                <span>Stages</span>
                <strong>Access, Quality, Package</strong>
              </div>
            </div>
          </motion.div>

          <WorkflowBuilder
            login={session?.user.login ?? "builder"}
            plan={session?.subscription.plan ?? "pro"}
            guest={guest}
            session={session}
            onboardingCompleted={session?.user.onboardingCompleted}
          />
        </div>
      </main>
    </WorkspaceProvider>
  );
}

