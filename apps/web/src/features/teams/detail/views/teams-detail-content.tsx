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

import { QA_CHECKLISTS_SECTION } from "@/features/checklists";
import { WorkspaceChecklistsSection } from "@/features/checklists/manage";
import { ProjectExplorerHost } from "@/features/teams/project-folders";

import {
  linkedFolderId,
  linksToProjects,
  memberCountLabel,
  type TeamsDeepLink,
} from "../../model/teams-rules";
import type { ProvisionedProject, Team } from "../../model/teams-types";
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
/**
 * The QA checklists section for this team, or null when the backend has the
 * capability off. Opens on the deep-linked checklist only when the link was
 * for this same team.
 */
function qaChecklistsSection(
  enabled: boolean,
  team: Team,
  projects: ProvisionedProject[],
  deepLink: TeamsDeepLink | undefined,
) {
  if (!enabled) return null;
  const linkedHere = !deepLink?.workspaceId || deepLink.workspaceId === team.id;
  return (
    <WorkspaceChecklistsSection
      key={team.id}
      workspaceId={team.id}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.repoFullName,
        detail: project.serviceName,
      }))}
      initialChecklistId={linkedHere ? deepLink?.checklistId : null}
    />
  );
}

function deepLinkSection(
  deepLink: TeamsDeepLink | undefined,
): "qa-checklists" | "projects" | undefined {
  if (deepLink?.section === QA_CHECKLISTS_SECTION) return "qa-checklists";
  return linksToProjects(deepLink) ? "projects" : undefined;
}

function TeamsHeaderLede({ qaChecklistsEnabled }: Readonly<{ qaChecklistsEnabled: boolean }>) {
  return (
    <p
      style={{
        margin: "0.4rem 0 0",
        color: "var(--text-secondary)",
        fontSize: "0.86rem",
      }}
    >
      {qaChecklistsEnabled
        ? "Members, activity, the Projects and repositories this team owns, and its checklist templates."
        : "Members, activity, and the Projects and repositories this team owns."}{" "}
      Switch or create a team from the picker in the header.
    </p>
  );
}

export function TeamsDetailContent({
  deepLink,
  guest,
  session,
  onLogout,
  isLoggingOut,
  prefersReducedMotion,
  enabled,
}: Readonly<{
  /** What the /teams link asked to open, read once on arrival. */
  deepLink?: TeamsDeepLink;
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
            <TeamsHeaderLede qaChecklistsEnabled={vm.qaChecklistsEnabled} />
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
            <ProjectExplorerHost
              groupId={vm.team.id}
              groupName={vm.team.name}
              qaChecklistsEnabled={vm.qaChecklistsEnabled}
              // `?project=` (the project page's "Manage project") opens that
              // Project's detail on arrival — on the team the link was for.
              initialFolderId={linkedFolderId(deepLink, vm.team.id)}
            >
              {(explorer) =>
                vm.team ? (
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
                    qaChecklists={qaChecklistsSection(
                      vm.qaChecklistsEnabled,
                      vm.team,
                      vm.projects,
                      deepLink,
                    )}
                    projectExplorer={explorer}
                    initialSection={deepLinkSection(deepLink)}
                  />
                ) : null
              }
            </ProjectExplorerHost>
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
