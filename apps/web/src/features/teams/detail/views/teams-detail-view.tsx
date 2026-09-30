"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider } from "@/features/workspace/selection";
import { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

import { parseTeamsDeepLink } from "../../model/teams-rules";
import { TeamsDetailContent } from "./teams-detail-content";

const LOADING_LABEL = "Loading team";

/**
 * Public view for the teams route.
 *
 * The deep link (`?workspace=…&section=…&checklist=…&project=…`) is read with
 * useSearchParams, whose Suspense boundary this owns so the route stays
 * static. It used to read `window.location.search` in a state initialiser,
 * which only worked on a full page load: on a client-side navigation — the
 * project page's "Manage project" link — the new page renders before the
 * address bar changes, so the initialiser saw the previous page's URL and
 * every deep link landed on Overview.
 */
export function TeamsDetailView() {
  return (
    <Suspense fallback={<PipelineLoader label={LOADING_LABEL} />}>
      <TeamsDetailRoute />
    </Suspense>
  );
}

/**
 * Owns the session guards and the WorkspaceProvider the content reads its
 * selection from. Sign-out goes through useAuthSession rather than calling
 * logout() here — a view performing its own I/O is what this layer prevents.
 */
function TeamsDetailRoute() {
  const router = useRouter();
  const search = useSearchParams();
  const { status, session, error: sessionError, refresh, signOut, isSigningOut } =
    useAuthSession();
  const prefersReducedMotion = useReducedMotion();
  // Read once on arrival: the link says what to open first, not what stays open.
  const [deepLink] = useState(() => parseTeamsDeepLink(search?.toString() ?? ""));

  useEffect(() => {
    if (status === "signed-out") router.replace("/login?next=/teams");
  }, [router, status]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (status === "loading") return <PipelineLoader label={LOADING_LABEL} />;

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
    <WorkspaceProvider initialWorkspaceId={deepLink.workspaceId}>
      <TeamsDetailContent
        deepLink={deepLink}
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
