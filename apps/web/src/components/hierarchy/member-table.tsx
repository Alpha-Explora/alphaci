"use client";

import { useMemo, useState } from "react";

import { removeGroupMember, updateGroupMemberRole } from "@/lib/api/client";
import {
  GROUP_ROLE_LABELS,
  type GroupMember,
  type GroupRole,
} from "@/lib/api/hierarchy-contracts";
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
                  {/*
                    Role is EDITABLE by a manager (2026-08-18). It used to be a
                    read-only badge pointing at the Admin Console, but the
                    Console sets the GLOBAL role (app_role) — a different axis
                    entirely — so there was no way anywhere in the product to
                    make somebody a Lead of a team, while the Add member dialog
                    promised exactly that.

                    The last Lead cannot be demoted, mirroring the backend's
                    row-locked guard; the control is disabled rather than
                    hidden so the reason can be read from the tooltip.
                  */}
                  {canManage && !removed ? (
                    <label className="hier-role-picker">
                      <span className="sr-only">
                        Role for {member.name || member.login}
                      </span>
                      <select
                        className="hier-role-select"
                        value={member.role}
                        disabled={busyId === member.id || isLastLead}
                        title={
                          isLastLead
                            ? "A team must keep at least one Lead"
                            : undefined
                        }
                        onChange={(event) =>
                          void handleRoleChange(
                            member,
                            event.target.value as GroupRole,
                          )
                        }
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {GROUP_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </label>
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

      {error && (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
