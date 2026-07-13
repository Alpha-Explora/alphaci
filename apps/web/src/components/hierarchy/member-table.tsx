"use client";

import { useMemo, useState } from "react";

import {
  removeGroupMember,
  revokeGroupInvitation,
  updateGroupMemberRole,
} from "@/lib/api/client";
import {
  GROUP_ROLE_LABELS,
  type GroupInvitation,
  type GroupMember,
  type GroupRole,
} from "@/lib/api/hierarchy-contracts";
import {
  InvitationStatusBadge,
  MemberStatusBadge,
  RoleBadge,
} from "./badges";
import { Avatar, SectionHeader } from "./primitives";
import { timeAgo } from "@/hooks/use-hierarchy";

// "admin" = top membership tier (label "Lead"); unrelated to platform-admin.
const ROLE_OPTIONS: GroupRole[] = ["admin", "delegated_lead", "member", "viewer"];

/**
 * Member management + invitation lifecycle. Management controls (role select,
 * remove, revoke) render ONLY when `canManage` is true — members/viewers see
 * a read-only roster. The backend independently enforces the same rule.
 */
export function MemberTable({
  groupId,
  members,
  invitations,
  canManage,
  currentUserId,
  onMembersChange,
  onInvitationsChange,
  inviteAction,
}: {
  groupId: string;
  members: GroupMember[];
  invitations: GroupInvitation[];
  canManage: boolean;
  currentUserId: string;
  onMembersChange: (updater: (current: GroupMember[]) => GroupMember[]) => void;
  onInvitationsChange: (
    updater: (current: GroupInvitation[]) => GroupInvitation[],
  ) => void;
  inviteAction?: React.ReactNode;
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
  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );

  async function handleRoleChange(member: GroupMember, nextRole: GroupRole) {
    setBusyId(member.id);
    setError(null);
    try {
      const updated = await updateGroupMemberRole(groupId, member.id, {
        role: nextRole,
      });
      onMembersChange((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("Member role could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

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

  async function handleRevoke(invitation: GroupInvitation) {
    setBusyId(invitation.id);
    setError(null);
    try {
      await revokeGroupInvitation(groupId, invitation.id);
      onInvitationsChange((current) =>
        current.map((item) =>
          item.id === invitation.id
            ? { ...item, status: "revoked" as const }
            : item,
        ),
      );
    } catch {
      setError("The invitation could not be revoked.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <section aria-label="Members">
        <SectionHeader
          title="Members"
          count={activeMembers.length}
          actions={inviteAction}
        />
        <div className="hier-panel">
          {activeMembers.map((member) => {
            const isLastLead =
              member.role === "admin" && leadCount <= 1;
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
                  {canManage && !removed ? (
                    <select
                      aria-label={`Role for ${member.login}`}
                      className="hier-select"
                      style={{ width: "auto", minWidth: "9.5rem" }}
                      value={member.role}
                      disabled={busyId === member.id || isLastLead}
                      onChange={(event) =>
                        void handleRoleChange(
                          member,
                          event.target.value as GroupRole,
                        )
                      }
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {GROUP_ROLE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={member.role} />
                  )}
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

      {(canManage || pendingInvitations.length > 0) && (
        <section aria-label="Invitations">
          <SectionHeader
            title="Invitations"
            count={canManage ? invitations.length : pendingInvitations.length}
          />
          <div className="hier-panel">
            {(canManage ? invitations : pendingInvitations).length === 0 ? (
              <div className="hier-tree-empty">No invitations.</div>
            ) : (
              (canManage ? invitations : pendingInvitations).map((invitation) => (
                <div key={invitation.id} className="hier-row">
                  <div className="hier-row-identity">
                    <Avatar
                      login={invitation.inviteeLogin ?? invitation.invitedUserId}
                      name={invitation.inviteeName}
                    />
                    <div className="hier-row-name">
                      <strong>
                        {invitation.inviteeName ||
                          invitation.inviteeLogin ||
                          invitation.invitedUserId}
                      </strong>
                      <span>
                        {GROUP_ROLE_LABELS[invitation.role]} · invited{" "}
                        {timeAgo(invitation.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="hier-row-actions">
                    <InvitationStatusBadge status={invitation.status} />
                    {canManage && invitation.status === "pending" && (
                      <button
                        type="button"
                        className="hier-btn-danger"
                        disabled={busyId === invitation.id}
                        onClick={() => void handleRevoke(invitation)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
