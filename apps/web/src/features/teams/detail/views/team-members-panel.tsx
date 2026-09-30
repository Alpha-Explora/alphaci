"use client";

import { AddMemberDialog, MemberTable } from "@/features/groups/workspace";

import type { Team } from "../../model/teams-types";
import { useTeamMembersViewModel } from "../view-models/use-team-members-view-model";

/**
 * The Teams page body: the header team's roster, with Add member for a Lead or
 * Delegated lead. It used to be one section of a seven-entry rail; the other
 * sections are pages of their own now (Projects, Checklists, Activity, and the
 * Settings page's Team tab).
 */
export function TeamMembersPanel({
  team,
  onMembershipChanged,
}: Readonly<{ team: Team; onMembershipChanged?: () => void }>) {
  const vm = useTeamMembersViewModel({ team, onMembershipChanged });

  return (
    <section className="glass-panel team-detail-surface" aria-labelledby="team-members-title">
      <div className="group-section-head">
        <h2 className="group-section-title" id="team-members-title">
          Members
          <span className="group-section-count">{team.memberCount}</span>
        </h2>
        {vm.canManage ? (
          <button
            type="button"
            className="primary-button group-section-action"
            onClick={vm.openAdd}
          >
            Add member
          </button>
        ) : null}
      </div>
      <TeamMembersBody vm={vm} team={team} />
      {vm.canManage ? (
        <AddMemberDialog
          open={vm.addOpen}
          groupId={team.id}
          onClose={vm.closeAdd}
          onAdded={vm.applyAdded}
        />
      ) : null}
    </section>
  );
}

function TeamMembersBody({
  vm,
  team,
}: Readonly<{ vm: ReturnType<typeof useTeamMembersViewModel>; team: Team }>) {
  if (vm.status === "loading") {
    return <p className="project-list-empty">Loading members…</p>;
  }
  if (vm.status !== "ready" && vm.status !== "empty") {
    return (
      <p className="project-list-empty">
        Members could not be loaded.{" "}
        <button type="button" className="inline-link" onClick={vm.reload}>
          Retry
        </button>
      </p>
    );
  }
  return (
    <MemberTable
      groupId={team.id}
      members={vm.members}
      canManage={vm.canManage}
      currentUserId={vm.currentUserId}
      onMembersChange={vm.applyChange}
      // The section head already says "Members" and carries the button.
      showHeader={false}
    />
  );
}
