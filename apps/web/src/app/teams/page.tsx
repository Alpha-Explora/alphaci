"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppNav } from "@/components/layout/app-nav";
import { FlowBackground } from "@/components/layout/flow-background";
import { PipelineLoader } from "@/components/layout/pipeline-loader";
import {
  WorkspaceProvider,
  useWorkspaceSelection,
} from "@/components/layout/workspace-context";
import { GroupWorkspacePanel } from "@/components/product/group-workspace-panel";
import { useAuthSession } from "@/hooks/use-auth-session";
import { getGroups, getProjects, logout } from "@/lib/api/client";
import type { ProvisionedProject } from "@/lib/api/contracts";
import type { GroupSummary } from "@/lib/api/hierarchy-contracts";
import { isGuest } from "@/lib/auth/subscription";

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/**
 * Teams — the detail surface for the team selected in the header.
 *
 * One workspace IS one team, so this page has no list and no create button of
 * its own. Both would duplicate the header: the dropdown already lists exactly
 * the same rows and already owns "+ Create workspace", which is the same act as
 * creating a team. Two ways to do one thing, one of them hidden a page deep, is
 * how the earlier "0 teams in Team1 Test" confusion started.
 */
function TeamsPageContent() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { status, session, error: sessionError, refresh } = useAuthSession();
  const { selectedWorkspaceId } = useWorkspaceSelection();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const guest = isGuest(session);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login?next=/teams");
  }, [router, status]);

  const load = useCallback(() => {
    void getGroups()
      .then((items) => {
        setGroups(items);
        setLoadError(null);
      })
      .catch(() => {
        setGroups([]);
        setLoadError("Could not load this team.");
      });
    void getProjects(100)
      .then((response) => setProjects(response.items))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (status !== "signed-in" || guest) return;
    load();
  }, [status, guest, load]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      await refresh();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (status === "loading") return <PipelineLoader label="Loading team" />;

  if (status === "error") {
    return (
      <main className="dash-shell">
        <FlowBackground />
        <div className="state-body">
          <div className="state-card">
            <h1>Session verification failed</h1>
            <p>We could not verify your session. Please retry or sign in again.</p>
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

  const loading = groups === null;
  // The header owns the selection; fall back to the first team so the page is
  // never blank just because nothing has been picked yet this session.
  const team =
    (groups ?? []).find((group) => group.id === selectedWorkspaceId) ??
    (groups ?? [])[0] ??
    null;
  const teamProjects = team
    ? projects.filter((project) => project.workspaceId === team.id)
    : [];

  return (
    <main className="dash-shell" suppressHydrationWarning>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <FlowBackground />

      <AppNav
        guest={guest}
        session={session}
        onLogout={() => void handleLogout()}
        isLoggingOut={isLoggingOut}
      />

      <div id="main-content" className="dash-page-content">
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
              <span>Teams</span>
            </p>
            <div className="workflow-page-title-row">
              <h1 className="workflow-page-title">{team?.name ?? "Teams"}</h1>
              {team ? (
                <div className="workflow-page-studio-badge">
                  <span className="workflow-studio-led" aria-hidden="true" />
                  {team.memberCount}{" "}
                  {team.memberCount === 1 ? "member" : "members"}
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
              Members, activity, and the repositories this team owns. Switch or
              create a team from the picker in the header.
            </p>
          </div>
        </motion.div>

        {loadError ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <div
            className="skeleton-card glass-panel"
            style={{ minHeight: "18rem", animation: "state-pulse 1.5s infinite" }}
          />
        ) : team ? (
          <div className="glass-panel team-detail-surface">
            <GroupWorkspacePanel
              group={team}
              projects={teamProjects}
              onDeleted={load}
              // Creating a repository belongs to the Projects surface, which
              // owns the setup form; this page hands off rather than embedding
              // it a second time.
              renderCreateProject={() => (
                <div className="env-empty-state">
                  <strong>Create a repository for this team</strong>
                  <p>
                    Repositories are created from the Projects surface, which
                    owns the full setup form.
                  </p>
                  <Link className="primary-button" href="/workflows?tab=setup">
                    Go to Create Project
                  </Link>
                </div>
              )}
            />
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              alignItems: "center",
            }}
          >
            <p
              style={{
                color: "var(--text-primary)",
                margin: 0,
                fontSize: "0.95rem",
                fontWeight: 700,
              }}
            >
              You are not in a team yet.
            </p>
            <p
              style={{
                color: "var(--text-secondary)",
                margin: 0,
                fontSize: "0.85rem",
                maxWidth: "32rem",
              }}
            >
              Use <strong>+ Create workspace</strong> in the header to make one —
              a workspace is a team. If you expect to be in one already, a team
              lead has to add you.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TeamsPage() {
  return (
    <WorkspaceProvider>
      <TeamsPageContent />
    </WorkspaceProvider>
  );
}
