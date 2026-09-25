"use client";

import type { FormEvent } from "react";

import type { QaChecklist } from "../../model/checklist-types";
import { CHECKLIST_NAME_MAX, itemCountLabel } from "../../model/checklist-rules";
import { useChecklistEditorViewModel } from "../view-models/use-checklist-editor-view-model";
import { ChecklistItemsEditor } from "./checklist-items-editor";

function SaveError({
  error,
  stale,
  onReload,
}: Readonly<{ error: string | null; stale: boolean; onReload: () => void }>) {
  if (!error) return null;
  return (
    <div className="qa-save-error" role="alert">
      <p>{error}</p>
      {stale ? (
        <button type="button" className="ghost-button group-section-action" onClick={onReload}>
          Reload checklist
        </button>
      ) : null}
    </div>
  );
}

function submitLabel(saving: boolean, isNew: boolean): string {
  if (saving) return "Saving…";
  return isNew ? "Create checklist" : "Save changes";
}

function EditorFooter({
  saving,
  isNew,
  dirty,
  onCancel,
}: Readonly<{ saving: boolean; isNew: boolean; dirty: boolean; onCancel: () => void }>) {
  // A new checklist can always be submitted — validation explains what is
  // missing. An edit with nothing changed has nothing to save.
  const blocked = saving || (!isNew && !dirty);
  return (
    <div className="qa-editor__footer">
      <button type="submit" className="primary-button group-section-action" disabled={blocked}>
        {submitLabel(saving, isNew)}
      </button>
      <button
        type="button"
        className="ghost-button group-section-action"
        disabled={saving}
        onClick={onCancel}
      >
        Cancel
      </button>
      {dirty && !saving ? <span className="qa-editor__dirty">Unsaved changes</span> : null}
    </div>
  );
}

function DetailsFields({
  name,
  description,
  nameError,
  disabled,
  onName,
  onDescription,
}: Readonly<{
  name: string;
  description: string;
  nameError: string | null;
  disabled: boolean;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
}>) {
  return (
    <div className="qa-editor__details">
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="hier-input"
          value={name}
          maxLength={CHECKLIST_NAME_MAX}
          disabled={disabled}
          placeholder="Release smoke test"
          aria-invalid={nameError ? true : undefined}
          onChange={(event) => onName(event.target.value)}
        />
        {nameError ? (
          <span className="qa-field-error" role="alert">
            {nameError}
          </span>
        ) : null}
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={description}
          disabled={disabled}
          placeholder="When to run it and what it protects (optional)"
          onChange={(event) => onDescription(event.target.value)}
        />
        <span className="hier-field-hint">Plain text. Line breaks are kept.</span>
      </label>
    </div>
  );
}

/**
 * Create or edit one checklist. Nothing is written until Save, so a lead can
 * reorder and retype freely and Cancel really does throw it away.
 */
export function ChecklistEditor({
  workspaceId,
  checklist,
  onSaved,
  onCancel,
  onReload,
}: Readonly<{
  workspaceId: string;
  checklist: QaChecklist | null;
  onSaved: (checklist: QaChecklist) => void;
  onCancel: () => void;
  onReload: () => void;
}>) {
  const vm = useChecklistEditorViewModel({ workspaceId, checklist, onSaved });
  const { draft, validation } = vm;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.save();
  }

  return (
    <form className="qa-editor" onSubmit={handleSubmit} noValidate>
      <div className="qa-editor__head">
        <h4 className="qa-detail__title">{vm.isNew ? "New checklist" : "Edit checklist"}</h4>
        <p className="qa-detail__meta">
          {vm.isNew
            ? "Name it after the moment it guards — a release, a migration, a payment change."
            : `Version ${checklist?.version ?? 1} · saving creates the next version`}
        </p>
      </div>

      <DetailsFields
        name={draft.name}
        description={draft.description}
        nameError={validation.nameError}
        disabled={vm.saving}
        onName={vm.setName}
        onDescription={vm.setDescription}
      />

      <div className="qa-editor__items">
        <div className="qa-editor__items-head">
          <h5 className="qa-subhead">
            Items
            <span className="group-section-count">{draft.items.length}</span>
          </h5>
          <span className="hier-field-hint">
            {draft.items.length > 0
              ? `${itemCountLabel(draft.items.length)}, worked through in this order`
              : "Order is the order people work through them"}
          </span>
        </div>
        <ChecklistItemsEditor
          items={draft.items}
          itemErrors={validation.itemErrors}
          disabled={vm.saving}
          onAdd={vm.addItem}
          onChange={vm.updateItem}
          onMove={vm.moveItem}
          onRemove={vm.removeItem}
        />
      </div>

      <SaveError error={vm.error} stale={vm.stale} onReload={onReload} />

      <EditorFooter
        saving={vm.saving}
        isNew={vm.isNew}
        dirty={vm.dirty}
        onCancel={onCancel}
      />
    </form>
  );
}
