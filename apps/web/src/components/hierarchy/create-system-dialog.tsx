"use client";

import { useState } from "react";

import { createSystem } from "@/lib/api/client";
import type { HierarchySystem } from "@/lib/api/hierarchy-contracts";
import { FormDialog } from "./primitives";

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
      setError("A system name is required.");
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
    } catch {
      setError("The system could not be created. Please try again.");
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
      title="Create system"
      description="A system groups related delivery projects under this group."
      submitLabel="Create system"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="system-name">
          System name
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
