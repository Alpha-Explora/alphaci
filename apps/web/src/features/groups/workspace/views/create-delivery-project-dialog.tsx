"use client";

import { useState } from "react";

import { createDeliveryProject, type DeliveryProject } from "@/features/groups";
import { FormDialog } from "./primitives";

export function CreateDeliveryProjectDialog({
  open,
  systemId,
  onClose,
  onCreated,
}: {
  open: boolean;
  systemId: string;
  onClose: () => void;
  onCreated: (deliveryProject: DeliveryProject) => void;
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
      setError("A delivery project name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const deliveryProject = await createDeliveryProject(systemId, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      onCreated(deliveryProject);
      reset();
      onClose();
    } catch {
      setError("The delivery project could not be created. Please try again.");
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
      title="Create delivery project"
      description="A delivery project is a delivery initiative under this system. Repositories live under it."
      submitLabel="Create delivery project"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="dp-name">
          Delivery project name
        </label>
        <input
          id="dp-name"
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Mobile checkout redesign"
          maxLength={120}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="dp-desc">
          Description <span className="hier-field-hint">(optional)</span>
        </label>
        <textarea
          id="dp-desc"
          className="hier-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
      </div>
    </FormDialog>
  );
}
