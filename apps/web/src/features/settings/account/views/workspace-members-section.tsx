"use client";

import Link from "next/link";

import { teamMembersHref } from "@/features/teams";
import { RoleBadge } from "@/features/groups/workspace";
import type { WorkspaceSummary } from "@/features/workspace/selection";

import { useWorkspaceMembersViewModel } from "../view-models/use-workspace-members-view-model";

/**
 * A workspace's members, read-only.
 *
 * This used to add, re-role and remove members through /workspaces/:id/members
 * — a second roster editor beside the team's own on /teams, with its own
 * rules. The roster is edited in one place now; this lists it and links there.
 */
export function WorkspaceMembersSection({
  workspace,
}: Readonly<{ workspace: WorkspaceSummary }>) {
  const vm = useWorkspaceMembersViewModel(workspace.id);

  return (
    <div className="workspace-members">
      {vm.status === "loading" ? (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Loading members...
        </p>
      ) : null}
      {vm.status === "ready" ? (
        <ul className="workspace-members-list" aria-label={`Members of ${workspace.name}`} style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {vm.members.map((member) => (
            <li key={member.id} className="hover-field workspace-member-row">
              <div className="workspace-member-identity">
                <strong>{member.name || member.login}</strong>
                <span>
                  @{member.login}{member.email ? ` / ${member.email}` : ""}
                </span>
              </div>
              <RoleBadge role={member.role} />
            </li>
          ))}
        </ul>
      ) : null}
      {vm.error ? (
        <p className="error-text" style={{ margin: 0 }}>
          {vm.error}
        </p>
      ) : null}
      <Link className="inline-link" href={teamMembersHref(workspace.id)}>
        Manage members in Teams
      </Link>
    </div>
  );
}
