"use client";

import { WorkspaceChecklistsSection } from "@/features/checklists/manage";
import { LoadingRows } from "@/features/groups/workspace";
import { TeamPageShell, type TeamPageHeading } from "@/features/teams/shell";

import { linkedItemId } from "../../model/teams-rules";

const HEADING: TeamPageHeading = {
  title: (team) => (team ? `Checklists · ${team.name}` : "Checklists"),
};

/**
 * Public view for /checklists: the header team's checklist templates — the
 * old team rail's "Checklist templates" section as a page of its own.
 *
 * `?workspace=…&checklist=…` (the project Checklists tab's manage links, and
 * forwarded `/teams?section=qa-checklists` links) opens straight onto one
 * checklist, but only on the team the link was made for.
 */
export function TeamChecklistsView() {
  return (
    <TeamPageShell
      loadingLabel="Loading checklists"
      path="/checklists"
      heading={HEADING}
      loadProjects
    >
      {({ team, vm, deepLink }) => {
        if (vm.qaChecklistsEnabled) {
          return (
            <section className="glass-panel team-detail-surface" aria-label={`Checklists for ${team.name}`}>
              <WorkspaceChecklistsSection
                key={team.id}
                workspaceId={team.id}
                projects={vm.projects.map((project) => ({
                  id: project.id,
                  name: project.repoFullName,
                  detail: project.serviceName,
                }))}
                initialChecklistId={linkedItemId(deepLink.checklistId, deepLink.workspaceId, team.id)}
              />
            </section>
          );
        }
        if (!vm.capabilitiesKnown) {
          return (
            <div className="glass-panel team-detail-surface">
              <LoadingRows rows={3} />
            </div>
          );
        }
        return (
          <div className="glass-panel team-detail-surface" role="status">
            <p className="group-section-lede">
              QA checklists are not switched on for this deployment.
            </p>
          </div>
        );
      }}
    </TeamPageShell>
  );
}
