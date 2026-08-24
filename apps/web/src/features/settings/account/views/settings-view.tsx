"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/features/workspace/selection";
import { useAuthSession } from "@/features/auth/session";

import { SettingsContent } from "./settings-content";

/**
 * Public view for the settings route.
 *
 * Owns the session guards, the compact-layout media query, and the
 * WorkspaceProvider the content reads from. Sign-out goes through
 * useAuthSession rather than calling logout() here.
 */
export function SettingsView() {
  const router = useRouter();
  const { status, session, error, refresh, signOut, isSigningOut } =
    useAuthSession();
  const prefersReducedMotion = useReducedMotion();
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.push("/login?next=/settings");
  }, [status, router]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const updateLayout = () => setIsCompactLayout(media.matches);
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);

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
    return <PipelineLoader label="Loading settings" />;
  }

  if (status === "error") {
    return (
      <main className="flow-shell page-shell">
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
            <p>We could not verify your session. Please retry or sign in again.</p>
            {error ? (
              <p className="error-text" style={{ fontSize: "0.82rem" }}>
                {error}
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
              <Link className="ghost-button" href="/login?next=/settings">
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceProvider>
      <SettingsContent
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
        logoutMessage={logoutMessage}
        prefersReducedMotion={prefersReducedMotion}
        isCompactLayout={isCompactLayout}
        onDeleted={() => router.push("/")}
      />
    </WorkspaceProvider>
  );
}
