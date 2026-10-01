"use client";

import "./team-pages.css";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

import { FlowBackground } from "@/shared/layout/flow-background";
import { PipelineLoader } from "@/shared/layout/pipeline-loader";
import {
  AppNav,
  WorkspaceProvider,
  canCreateWorkspace,
  useWorkspaceSelection,
} from "@/features/workspace/selection";
import { isGuest, useAuthSession, type AuthSession } from "@/features/auth/session";

import { parseTeamsDeepLink, type TeamsDeepLink } from "../../model/teams-rules";
import type { Team } from "../../model/teams-types";
import {
  useSelectedTeamViewModel,
  type SelectedTeamViewModel,
} from "../view-models/use-selected-team-view-model";
import { TeamsEmptyState } from "./teams-empty-state";

/** What a team page gets to draw with, once its team has resolved. */
export interface TeamPageContext {
  team: Team;
  vm: SelectedTeamViewModel;
  /** What the link asked to open, read once on arrival. */
  deepLink: TeamsDeepLink;
}

/**
 * The page's one h1, for screen readers and the document outline. It is not
 * drawn: each page opens straight onto its content card, whose own heading
 * (Members, Checklist templates, Activity & audit) is what a sighted user
 * reads, and the team's name is already in the header's picker.
 */
export interface TeamPageHeading {
  /** e.g. "Members · Checkout squad"; `team` is null until it loads. */
  title: (team: Team | null) => string;
}

export interface TeamPageShellProps {
  /** The PipelineLoader label and the route to return to after sign-in. */
  loadingLabel: string;
  path: string;
  heading: TeamPageHeading;
  /** Load the team's repositories too (see useSelectedTeamViewModel). */
  loadProjects?: boolean;
  /** Forward an old link elsewhere before drawing anything (/teams only). */
  redirect?: (deepLink: TeamsDeepLink) => string | null;
  children: (context: TeamPageContext) => ReactNode;
}

/**
 * The chrome every team page shares: session guards, the header's team, the
 * page's (visually hidden) h1, and the loading / error / no-team states.
 *
 * There is no hero card above the content any more: its breadcrumb, title,
 * team chip and lede repeated what the header picker and the content card
 * already say, and pushed the page's actual content below the fold on a phone.
 *
 * The deep link (`?workspace=…`, plus whatever the page reads) comes from
 * useSearchParams, whose Suspense boundary this owns so the routes stay
 * static. Reading `window.location.search` in a state initialiser only works
 * on a full page load: after a client-side navigation the new page renders
 * before the address bar changes and sees the previous page's URL.
 */
export function TeamPageShell(props: Readonly<TeamPageShellProps>) {
  return (
    <Suspense fallback={<PipelineLoader label={props.loadingLabel} />}>
      <TeamPageRoute {...props} />
    </Suspense>
  );
}

function TeamPageRoute({
  loadingLabel,
  path,
  heading,
  loadProjects,
  redirect,
  children,
}: Readonly<TeamPageShellProps>) {
  const router = useRouter();
  const search = useSearchParams();
  const { status, session, error: sessionError, refresh, signOut, isSigningOut } =
    useAuthSession();
  // Read once on arrival: the link says what to open first, not what stays open.
  const [deepLink] = useState(() => parseTeamsDeepLink(search?.toString() ?? ""));
  const [redirectTo] = useState(() => redirect?.(deepLink) ?? null);
  const loginHref = `/login?next=${path}`;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  useEffect(() => {
    if (status === "signed-out" && !redirectTo) router.replace(loginHref);
  }, [loginHref, redirectTo, router, status]);

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  if (redirectTo || status === "loading") return <PipelineLoader label={loadingLabel} />;

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
              <Link className="ghost-button" href={loginHref}>
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
      <TeamPageContent
        deepLink={deepLink}
        session={session}
        heading={heading}
        loadProjects={loadProjects}
        onLogout={() => void handleLogout()}
        isLoggingOut={isSigningOut}
        enabled={status === "signed-in"}
      >
        {children}
      </TeamPageContent>
    </WorkspaceProvider>
  );
}

function TeamPageContent({
  deepLink,
  session,
  heading,
  loadProjects,
  onLogout,
  isLoggingOut,
  enabled,
  children,
}: Readonly<{
  deepLink: TeamsDeepLink;
  session: AuthSession | null;
  heading: TeamPageHeading;
  loadProjects?: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
  enabled: boolean;
  children: (context: TeamPageContext) => ReactNode;
}>) {
  const guest = isGuest(session);
  const vm = useSelectedTeamViewModel({ guest, enabled, loadProjects });
  const { setSelectedWorkspaceId } = useWorkspaceSelection();

  let body: ReactNode;
  if (vm.status === "loading") {
    body = (
      <div
        className="skeleton-card glass-panel"
        style={{ minHeight: "18rem", animation: "state-pulse 1.5s infinite" }}
      />
    );
  } else if (vm.team) {
    body = children({ team: vm.team, vm, deepLink });
  } else {
    body = (
      <TeamsEmptyState
        canCreate={canCreateWorkspace(session?.appRole)}
        onCreated={(workspaceId) => {
          // Select it and reload, so the page fills in with the new team
          // instead of continuing to say the caller has none.
          setSelectedWorkspaceId(workspaceId);
          vm.reload();
        }}
      />
    );
  }

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />

      <div id="main-content" className="dash-page-content">
        <h1 className="sr-only" data-testid="team-page-title">
          {heading.title(vm.team)}
        </h1>

        {vm.error ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {vm.error}
          </p>
        ) : null}

        {body}
      </div>
    </main>
  );
}
