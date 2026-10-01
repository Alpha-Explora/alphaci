"use client";

import { useMemo, useState } from "react";

import { removeGroupMember, type GroupMember } from "@/features/groups";
import { MemberRoleBadge, MemberStatusBadge } from "./badges";
import { Avatar, SectionHeader } from "./primitives";

/**
 * Member roster. Roles are DISPLAY-ONLY here — they come from the global app
 * role (lead/admin -> Lead, qa -> QA Team, member -> Developer), which is
 * assigned in the Admin Console, so nobody changes a role from this tab.
 * Membership actions (add, remove) render
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
          {activeMembers.map((member) => <MemberRow key={member.id} member={member} leadCount={leadCount}
            canManage={canManage} currentUserId={currentUserId} busyId={busyId}
            onRemove={handleRemove} />)}
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

function MemberRow({ member, leadCount, canManage, currentUserId, busyId, onRemove }: Readonly<{
  member: GroupMember; leadCount: number; canManage: boolean; currentUserId: string; busyId: string | null;
  onRemove: (member: GroupMember) => Promise<void>;
}>) {
  const isLastLead = member.role === "admin" && leadCount <= 1;
  const removed = member.memberStatus === "removed";
  return (
    <div className="hier-row">
      <div className="hier-row-identity"><Avatar login={member.login} name={member.name} avatarUrl={member.avatarUrl} /><div className="hier-row-name"><strong>{member.name || member.login}</strong><span>@{member.login}{member.email ? ` · ${member.email}` : ""}</span></div></div>
      <div className="hier-row-actions">
        <MemberStatusBadge status={member.memberStatus} />
        <MemberRoleBadge member={member} />
        {canManage && !removed && <RemoveMemberButton member={member} busy={busyId === member.id} isLastLead={isLastLead} isSelf={member.userId === currentUserId} onRemove={onRemove} />}
      </div>
    </div>
  );
}

function RemoveMemberButton({ member, busy, isLastLead, isSelf, onRemove }: Readonly<{
  member: GroupMember; busy: boolean; isLastLead: boolean; isSelf: boolean; onRemove: (member: GroupMember) => Promise<void>;
}>) {
  const title = isLastLead ? "A group must keep at least one group lead" : isSelf ? "You can't remove yourself" : undefined;
  return <button type="button" className="hier-btn-danger" disabled={busy || isLastLead || isSelf} title={title} onClick={() => void onRemove(member)}>Remove</button>;
}
