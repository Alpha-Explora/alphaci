"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { WelcomeModal } from "./welcome-modal";
import type { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

import {
  dashboardOverviewBusy,
  dashboardWelcomeName,
  firstDashboardError,
  isGlobalCreatorRole,
  shouldShowWelcomeModal,
} from "../../model/home-rules";
import { useHomeDashboardViewModel } from "../view-models/use-home-dashboard-view-model";
import { DashboardWorkspaceOverview } from "./workspace-overview";
import {
  dashboardShortcutHref,
  isEditableShortcutTarget,
} from "./dashboard-shortcuts";
import {
  DashboardLoadErrors,
  GuestPreviewBanner,
  HomeDashboardHeader,
} from "./home-dashboard-header";

/**
 * The home dashboard itself.
 *
 * Reads its data through useHomeDashboardViewModel. The local names below are
 * deliberate aliases onto that view-model: the JSX under them is the markup
 * that was in the route, moved without edits, so a reviewer can diff it rather
 * than re-read it. They collapse as this surface is next touched.
 */
export function HomeDashboardContent({
  session,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
  enabled,
  sessionError,
  logoutMessage,
}: Readonly<{
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  prefersReducedMotion: boolean | null;
  enabled: boolean;
  /** Session-verification error from useAuthSession, already user-safe. */
  sessionError: string | null;
  /** Set when a sign-out attempt failed, so the header can say so. */
  logoutMessage: string | null;
}>) {
  const router = useRouter();
  const vm = useHomeDashboardViewModel({ enabled });

  const guest = isGuest(session);
  /* Creating a project is a Lead/Admin action, matching the server gate. A
   * Developer is not shown a button that would only ever come back 403. */
  const canCreateProjects = isGlobalCreatorRole(session?.appRole);
  const error = sessionError;
  const welcomeDismissed = vm.welcomeDismissed;
  const handleWelcomeDismiss = vm.dismissWelcome;
  const history = vm.history.data;
  const historyLoading = vm.history.status === "loading";
  const historyError = vm.history.error;
  const projects = vm.projects.data;
  const projectsLoading = vm.projects.status === "loading";
  const projectsError = vm.projects.error;
  const recentRuns = vm.runs.data;
  const runsLoading = vm.runs.status === "loading";
  const currentGroup = vm.workspace.data.group;
  const portfolio = vm.workspace.data.portfolio;
  const assignments = vm.workspace.data.assignments;
  const activity = vm.workspace.data.activity;
  const workspaceOverviewLoading = vm.workspace.status === "loading";
  const workspaceOverviewError = vm.workspace.error;
  const refreshDashboard = vm.reload;
  const loadError = firstDashboardError(
    projectsError,
    historyError,
    workspaceOverviewError,
  );
  const overviewBusy = dashboardOverviewBusy(
    projectsLoading,
    workspaceOverviewLoading,
    runsLoading,
    historyLoading,
  );

  useEffect(() => {
    function handleDashboardShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;
      const href = dashboardShortcutHref(event.key.toLowerCase());
      if (!href) return;
      event.preventDefault();
      router.push(href);
    }

    window.addEventListener("keydown", handleDashboardShortcut);
    return () => window.removeEventListener("keydown", handleDashboardShortcut);
  }, [router]);

  const showWelcome = shouldShowWelcomeModal({
    signedIn: enabled,
    guest,
    welcomeDismissed,
    onboardingCompleted: session?.user.onboardingCompleted,
  });

  return (
    <main
      className="dash-shell dashboard-shell dashboard-shell--fit"
      suppressHydrationWarning
      style={{ overflowX: "hidden" }}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground variant="calm" />

      <AppNav
        guest={guest}
        session={session}
        onLogout={onLogout}
        isLoggingOut={isLoggingOut}
      />

      <HomeDashboardNotices
        showWelcome={showWelcome}
        guest={guest}
        displayName={dashboardWelcomeName(session)}
        onWelcomeDismiss={handleWelcomeDismiss}
        loadError={loadError}
        onRetry={refreshDashboard}
      />

      <div id="main-content" className="dash-page-content home-dash-content">
        <HomeDashboardHeader
          guest={guest}
          session={session}
          canCreateProjects={canCreateProjects}
          prefersReducedMotion={prefersReducedMotion}
          error={error}
          logoutMessage={logoutMessage}
          onRefresh={refreshDashboard}
        />

        <DashboardWorkspaceOverview
          group={currentGroup}
          portfolio={portfolio}
          assignments={assignments}
          activity={activity}
          projects={projects}
          runs={recentRuns}
          workflowHistoryCount={history.length}
          loading={overviewBusy}
          reduced={prefersReducedMotion}
        />
      </div>
    </main>
  );
}

function HomeDashboardNotices({
  showWelcome,
  guest,
  displayName,
  onWelcomeDismiss,
  loadError,
  onRetry,
}: Readonly<{
  showWelcome: boolean;
  guest: boolean;
  displayName: string;
  onWelcomeDismiss: () => void;
  loadError: string | null;
  onRetry: () => void;
}>) {
  return (
    <>
      {showWelcome ? (
        <WelcomeModal displayName={displayName} onDismiss={onWelcomeDismiss} />
      ) : null}
      {guest ? <GuestPreviewBanner /> : null}
      {!guest && loadError ? (
        <DashboardLoadErrors message={loadError} onRetry={onRetry} />
      ) : null}
    </>
  );
}
