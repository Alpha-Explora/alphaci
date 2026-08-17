"use client";

import { useEffect, useState } from "react";

import { addGroupMember, searchEligibleGroupUsers } from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import type {
  GroupMember,
  InternalUserDirectoryEntry,
} from "@/lib/api/hierarchy-contracts";
import { Avatar, FormDialog } from "./primitives";

/**
 * Adds someone to a group immediately. There is no invitation and nothing for
 * the person to accept — they are a member the moment this succeeds.
 */
export function AddMemberDialog({
  open,
  groupId,
  onClose,
  onAdded,
}: {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onAdded: (member: GroupMember) => void;
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
      const member = await addGroupMember(groupId, { userId: selectedUser.id });
      onAdded(member);
      reset();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("You're not allowed to add members to this group.");
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError("That user could not be found in the internal directory.");
      } else {
        setError("The member could not be added. Please try again.");
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
      title="Add member"
      description="Pick a member of your GitHub organization. They join as a Member straight away — you can promote them to Lead afterward."
      submitLabel="Add member"
      submitting={submitting}
      error={error}
      canSubmit={selectedUser !== null && selectedUser.hasAccount}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="add-member-user">
          Organization member
        </label>

        {selectedUser ? (
          // Selected-member chip — clearer than cramming the name back into the
          // text input, and shows the GitHub avatar we're about to add.
          <div className="invite-selected">
            <Avatar
              login={selectedUser.login}
              name={selectedUser.name}
              avatarUrl={selectedUser.avatarUrl}
            />
            <div className="invite-selected__meta">
              <strong>{selectedUser.name ?? selectedUser.login}</strong>
              <span>
                @{selectedUser.login}
                {selectedUser.email ? ` · ${selectedUser.email}` : ""}
              </span>
            </div>
            <button
              type="button"
              className="invite-selected__clear"
              aria-label="Choose a different member"
              onClick={() => {
                setSelectedUser(null);
                setSearch("");
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="add-member-user"
              className="hier-input"
              value={search}
              onChange={(event) => {
                setSelectedUser(null);
                setSearch(event.target.value);
              }}
              placeholder="Search Alpha-Explora members by name or GitHub login"
              autoComplete="off"
            />
            {results.length > 0 && (
              <div
                className="invite-results"
                role="listbox"
                aria-label="Organization members"
              >
                {results.map((user) => (
                  <button
                    key={user.login}
                    type="button"
                    className="invite-result"
                    role="option"
                    aria-selected={false}
                    disabled={!user.hasAccount}
                    title={
                      user.hasAccount
                        ? undefined
                        : "Hasn't signed into AlphaCI yet"
                    }
                    onClick={() => {
                      if (!user.hasAccount) return;
                      setSelectedUser(user);
                      setResults([]);
                    }}
                  >
                    <Avatar
                      login={user.login}
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                    />
                    <div className="invite-result__meta">
                      <strong>{user.name ?? user.login}</strong>
                      <span>
                        @{user.login}
                        {user.hasAccount
                          ? user.email
                            ? ` · ${user.email}`
                            : ""
                          : " · hasn't signed in yet"}
                      </span>
                    </div>
                    {!user.hasAccount && (
                      <span className="invite-result__flag">No account</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <span className="hier-field-hint">
          {searching
            ? "Loading organization members…"
            : "Members without an AlphaCI account can't be added until they sign in."}
        </span>
      </div>
    </FormDialog>
  );
}
