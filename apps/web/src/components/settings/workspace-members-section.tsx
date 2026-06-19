"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  WorkspaceMemberSummary,
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/api/contracts";
import {
  addWorkspaceMember,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/lib/api/workspaces";

const ROLE_OPTIONS: WorkspaceRole[] = ["owner", "admin", "developer", "viewer"];

export function WorkspaceMembersSection({
  workspace,
  currentUserId,
}: {
  workspace: WorkspaceSummary;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loginOrEmail, setLoginOrEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("developer");
  const [message, setMessage] = useState<string | null>(null);
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getWorkspaceMembers(workspace.id)
      .then((items) => {
        if (!active) return;
        setMembers(items);
        setMessage(null);
      })
      .catch(() => {
        if (active) setMessage("Workspace members are unavailable right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace.id]);

  async function handleAddMember() {
    if (!loginOrEmail.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const member = await addWorkspaceMember(workspace.id, {
        loginOrEmail: loginOrEmail.trim(),
        role,
      });
      setMembers((current) => [
        member,
        ...current.filter((item) => item.id !== member.id),
      ]);
      setLoginOrEmail("");
    } catch {
      setMessage("Member could not be added. Confirm the user has signed in.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: WorkspaceMemberSummary, nextRole: WorkspaceRole) {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateWorkspaceMemberRole(workspace.id, member.id, {
        role: nextRole,
      });
      setMembers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setMessage("Member role could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(member: WorkspaceMemberSummary) {
    setSaving(true);
    setMessage(null);
    try {
      await removeWorkspaceMember(workspace.id, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
    } catch {
      setMessage("Member could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading members...</p>;
  }

  return (
    <div className="workspace-members">
      <div className="workspace-members-list">
        {members.map((member) => {
          const isLastOwner = member.role === "owner" && ownerCount <= 1;
          return (
            <div key={member.id} className="hover-field workspace-member-row">
              <div className="workspace-member-identity">
                <strong>{member.name || member.login}</strong>
                <span>
                  @{member.login}{member.email ? ` / ${member.email}` : ""}
                </span>
              </div>
              <select
                aria-label={`Role for ${member.login}`}
                value={member.role}
                disabled={!canManage || saving || isLastOwner}
                onChange={(event) =>
                  void handleRoleChange(member, event.target.value as WorkspaceRole)
                }
                className="workspace-member-select"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="workspace-member-btn workspace-member-btn--neutral"
                disabled={!canManage || saving || isLastOwner || member.userId === currentUserId}
                onClick={() => void handleRemove(member)}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {canManage ? (
        <div className="workspace-member-add">
          <input
            aria-label="GitHub login or email"
            value={loginOrEmail}
            onChange={(event) => setLoginOrEmail(event.target.value)}
            placeholder="GitHub login or email"
            className="workspace-member-input"
          />
          <select
            aria-label="New member role"
            value={role}
            onChange={(event) => setRole(event.target.value as WorkspaceRole)}
            className="workspace-member-select"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="workspace-member-btn workspace-member-btn--add"
            disabled={saving || !loginOrEmail.trim()}
            onClick={() => void handleAddMember()}
          >
            Add
          </button>
        </div>
      ) : null}

      {message ? <p className="error-text" style={{ margin: 0 }}>{message}</p> : null}
    </div>
  );
}
