"use client";

import { useState } from "react";

import { createRepository } from "@/features/groups";
import { ApiError } from "@/shared/api/request";
import type { HierarchyRepository } from "@/features/groups";
import { FormDialog } from "./primitives";

export function CreateRepositoryDialog({
  open,
  deliveryProjectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  deliveryProjectId: string;
  onClose: () => void;
  onCreated: (repository: HierarchyRepository) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setError(null);
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("A repository name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Visibility is 'private' only — enforced by the backend (plan §2.6).
      const repository = await createRepository(deliveryProjectId, {
        name: trimmed,
        visibility: "private",
      });
      onCreated(repository);
      reset();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "A repository with that name already exists."
          : "The repository could not be created. Please try again.",
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
      title="Create repository"
      description="Creates a private GitHub repository, wires it into CI/CD, and adds it to this delivery project."
      submitLabel="Create repository"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="repo-name">
          Repository name
        </label>
        <input
          id="repo-name"
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. checkout-service"
          maxLength={100}
          autoComplete="off"
        />
      </div>
      <div className="hier-field">
        <span className="hier-field-label">Visibility</span>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Private
        </div>
        <span className="hier-field-hint">
          Repositories in a group are always private.
        </span>
      </div>
    </FormDialog>
  );
}
