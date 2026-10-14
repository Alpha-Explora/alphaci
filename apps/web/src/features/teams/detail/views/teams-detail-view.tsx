"use client";

import { TeamPageShell, type TeamPageHeading } from "@/features/teams/shell";

import { legacyTeamsRedirect } from "../../model/teams-rules";
import { TeamMembersPanel } from "./team-members-panel";

const HEADING: TeamPageHeading = {
  title: (team) => (team ? `Members · ${team.name}` : "Teams"),
};

/**
 * Public view for /teams: the Members page for the team selected in the
 * header.
 *
 * One workspace IS one team, so this page has no team list and no create
 * button of its own — both would duplicate the header. The team's other
 * sections moved to their own pages; an old `?section=` link is forwarded
 * there before anything draws (legacyTeamsRedirect).
 */
export function TeamsDetailView() {
  return (
    <TeamPageShell
      loadingLabel="Loading team"
      path="/teams"
      heading={HEADING}
      redirect={legacyTeamsRedirect}
    >
      {({ team, vm }) => (
        <TeamMembersPanel key={team.id} team={team} onMembershipChanged={vm.refreshTeam} />
      )}
    </TeamPageShell>
  );
}
