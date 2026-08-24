"use client";

/* Preserve the debounced lookup's immediate reset when the dialog closes. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

import { addGroupMember, searchEligibleGroupUsers } from "@/features/groups";
import { ApiError } from "@/shared/api/request";
import type {
  GroupMember,
  InternalUserDirectoryEntry,
} from "@/features/groups";
import { Avatar, FormDialog } from "./primitives";

/**
 * A 404 here is ambiguous: NestJS returns it both when the user is genuinely
 * missing from the directory AND when the ROUTE does not exist (a backend
 * running a stale build). Inventing "user not found" from the status alone
 * once disguised a stale-build 404 as a data problem, so prefer the server's
 * own `{ message }` and keep the friendly strings only as a fallback.
 */
function describeAddError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 403) {
      return "You're not allowed to add members to this group.";
    }
    const detail = cause.details as { message?: string | string[] } | undefined;
    const message = Array.isArray(detail?.message)
      ? detail?.message.join(", ")
      : detail?.message;
    if (message) return message;
    return `The member could not be added (${String(cause.status)}).`;
  }
  return "The member could not be added. Please try again.";
}

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
      setError(describeAddError(cause));
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
              /* Deliberately does not name the organization. The roster comes
                 from whichever org GITHUB_ENFORCED_ORG points at, which this
                 component has no way to know — the previous copy hardcoded
                 "Alpha-Explora" and would have kept saying so while searching
                 somewhere else entirely. If the org should be named here, it
                 has to arrive as data: the backend already publishes it as
                 `enforcedOrg` on /catalog/project-options. */
              placeholder="Search organization members by name or GitHub login"
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
