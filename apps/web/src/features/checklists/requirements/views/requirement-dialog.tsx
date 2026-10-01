"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { FormDialog } from "@/features/groups/workspace";

import { kindCopy, REQUIREMENT_NAME_MAX } from "../../model/requirement-rules";
import type { RequirementKind } from "../../model/requirement-types";
import type {
  RequirementDialogMode,
  RequirementDialogViewModel,
} from "../view-models/use-requirement-dialog-view-model";
import { PlusIcon, RemoveIcon } from "./requirement-icons";

const PLACEHOLDERS: Record<RequirementKind, { name: string; description: string; items: readonly string[] }> = {
  functional: {
    name: "Checkout with saved cards",
    description: "Why this matters, and for whom",
    items: ["As a shopper, I can save a card", "As a shopper, I can pay with a saved card"],
  },
  system: {
    name: "Security baseline",
    description: "What this requirement protects",
    items: ["Secrets are never logged", "Every endpoint requires a session"],
  },
};

function dialogCopy(mode: RequirementDialogMode) {
  const creating = mode.kind === "create";
  const kind = creating ? mode.requirementKind : mode.requirement.kind;
  const copy = kindCopy(kind);
  return {
    kind,
    creating,
    copy,
    title: creating ? copy.create : `Edit ${copy.singular.toLowerCase()}`,
    description: creating
      ? `It applies to every repository in this Project. Developers track its ${copy.items.toLowerCase()}; the QA Team verifies them.`
      : undefined,
    submitLabel: creating ? `Create ${copy.singular.toLowerCase()}` : "Save",
  };
}

/**
 * The first stories (or items) as a list, one input per row. Enter adds the
 * next row, Backspace on an empty row removes it, and pasting several lines
 * adds one row per line.
 */
function FirstItemsField({
  vm,
  kind,
  saving,
}: Readonly<{ vm: RequirementDialogViewModel; kind: RequirementKind; saving: boolean }>) {
  const copy = kindCopy(kind);
  const rows = vm.draft.stories;
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  /* Which row to focus once the next render has it (after add or remove). */
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const at = pendingFocus.current;
    if (at === null) return;
    pendingFocus.current = null;
    inputs.current[at]?.focus();
  });

  function addAfter(index: number) {
    pendingFocus.current = index + 1;
    vm.addStory(index);
  }

  function remove(index: number) {
    pendingFocus.current = Math.max(0, Math.min(index, rows.length - 2));
    vm.removeStory(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      // The dialog is a form: Enter here means "next row", not "create".
      event.preventDefault();
      addAfter(index);
    } else if (event.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      event.preventDefault();
      pendingFocus.current = Math.max(0, index - 1);
      vm.removeStory(index);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    if (vm.pasteStories(index, event.clipboardData.getData("text"))) event.preventDefault();
  }

  return (
    <fieldset className="hier-field rq-story-rows" data-kind={kind} disabled={saving}>
      <legend className="hier-field-label">{copy.items} (optional)</legend>
      <ol className="rq-story-rows__list">
        {rows.map((row, index) => (
          // Rows are plain strings; the index is their identity while the dialog is open.
          <li className="rq-story-row" key={index}>
            <span className="rq-story-row__number" aria-hidden="true">
              {index + 1}
            </span>
            <input
              ref={(element) => {
                inputs.current[index] = element;
              }}
              className="hier-input rq-story-row__input"
              aria-label={`${copy.item} ${index + 1}`}
              value={row}
              placeholder={PLACEHOLDERS[kind].items[index] ?? ""}
              onChange={(event) => vm.editStory(index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              onPaste={(event) => onPaste(event, index)}
            />
            <button
              type="button"
              className="rq-story-row__remove"
              aria-label={`Remove ${copy.item.toLowerCase()} ${index + 1}`}
              disabled={rows.length === 1 && row === ""}
              onClick={() => remove(index)}
            >
              <RemoveIcon />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="rq-add" onClick={() => addAfter(rows.length - 1)}>
        <PlusIcon /> {copy.addItem}
      </button>
      <span className="rq-field-hint">
        Enter adds the next one; pasting a list adds a row per line. Acceptance criteria can be added to each
        one afterwards.
      </span>
    </fieldset>
  );
}

/** Create or edit a Feature / System requirement. Product owners and admins only. */
export function RequirementDialog({ vm }: Readonly<{ vm: RequirementDialogViewModel }>) {
  if (!vm.mode) return null;
  const view = dialogCopy(vm.mode);
  const saving = vm.status === "saving";
  return (
    <FormDialog
      open={vm.status === "editing" || saving}
      onClose={vm.close}
      title={view.title}
      description={view.description}
      submitLabel={view.submitLabel}
      submitting={saving}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.submit()}
    >
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="hier-input"
          value={vm.draft.name}
          maxLength={REQUIREMENT_NAME_MAX + 20}
          disabled={saving}
          placeholder={PLACEHOLDERS[view.kind].name}
          onChange={(event) => vm.updateDraft({ name: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description (optional)</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={vm.draft.description}
          disabled={saving}
          placeholder={PLACEHOLDERS[view.kind].description}
          onChange={(event) => vm.updateDraft({ description: event.target.value })}
        />
      </label>
      {view.creating ? <FirstItemsField vm={vm} kind={view.kind} saving={saving} /> : null}
      {vm.validationError ? (
        <p className="rq-form-error" role="alert">
          {vm.validationError}
        </p>
      ) : null}
    </FormDialog>
  );
}

/** "Archive this requirement?" — it leaves the Project and the next QA run. */
export function ArchiveRequirementDialog({ vm }: Readonly<{ vm: RequirementDialogViewModel }>) {
  const open = vm.status === "confirm-archive" || vm.status === "archiving";
  const mode = vm.mode;
  if (!open || mode?.kind !== "edit") return null;
  const requirement = mode.requirement;
  const copy = kindCopy(requirement.kind);
  return (
    <FormDialog
      open={open}
      onClose={vm.close}
      title={`Archive ${requirement.name}?`}
      description={`The ${copy.singular.toLowerCase()} leaves this Project and the next QA run. Runs already started keep their copy, and signed-off runs stay as they are.`}
      submitLabel="Archive"
      submitting={vm.status === "archiving"}
      error={vm.error?.message ?? null}
      onSubmit={() => void vm.confirmArchive()}
    >
      <p className="rq-note">
        {requirement.items.length} {requirement.items.length === 1 ? copy.item.toLowerCase() : copy.items.toLowerCase()}{" "}
        will be archived with it.
      </p>
    </FormDialog>
  );
}
