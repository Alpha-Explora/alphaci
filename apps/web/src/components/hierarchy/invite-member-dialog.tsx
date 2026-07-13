"use client";

import { useState } from "react";

import { createGroupInvitation } from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import {
  GROUP_ROLE_LABELS,
  type GroupInvitation,
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
  const [inviteeUserId, setInviteeUserId] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setInviteeUserId("");
    setRole("member");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = inviteeUserId.trim();
    if (!trimmed) {
      setError("An internal user is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const invitation = await createGroupInvitation(groupId, {
        inviteeUserId: trimmed,
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
      canSubmit={inviteeUserId.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="invite-user">
          Internal user
        </label>
        <input
          id="invite-user"
          className="hier-input"
          value={inviteeUserId}
          onChange={(event) => setInviteeUserId(event.target.value)}
          placeholder="Internal user ID"
          autoComplete="off"
        />
        <span className="hier-field-hint">
          The identifier of an approved internal user.
        </span>
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
