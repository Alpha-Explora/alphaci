"use client";

import { useEffect, useState } from "react";

import {
  createGroupInvitation,
  searchEligibleGroupUsers,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import type {
  GroupInvitation,
  InternalUserDirectoryEntry,
} from "@/lib/api/hierarchy-contracts";
import { FormDialog } from "./primitives";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSearch("");
    setSelectedUser(null);
    setResults([]);
    setError(null);
  }

  async function handleSubmit() {
    if (!selectedUser || !selectedUser.hasAccount || !selectedUser.id) {
      setError("Select an organization member who has an AlphaCI account.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Everyone joins as a Member; a Lead can promote them afterward.
      const invitation = await createGroupInvitation(groupId, {
        inviteeUserId: selectedUser.id,
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

  // Load the GitHub organization roster when the dialog opens, and narrow it as
  // the user types. An empty search returns the full org list (live mode).
  useEffect(() => {
    if (!open || selectedUser) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearching(true);
      void searchEligibleGroupUsers(groupId, search.trim())
        .then(setResults)
        .catch(() =>
          setError("The organization member list is unavailable."),
        )
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
      description="Pick a member of your GitHub organization. They'll join as a Member once they accept; you can promote them to Lead later."
      submitLabel="Send invitation"
      submitting={submitting}
      error={error}
      canSubmit={selectedUser !== null && selectedUser.hasAccount}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="invite-user">
          Organization member
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
          placeholder="Search Alpha-Explora members by name or GitHub login"
          autoComplete="off"
        />
        <span className="hier-field-hint">
          {searching
            ? "Loading organization members…"
            : "Members without an AlphaCI account can't be invited until they sign in."}
        </span>
        {!selectedUser && results.length > 0 && (
          <div
            className="hier-panel"
            role="listbox"
            aria-label="Organization members"
          >
            {results.map((user) => (
              <button
                key={user.login}
                type="button"
                className="hier-row"
                disabled={!user.hasAccount}
                title={
                  user.hasAccount
                    ? undefined
                    : "Hasn't signed into AlphaCI yet"
                }
                style={user.hasAccount ? undefined : { opacity: 0.5 }}
                onClick={() => {
                  if (!user.hasAccount) return;
                  setSelectedUser(user);
                  setResults([]);
                }}
              >
                <span>{user.name ?? user.login}</span>
                <span>
                  @{user.login}
                  {user.hasAccount
                    ? user.email
                      ? ` · ${user.email}`
                      : ""
                    : " · hasn't signed in yet"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </FormDialog>
  );
}
