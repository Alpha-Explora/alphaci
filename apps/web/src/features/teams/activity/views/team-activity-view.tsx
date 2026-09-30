"use client";

import { GroupActivitySection } from "@/features/groups/activity";
import { TeamPageShell, type TeamPageHeading } from "@/features/teams/shell";

const HEADING: TeamPageHeading = {
  crumb: "Activity",
  title: () => "Activity & audit",
  badge: (team) => team.name,
  lede: () =>
    "Membership changes, assignment grants and revocations, configuration writes, and GitHub synchronization results for the team selected in the header.",
};

/**
 * Public view for /activity: the header team's activity & audit feed — the
 * old team rail's "Activity & audit" section as a page of its own, open to the
 * same people the rail entry was.
 */
export function TeamActivityView() {
  return (
    <TeamPageShell loadingLabel="Loading activity" path="/activity" heading={HEADING}>
      {({ team }) => (
        <section className="glass-panel team-detail-surface" aria-label={`Activity for ${team.name}`}>
          <GroupActivitySection key={team.id} groupId={team.id} />
        </section>
      )}
    </TeamPageShell>
  );
}
