"use client";

import { motion } from "framer-motion";

import { AppNav } from "@/features/workspace/selection";
import { FlowBackground } from "@/shared/layout/flow-background";
import { GroupWorkspacePanel } from "./group-workspace-panel";
import type { useAuthSession } from "@/features/auth/session";

import {
  canCreateWorkspace,
  useWorkspaceSelection,
} from "@/features/workspace/selection";

import { memberCountLabel } from "../../model/teams-rules";
import { useTeamsDetailViewModel } from "../view-models/use-teams-detail-view-model";
import { TeamsEmptyState } from "./teams-empty-state";

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
export function TeamsDetailContent({
  guest,
  session,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
  enabled,
}: Readonly<{
  guest: boolean;
  session: ReturnType<typeof useAuthSession>["session"];
  onLogout: () => void;
  isLoggingOut: boolean;
  prefersReducedMotion: boolean | null;
  enabled: boolean;
}>) {
  const vm = useTeamsDetailViewModel({ guest, enabled });
  const { setSelectedWorkspaceId } = useWorkspaceSelection();

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
              <h1 className="workflow-page-title">
                {vm.team?.name ?? "Teams"}
              </h1>
              {vm.team ? (
                <div className="workflow-page-studio-badge">
                  <span className="workflow-studio-led" aria-hidden="true" />
                  {memberCountLabel(vm.team.memberCount)}
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

        {vm.error ? (
          <p className="error-text" style={{ marginTop: 0 }}>
            {vm.error}
          </p>
        ) : null}

        {vm.status === "loading" ? (
          <div
            className="skeleton-card glass-panel"
            style={{ minHeight: "18rem", animation: "state-pulse 1.5s infinite" }}
          />
        ) : vm.team ? (
          <div className="glass-panel team-detail-surface">
            <GroupWorkspacePanel
              group={vm.team}
              projects={vm.projects}
              onDeleted={vm.reload}
              onMembershipChanged={vm.refreshTeam}
              // Creating a repository belongs to the Projects surface, which
              // owns the setup form. Linking straight there — pre-scoped to
              // this team — replaces an intermediate screen whose only content
              // was a button pointing at the same place.
              createHref={`/workflows?tab=setup&group=${encodeURIComponent(vm.team.id)}`}
              renderCreateProject={() => null}
            />
          </div>
        ) : (
          <TeamsEmptyState
            canCreate={canCreateWorkspace(session?.appRole)}
            onCreated={(workspaceId) => {
              // Select it and reload, so the page fills in with the new team
              // instead of continuing to say the caller has none.
              setSelectedWorkspaceId(workspaceId);
              vm.reload();
            }}
          />
        )}
      </div>
    </main>
  );
}
