"use client";

import { useState } from "react";

import { createGroup } from "@/features/groups";
import { ApiError } from "@/shared/api/request";
import type { GroupSummary } from "@/features/groups";
import { FormDialog } from "./primitives";

export function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: GroupSummary) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setBusinessUnit("");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A group name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const group = await createGroup({
        name: trimmed,
        description: description.trim() || undefined,
        businessUnit: businessUnit.trim() || undefined,
      });
      onCreated(group);
      reset();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 403
          ? "You're not allowed to create a group."
          : "The group could not be created. Please try again.",
      );
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
      title="Create group"
      description="A group organizes your systems, delivery projects, repositories, and members."
      submitLabel="Create group"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="group-name">
          Group name
        </label>
        <input
          id="group-name"
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Payments Platform"
          maxLength={120}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="group-bu">
          Business unit <span className="hier-field-hint">(optional)</span>
        </label>
        <input
          id="group-bu"
          className="hier-input"
          value={businessUnit}
          onChange={(event) => setBusinessUnit(event.target.value)}
          placeholder="e.g. Consumer Banking"
          maxLength={120}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="group-desc">
          Description <span className="hier-field-hint">(optional)</span>
        </label>
        <textarea
          id="group-desc"
          className="hier-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this group is responsible for"
          maxLength={500}
        />
      </div>
    </FormDialog>
  );
}
