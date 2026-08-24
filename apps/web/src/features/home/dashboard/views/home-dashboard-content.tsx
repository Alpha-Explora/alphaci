"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useEffect } from "react";
import { motion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/shared/layout/flow-background";
import { WelcomeModal } from "@/components/product/welcome-modal";
import type { useAuthSession } from "@/features/auth/session";
import { isGuest } from "@/features/auth/session";

import { useHomeDashboardViewModel } from "../view-models/use-home-dashboard-view-model";
import { DashboardWorkspaceOverview } from "./workspace-overview";

import { sectionVariants } from "./motion";

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

  // Single-key dashboard shortcuts. Navigation is a view concern, and this
  // deliberately ignores keystrokes aimed at an editable target.
  useEffect(() => {
    function handleDashboardShortcut(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        router.push("/workflows?tab=setup");
      } else if (key === "w") {
        event.preventDefault();
        router.push("/workflows?tab=current");
      } else if (key === "r") {
        event.preventDefault();
        router.push("/runs");
      }
    }

    window.addEventListener("keydown", handleDashboardShortcut);
    return () => window.removeEventListener("keydown", handleDashboardShortcut);
  }, [router]);

  // Show the welcome modal for authenticated new users who have not yet
  // completed onboarding and have not dismissed it this session.
  const showWelcome =
    status === "signed-in" &&
    !guest &&
    !welcomeDismissed &&
    session?.user.onboardingCompleted === false;

  const avatarInitial = (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();

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

      {/* Welcome modal — shown once for new authenticated users */}
      {showWelcome && (
        <WelcomeModal
          displayName={session?.user.login ?? session?.user.name ?? "there"}
          onDismiss={handleWelcomeDismiss}
        />
      )}

      {guest && (
        <div
          className="guest-banner glass-panel"
          role="alert"
          style={{
            background:
              "linear-gradient(135deg, rgba(88, 166, 255, 0.08) 0%, rgba(17, 17, 22, 0.7) 100%)",
            border: "1px solid var(--border-brand)",
            padding: "1rem var(--layout-gutter)",
            borderRadius: "0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--text-primary)",
              fontWeight: 500,
              fontSize: "0.88rem",
            }}
          >
            You are viewing ALPHACI in preview mode. Sign up to unlock all
            features.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
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

      <div id="main-content" className="dash-page-content home-dash-content">
        {/* ── Compact welcome header — single row, no latest-run widget ── */}
        <motion.section
          className="welcome-banner-flat home-header"
          aria-label="Welcome"
          custom={0}
          variants={sectionVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate="visible"
        >
          <div className="welcome-banner-flat-accent" aria-hidden="true" />

          <div className="home-header-row">
            <div className="home-header-id">
              {!guest &&
                (session?.user.avatarUrl ? (
                  <Image
                    src={session.user.avatarUrl}
                    alt={session.user.name ?? session.user.login}
                    className="home-header-avatar"
                    width={40}
                    height={40}
                    unoptimized
                  />
                ) : (
                  <span className="home-header-avatar home-header-avatar--fallback" aria-hidden="true">
                    {avatarInitial}
                  </span>
                ))}
              <div className="home-header-copy">
                <p className="home-header-eyebrow">SYSTEM.DASHBOARD</p>
                <h1 className="home-header-title">
                  {guest
                    ? "ALPHACI Dashboard"
                    : `Welcome back, ${session?.user.name ?? session?.user.login ?? "builder"}.`}
                </h1>
              </div>
            </div>

            <div className="home-header-actions">
              {guest ? (
                <>
                  <Link className="primary-button home-header-btn" href="/signup">
                    Sign up free
                  </Link>
                  <Link className="ghost-button home-header-btn" href="/login">
                    Log in
                  </Link>
                </>
              ) : (
                <>
                  <button
                    className="ghost-button home-header-btn"
                    type="button"
                    onClick={refreshDashboard}
                  >
                    Refresh
                  </button>
                  <Link className="primary-button home-header-btn" href="/workflows?tab=setup">
                    Create project
                  </Link>
                </>
              )}
            </div>
          </div>

          {error ? <p className="error-text home-header-msg">{error}</p> : null}
          {logoutMessage ? (
            <p className="error-text home-header-msg">{logoutMessage}</p>
          ) : null}
        </motion.section>

        {/* One continuous dashboard flow — no internal tabs or modes. */}
        {!guest && (projectsError || historyError || workspaceOverviewError) ? (
          <div className="dashboard-load-errors" role="alert">
            <span aria-hidden="true">!</span>
            <p>{projectsError ?? historyError ?? workspaceOverviewError}</p>
            <button className="error-retry-btn" type="button" onClick={refreshDashboard}>
              Retry
            </button>
          </div>
        ) : null}

        <DashboardWorkspaceOverview
          group={currentGroup}
          portfolio={portfolio}
          assignments={assignments}
          activity={activity}
          projects={projects}
          runs={recentRuns}
          workflowHistoryCount={history.length}
          loading={projectsLoading || workspaceOverviewLoading || runsLoading || historyLoading}
          reduced={prefersReducedMotion}
        />
      </div>
    </main>
  );
}

