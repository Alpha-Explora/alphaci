"use client";

import { GroupActivitySection } from "@/features/groups/activity";
import { TeamPageShell, type TeamPageHeading } from "@/features/teams/shell";

const HEADING: TeamPageHeading = {
  title: (team) => (team ? `Activity & audit · ${team.name}` : "Activity & audit"),
};

/**
 * Public view for /activity: the header team's activity & audit feed — the
 * old team rail's "Activity & audit" section as a page of its own. The backend
 * opens it to the team's Lead and Delegated leads and to platform admins; the
 * sidebar only offers it to them (canOpenTeamActivity), and anybody else who
 * types the URL gets the feed's own "available to group leads" message.
 */
export function TeamActivityView() {
  return (
    <TeamPageShell loadingLabel="Loading activity" path="/activity" heading={HEADING}>
      {({ team }) => (
        <section className="glass-panel team-detail-surface" aria-labelledby="team-activity-title">
          <div className="group-section-head">
            <h2 className="group-section-title" id="team-activity-title">
              Activity &amp; audit
            </h2>
          </div>
          <GroupActivitySection key={team.id} groupId={team.id} />
        </section>
      )}
    </TeamPageShell>
  );
}
