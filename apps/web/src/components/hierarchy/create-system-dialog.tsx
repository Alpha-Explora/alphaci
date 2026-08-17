"use client";

import { useState } from "react";

import { ApiError, createSystem } from "@/lib/api/client";
import type { HierarchySystem } from "@/lib/api/hierarchy-contracts";
import { FormDialog } from "./primitives";

/**
 * Creating a system now provisions a real GitHub repository, so failures carry
 * an actionable backend reason (name taken, missing GitHub auth, insufficient
 * role). NestJS returns `{ message }`; surface it instead of a generic string.
 */
function describeCreateError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 403) {
      return "Only a Lead or Admin can create projects.";
    }
    const detail = cause.details as { message?: string | string[] } | undefined;
    const message = Array.isArray(detail?.message)
      ? detail?.message.join(", ")
      : detail?.message;
    return message ?? `Request failed (${cause.status}).`;
  }
  return "The system could not be created. Please try again.";
}

export function CreateSystemDialog({
  open,
  groupId,
  onClose,
  onCreated,
}: {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onCreated: (system: HierarchySystem) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A project name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const system = await createSystem(groupId, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      onCreated(system);
      reset();
      onClose();
    } catch (cause) {
      setError(describeCreateError(cause));
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
      title="Create project"
      description="Creating a project provisions a private GitHub repository under this group. The project name is used as the repository name."
      submitLabel="Create project"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="system-name">
          Project name
        </label>
        <input
          id="system-name"
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Checkout"
          maxLength={120}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="system-desc">
          Description <span className="hier-field-hint">(optional)</span>
        </label>
        <textarea
          id="system-desc"
          className="hier-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
      </div>
    </FormDialog>
  );
}
