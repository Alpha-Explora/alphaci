"use client";

import "./team-pages.css";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

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

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/** What a team page gets to draw with, once its team has resolved. */
export interface TeamPageContext {
  team: Team;
  vm: SelectedTeamViewModel;
  /** What the link asked to open, read once on arrival. */
  deepLink: TeamsDeepLink;
}

/** The page's heading, derived from the team on screen (null until it loads). */
export interface TeamPageHeading {
  /** The breadcrumb's last segment, e.g. "Teams". */
  crumb: string;
  title: (team: Team | null) => string;
  /** The small LED chip beside the title, or null for none. */
  badge?: (team: Team) => string | null;
  lede: (team: Team | null, vm: SelectedTeamViewModel) => ReactNode;
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
 * page heading, and the loading / error / no-team states.
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
  const prefersReducedMotion = useReducedMotion();
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
        prefersReducedMotion={prefersReducedMotion}
        enabled={status === "signed-in"}
      >
        {children}
      </TeamPageContent>
    </WorkspaceProvider>
  );
}

function TeamPageHeader({
  heading,
  team,
  vm,
  prefersReducedMotion,
}: Readonly<{
  heading: TeamPageHeading;
  team: Team | null;
  vm: SelectedTeamViewModel;
  prefersReducedMotion: boolean | null;
}>) {
  const badge = team && heading.badge ? heading.badge(team) : null;
  return (
    <motion.div
      className="workflow-page-header workflow-page-header--compact"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      <div className="workflow-page-header-left">
        <p className="workflow-page-breadcrumb">
          <span style={{ opacity: 0.55 }}>ALPHACI</span>
          <span className="workflow-page-breadcrumb-sep">/</span>
          <span>{heading.crumb}</span>
        </p>
        <div className="workflow-page-title-row">
          <h1 className="workflow-page-title">{heading.title(team)}</h1>
          {badge ? (
            <div className="workflow-page-studio-badge team-page-badge">
              <span className="workflow-studio-led" aria-hidden="true" />
              {badge}
            </div>
          ) : null}
        </div>
        <p
          style={{
            margin: "0.4rem 0 0",
            color: "var(--text-secondary)",
            fontSize: "0.86rem",
          }}
        >
          {heading.lede(team, vm)}
        </p>
      </div>
    </motion.div>
  );
}

function TeamPageContent({
  deepLink,
  session,
  heading,
  loadProjects,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
  enabled,
  children,
}: Readonly<{
  deepLink: TeamsDeepLink;
  session: AuthSession | null;
  heading: TeamPageHeading;
  loadProjects?: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
  prefersReducedMotion: boolean | null;
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
        <TeamPageHeader
          heading={heading}
          team={vm.team}
          vm={vm}
          prefersReducedMotion={prefersReducedMotion}
        />

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
