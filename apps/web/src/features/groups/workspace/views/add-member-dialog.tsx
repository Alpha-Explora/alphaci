"use client";

import type { GroupMember } from "@/features/groups";
import { useAddMemberViewModel } from "../view-models/use-add-member-view-model";
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
  const vm = useAddMemberViewModel({ open, groupId, onAdded, onClose });
  const { selectedUser } = vm;

  return (
    <FormDialog
      open={open}
      onClose={vm.close}
      title="Add member"
      description="Pick a member of your GitHub organization. They join as a Member straight away — you can promote them to Lead afterward."
      submitLabel="Add member"
      submitting={vm.submitting}
      error={vm.error}
      canSubmit={vm.canSubmit}
      onSubmit={vm.submit}
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
              onClick={vm.clearSelection}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              id="add-member-user"
              className="hier-input"
              value={vm.search}
              onChange={(event) => vm.setSearch(event.target.value)}
              /* Deliberately does not name the organization: which directory
                 backs this deployment is configuration (MEMBER_DIRECTORY_*),
                 published by GET /api/v1/directory. Naming it here has to
                 come from that data, never a hardcoded org. */
              placeholder="Search organization members by name or GitHub login"
              autoComplete="off"
            />
            {vm.results.length > 0 && (
              <div
                className="invite-results"
                role="listbox"
                aria-label="Organization members"
              >
                {vm.results.map((user) => (
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
                    onClick={() => vm.select(user)}
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

        <span className="hier-field-hint" role="status">
          {vm.status === "loading"
            ? "Loading organization members…"
            : (vm.emptyMessage ??
              "Members without an AlphaCI account can't be added until they sign in.")}
        </span>
      </div>
    </FormDialog>
  );
}
