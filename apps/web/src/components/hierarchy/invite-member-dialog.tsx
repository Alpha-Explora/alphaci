"use client";

import { useEffect, useState } from "react";

import {
  createGroupInvitation,
  searchEligibleGroupUsers,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import {
  GROUP_ROLE_LABELS,
  type GroupInvitation,
  type InternalUserDirectoryEntry,
  type InvitableRole,
} from "@/lib/api/hierarchy-contracts";
import { FormDialog } from "./primitives";

const INVITABLE_ROLES: InvitableRole[] = ["delegated_lead", "member", "viewer"];

export function InviteMemberDialog({
  open,
  groupId,
  onClose,
  onInvited,
}: {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onInvited: (invitation: GroupInvitation) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] =
    useState<InternalUserDirectoryEntry | null>(null);
  const [results, setResults] = useState<InternalUserDirectoryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState<InvitableRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSearch("");
    setSelectedUser(null);
    setResults([]);
    setRole("member");
    setError(null);
  }

  async function handleSubmit() {
    if (!selectedUser) {
      setError("An internal user is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const invitation = await createGroupInvitation(groupId, {
        inviteeUserId: selectedUser.id,
        role,
      });
      onInvited(invitation);
      reset();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("You're not allowed to invite members to this group.");
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError("That user could not be found in the internal directory.");
      } else {
        setError("The invitation could not be sent. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!open || selectedUser || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchEligibleGroupUsers(groupId, search.trim())
        .then(setResults)
        .catch(() => setError("The internal user directory is unavailable."))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [groupId, open, search, selectedUser]);

  return (
    <FormDialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Invite member"
      description="Invite an internal user to this group. They'll join once they accept."
      submitLabel="Send invitation"
      submitting={submitting}
      error={error}
      canSubmit={selectedUser !== null}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="invite-user">
          Internal user
        </label>
        <input
          id="invite-user"
          className="hier-input"
          value={
            selectedUser
              ? `${selectedUser.name ?? selectedUser.login} (@${selectedUser.login})`
              : search
          }
          onChange={(event) => {
            setSelectedUser(null);
            setSearch(event.target.value);
          }}
          placeholder="Search by name, GitHub login, or email"
          autoComplete="off"
        />
        <span className="hier-field-hint">
          {searching
            ? "Searching approved internal users…"
            : "Select an approved internal user."}
        </span>
        {!selectedUser && results.length > 0 && (
          <div className="hier-panel" role="listbox" aria-label="Matching internal users">
            {results.map((user) => (
              <button
                key={user.id}
                type="button"
                className="hier-row"
                onClick={() => {
                  setSelectedUser(user);
                  setResults([]);
                }}
              >
                <span>{user.name ?? user.login}</span>
                <span>
                  @{user.login}
                  {user.email ? ` · ${user.email}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="invite-role">
          Role
        </label>
        <select
          id="invite-role"
          className="hier-select"
          value={role}
          onChange={(event) => setRole(event.target.value as InvitableRole)}
        >
          {INVITABLE_ROLES.map((option) => (
            <option key={option} value={option}>
              {GROUP_ROLE_LABELS[option]}
            </option>
          ))}
        </select>
        <span className="hier-field-hint">
          Lead is assigned only via ownership transfer.
        </span>
      </div>
    </FormDialog>
  );
}
