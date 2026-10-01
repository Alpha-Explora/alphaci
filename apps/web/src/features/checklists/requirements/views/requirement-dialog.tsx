"use client";

import { FormDialog } from "@/features/groups/workspace";

import { kindCopy, REQUIREMENT_NAME_MAX } from "../../model/requirement-rules";
import type { RequirementKind } from "../../model/requirement-types";
import type {
  RequirementDialogMode,
  RequirementDialogViewModel,
} from "../view-models/use-requirement-dialog-view-model";

const PLACEHOLDERS: Record<RequirementKind, { name: string; description: string; items: string }> = {
  functional: {
    name: "Checkout with saved cards",
    description: "Why this matters, and for whom",
    items: "As a shopper, I can save a card\nAs a shopper, I can pay with a saved card",
  },
  system: {
    name: "Security baseline",
    description: "What this requirement protects",
    items: "Secrets are never logged\nEvery endpoint requires a session",
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

function FirstItemsField({
  vm,
  kind,
  label,
  saving,
}: Readonly<{ vm: RequirementDialogViewModel; kind: RequirementKind; label: string; saving: boolean }>) {
  return (
    <label className="hier-field">
      <span className="hier-field-label">{label} (optional, one per line)</span>
      <textarea
        className="hier-textarea"
        rows={4}
        value={vm.draft.stories}
        disabled={saving}
        placeholder={PLACEHOLDERS[kind].items}
        onChange={(event) => vm.updateDraft({ stories: event.target.value })}
      />
      <span className="rq-field-hint">Acceptance criteria can be added to each one afterwards.</span>
    </label>
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
      {view.creating ? <FirstItemsField vm={vm} kind={view.kind} label={view.copy.items} saving={saving} /> : null}
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
