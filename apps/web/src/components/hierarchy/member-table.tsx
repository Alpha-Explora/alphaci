"use client";

import { useMemo, useState } from "react";

import { removeGroupMember } from "@/lib/api/client";
import { type GroupMember } from "@/lib/api/hierarchy-contracts";
import { MemberStatusBadge, RoleBadge } from "./badges";
import { Avatar, SectionHeader } from "./primitives";

/**
 * Member roster. Roles are DISPLAY-ONLY here — role assignment
 * (Admin / Lead / Member) is centralized in the Admin Console, so a group Lead
 * cannot change roles from this tab. Membership actions (add, remove) render
 * for managers when `canManage` is true; the backend independently enforces
 * the same rules.
 *
 * There is no invitation lifecycle: a lead adds someone and they are a member
 * immediately.
 */
export function MemberTable({
  groupId,
  members,
  canManage,
  currentUserId,
  onMembersChange,
  addAction,
  showHeader = true,
}: {
  groupId: string;
  members: GroupMember[];
  canManage: boolean;
  currentUserId: string;
  onMembersChange: (updater: (current: GroupMember[]) => GroupMember[]) => void;
  addAction?: React.ReactNode;
  /**
   * Whether to draw the "Members (n)" heading.
   *
   * False inside the team workspace, where the section rail has already named
   * the section and the panel owns the heading — two headings reading
   * "Members" one above the other is the page telling you the same thing
   * twice. The standalone /groups/:id/members page has no such heading of its
   * own, so it keeps this.
   */
  showHeader?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.memberStatus !== "removed"),
    [members],
  );
  const leadCount = useMemo(
    () =>
      activeMembers.filter(
        (member) => member.role === "admin" && member.memberStatus === "active",
      ).length,
    [activeMembers],
  );
  async function handleRemove(member: GroupMember) {
    setBusyId(member.id);
    setError(null);
    try {
      await removeGroupMember(groupId, member.id);
      onMembersChange((current) =>
        current.map((item) =>
          item.id === member.id
            ? { ...item, memberStatus: "removed" as const }
            : item,
        ),
      );
    } catch {
      setError("Member could not be removed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-label="Members">
        {showHeader ? (
          <SectionHeader
            title="Members"
            count={activeMembers.length}
            actions={addAction}
          />
        ) : null}
        <div className="hier-panel">
          {activeMembers.map((member) => {
            const isLastLead = member.role === "admin" && leadCount <= 1;
            const isSelf = member.userId === currentUserId;
            const removed = member.memberStatus === "removed";
            return (
              <div key={member.id} className="hier-row">
                <div className="hier-row-identity">
                  <Avatar
                    login={member.login}
                    name={member.name}
                    avatarUrl={member.avatarUrl}
                  />
                  <div className="hier-row-name">
                    <strong>{member.name || member.login}</strong>
                    <span>
                      @{member.login}
                      {member.email ? ` · ${member.email}` : ""}
                    </span>
                  </div>
                </div>
                <div className="hier-row-actions">
                  <MemberStatusBadge status={member.memberStatus} />
                  {/* Role is display-only — managed in the Admin Console. */}
                  <RoleBadge role={member.role} />
                  {canManage && !removed && (
                    <button
                      type="button"
                      className="hier-btn-danger"
                      disabled={busyId === member.id || isLastLead || isSelf}
                      title={
                        isLastLead
                          ? "A group must keep at least one group lead"
                          : isSelf
                            ? "You can't remove yourself"
                            : undefined
                      }
                      onClick={() => void handleRemove(member)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
