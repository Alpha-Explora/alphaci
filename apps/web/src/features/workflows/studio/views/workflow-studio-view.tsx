"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import { WorkspaceProvider, useWorkspaceSelection } from "@/features/workspace/selection";
import { WorkflowBuilder } from "./workflow-builder";
import { isGuest, useAuthSession, useSignOutAndRedirect } from "@/features/auth/session";
import { studioSessionFields } from "../model/workflow-studio-rules";
import { readProjectsDeepLink } from "../model/current-projects-rules";

/* Level 0 in the skill's progressive depth: the studio's data belongs to
 * WorkflowBuilder and the hooks it owns, so this surface has no view-model and
 * no data layer of its own. Sign-out is the one action, via useAuthSession. */

/**
 * Public view for /workflows.
 *
 * `?group=` (a "Manage project" link, a forwarded `/teams?section=projects`
 * link, the Create Project wizard's links) selects that team in the HEADER on
 * arrival — the Projects view has no team picker of its own, so the header is
 * the one place a link can point it at a team. Read with useSearchParams,
 * whose Suspense boundary this owns so the route stays static.
 */
export function WorkflowStudioView() {
  return (
    <Suspense fallback={<PipelineLoader label="Loading Workflow Studio" />}>
      <WorkflowStudioRoute />
    </Suspense>
  );
}

function WorkflowStudioRoute() {
  const searchParams = useSearchParams();
  // Read once on arrival: later ?group= changes belong to the wizard.
  const [linkedTeamId] = useState(() => readProjectsDeepLink(searchParams).groupId);
  // Creation is a new page scope even when Next keeps /workflows mounted.
  // Reset the provider and wizard together; ordinary wizard links keep state.
  const createdWorkspaceId = searchParams.get("created") === "workspace"
    ? readProjectsDeepLink(searchParams).groupId
    : null;
  const { status, session, error, refresh } = useAuthSession();
  const { signOutAndRedirect, isSigningOut } = useSignOutAndRedirect();
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutMessage(null);
    try {
      await signOutAndRedirect();
    } catch {
      setLogoutMessage("Sign out failed. Please retry, or use the Home link.");
    }
  }

  if (status === "loading") {
    return <PipelineLoader label="Loading Workflow Studio" />;
  }

  if (status === "error") {
    return <StudioSessionError error={error} onRetry={() => void refresh()} />;
  }

  const guest = isGuest(session);
  const fields = studioSessionFields(session);

  return (
    <WorkspaceProvider key={createdWorkspaceId} initialWorkspaceId={createdWorkspaceId ?? linkedTeamId}>
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

        <StudioGuestBanner guest={guest} />

        {logoutMessage ? <p className="error-text">{logoutMessage}</p> : null}

        <div id="main-content" style={{ padding: 0 }}>
          <WorkspaceCreatedNotice workspaceId={createdWorkspaceId} />
          <WorkflowBuilder
            login={fields.login}
            plan={fields.plan}
            guest={guest}
            session={session}
            onboardingCompleted={fields.onboardingCompleted}
          />
        </div>
      </main>
    </WorkspaceProvider>
  );
}

function WorkspaceCreatedNotice({ workspaceId }: Readonly<{ workspaceId: string | null }>) {
  const { selectedWorkspace } = useWorkspaceSelection();
  const [dismissed, setDismissed] = useState(false);
  if (!workspaceId || selectedWorkspace?.id !== workspaceId || dismissed) return null;
  return (
    <div style={{ padding: "0.75rem var(--layout-gutter) 0" }}>
      <div className="status-banner success" role="status">
        <span>Workspace created</span>
        <button className="inline-link" type="button" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function StudioSessionError({
  error,
  onRetry,
}: Readonly<{ error: string | null; onRetry: () => void }>) {
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
              onClick={onRetry}
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

function StudioGuestBanner({ guest }: Readonly<{ guest: boolean }>) {
  if (!guest) return null;
  return (
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
  );
}
