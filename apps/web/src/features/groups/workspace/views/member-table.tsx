"use client";

import { useMemo, useState } from "react";

import { removeGroupMember, updateGroupMemberRole } from "@/features/groups";
import {
  GROUP_ROLE_LABELS,
  type GroupMember,
  type GroupRole,
} from "@/features/groups";
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
/**
 * Roles a manager may assign from this table.
 *
 * 'viewer' is deliberately absent: nothing in this product distinguishes a
 * viewer from a member yet, so offering it would create a state with no
 * meaning. 'admin' (Lead) IS offered — the backend allows it for an existing
 * Admin and rejects it for a delegated lead, which is the rule this table
 * relies on rather than duplicating.
 */
const ASSIGNABLE_ROLES: GroupRole[] = ["admin", "delegated_lead", "member"];

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

  async function handleRoleChange(member: GroupMember, role: GroupRole) {
    if (role === member.role) return;
    setBusyId(member.id);
    setError(null);
    try {
      const updated = await updateGroupMemberRole(groupId, member.id, { role });
      onMembersChange((current) =>
        current.map((item) => (item.id === member.id ? updated : item)),
      );
    } catch (cause) {
      // The backend refuses some transitions a manager can still select — a
      // delegated lead cannot mint an Admin, and the last Lead cannot be
      // demoted. Surface its reason rather than a generic failure.
      const detail = (cause as { details?: { message?: string | string[] } })
        ?.details;
      const message = Array.isArray(detail?.message)
        ? detail?.message.join(", ")
        : detail?.message;
      setError(message ?? "That role could not be changed.");
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
          {activeMembers.map((member) => <MemberRow key={member.id} member={member} leadCount={leadCount}
            canManage={canManage} currentUserId={currentUserId} busyId={busyId}
            onRoleChange={handleRoleChange} onRemove={handleRemove} />)}
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

function MemberRow({ member, leadCount, canManage, currentUserId, busyId, onRoleChange, onRemove }: Readonly<{
  member: GroupMember; leadCount: number; canManage: boolean; currentUserId: string; busyId: string | null;
  onRoleChange: (member: GroupMember, role: GroupRole) => Promise<void>; onRemove: (member: GroupMember) => Promise<void>;
}>) {
  const isLastLead = member.role === "admin" && leadCount <= 1;
  const removed = member.memberStatus === "removed";
  return (
    <div className="hier-row">
      <div className="hier-row-identity"><Avatar login={member.login} name={member.name} avatarUrl={member.avatarUrl} /><div className="hier-row-name"><strong>{member.name || member.login}</strong><span>@{member.login}{member.email ? ` · ${member.email}` : ""}</span></div></div>
      <div className="hier-row-actions">
        <MemberStatusBadge status={member.memberStatus} />
        <MemberRoleControl member={member} canEdit={canManage && !removed} busy={busyId === member.id} isLastLead={isLastLead} onRoleChange={onRoleChange} />
        {canManage && !removed && <RemoveMemberButton member={member} busy={busyId === member.id} isLastLead={isLastLead} isSelf={member.userId === currentUserId} onRemove={onRemove} />}
      </div>
    </div>
  );
}

function MemberRoleControl({ member, canEdit, busy, isLastLead, onRoleChange }: Readonly<{
  member: GroupMember; canEdit: boolean; busy: boolean; isLastLead: boolean;
  onRoleChange: (member: GroupMember, role: GroupRole) => Promise<void>;
}>) {
  if (!canEdit) return <RoleBadge role={member.role} />;
  return <label className="hier-role-picker"><span className="sr-only">Role for {member.name || member.login}</span><select className="hier-role-select" value={member.role} disabled={busy || isLastLead} title={isLastLead ? "A team must keep at least one Lead" : undefined} onChange={(event) => void onRoleChange(member, event.target.value as GroupRole)}>{ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{GROUP_ROLE_LABELS[role]}</option>)}</select></label>;
}

function RemoveMemberButton({ member, busy, isLastLead, isSelf, onRemove }: Readonly<{
  member: GroupMember; busy: boolean; isLastLead: boolean; isSelf: boolean; onRemove: (member: GroupMember) => Promise<void>;
}>) {
  const title = isLastLead ? "A group must keep at least one group lead" : isSelf ? "You can't remove yourself" : undefined;
  return <button type="button" className="hier-btn-danger" disabled={busy || isLastLead || isSelf} title={title} onClick={() => void onRemove(member)}>Remove</button>;
}
