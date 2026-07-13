"use client";

import { useState } from "react";

import { createRepositoryAssignment } from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import type { RepositoryAssignment } from "@/lib/api/hierarchy-contracts";
import { FormDialog } from "./primitives";

export function AssignDeveloperDialog({
  open,
  repositoryId,
  onClose,
  onAssigned,
}: {
  open: boolean;
  repositoryId: string;
  onClose: () => void;
  onAssigned: (assignment: RepositoryAssignment) => void;
}) {
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUserId("");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = userId.trim();
    if (!trimmed) {
      setError("Choose a group member to assign.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // accessLevel defaults to 'write' — the only level defined this session.
      const assignment = await createRepositoryAssignment(repositoryId, {
        userId: trimmed,
      });
      onAssigned(assignment);
      reset();
      onClose();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("You're not allowed to assign access on this repository.");
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError("That user isn't an active member of this group.");
      } else if (cause instanceof ApiError && cause.status === 409) {
        setError("That member already has an assignment here.");
      } else {
        setError("The assignment could not be created. Please try again.");
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
      title="Assign member"
      description="Grant a group member write access to this repository. Access is verified against GitHub before it becomes active."
      submitLabel="Assign access"
      submitting={submitting}
      error={error}
      canSubmit={userId.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="assign-user">
          Group member
        </label>
        <input
          id="assign-user"
          className="hier-input"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="Internal user ID"
          autoComplete="off"
        />
        <span className="hier-field-hint">
          Must be an active member of this group. Access level: write.
        </span>
      </div>
    </FormDialog>
  );
}
