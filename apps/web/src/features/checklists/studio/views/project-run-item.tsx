"use client";

import type { FormEvent } from "react";

import { SeverityBadge, StatusPill, TonePill, VerificationBadge } from "../../items";
import { needsTestIdentifier } from "../../model/checklist-rules";
import { passedUnavailableReason } from "../../model/project-run-rules";
import type { ProjectQaRunItem, VerificationStatus } from "../../model/project-run-types";
import {
  agoLabel,
  itemStatusLabel,
  QA_SEVERITIES,
  severityLabel,
  statusNeedsSeverity,
  statusShowsDefect,
} from "../../model/qa-run-rules";
import type { QaDefectSeverity, QaItemDraft } from "../../model/qa-run-types";
import { progressLabel, progressTone } from "../../model/requirement-rules";
import type { ProjectVerificationViewModel } from "../view-models/use-project-verification-view-model";
import { StatusMarker } from "./status-marker";

type ItemProps = Readonly<{
  item: ProjectQaRunItem;
  index: number;
  editor: ProjectVerificationViewModel;
  onReload: () => void;
}>;

function VerifiedLine({ item }: Readonly<{ item: ProjectQaRunItem }>) {
  if (!item.verifiedBy || item.status === "pending") return null;
  const ago = agoLabel(item.verifiedAt);
  const verb = item.status === "returned_to_dev" ? "Returned" : itemStatusLabel(item.status);
  return (
    <p className="qa-run-item__by">
      {verb} by <strong>@{item.verifiedBy.login}</strong>
      {ago ? ` · ${ago}` : ""}
    </p>
  );
}

function TextBlock({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <div className="qa-run-item__text">
      <span className="qa-run-item__text-label">{label}</span>
      <p>{text}</p>
    </div>
  );
}

function RecordedFacts({ item }: Readonly<{ item: ProjectQaRunItem }>) {
  const defect = statusShowsDefect(item.status);
  if (!item.notes && !(defect && (item.defectSeverity || item.reproductionSteps))) return null;
  return (
    <div className={`qa-run-item__facts${defect ? " qa-run-item__facts--defect" : ""}`}>
      {defect && item.defectSeverity ? <SeverityBadge severity={item.defectSeverity} /> : null}
      <TextBlock label="Notes" text={item.notes} />
      {defect ? <TextBlock label="Reproduction steps" text={item.reproductionSteps} /> : null}
    </div>
  );
}

function FixRequestNote({ item }: Readonly<{ item: ProjectQaRunItem }>) {
  if (!item.fixRequest) return null;
  const ago = agoLabel(item.fixRequest.requestedAt);
  return (
    <div className="qa-fix-note">
      <p className="qa-fix-note__head">
        Marked Done again by <strong>@{item.fixRequest.requestedBy.login}</strong>
        {ago ? ` · ${ago}` : ""} — ready for QA
      </p>
      {item.fixRequest.note ? <p className="qa-fix-note__text">{item.fixRequest.note}</p> : null}
    </div>
  );
}

/** The Developer's Progress on the item, shown to QA beside the Verification. */
function ProgressTag({ item }: Readonly<{ item: ProjectQaRunItem }>) {
  if (!item.progress) return <span className="pqa-progress-unknown">Progress unknown</span>;
  return <TonePill tone={progressTone(item.progress)} label={`Progress: ${progressLabel(item.progress)}`} />;
}

function VerificationSelect({ item, index, editor }: Omit<ItemProps, "onReload">) {
  const allowed = editor.allowedStatuses(item);
  const draft = editor.openItemId === item.id ? editor.draft : null;
  const value = draft?.status ?? item.status;
  // The current value stays visible even when this viewer could not set it.
  const options = (allowed as string[]).includes(value) ? allowed : [value, ...allowed];
  return (
    <label className="qa-status-select">
      <span className="sr-only">Verification of item {index + 1}</span>
      <select
        className="hier-select"
        value={value}
        disabled={editor.savingItemId !== null}
        onChange={(event) => editor.chooseStatus(item, event.target.value as VerificationStatus)}
      >
        {options.map((status) => (
          <option key={status} value={status} disabled={!(allowed as string[]).includes(status)}>
            {itemStatusLabel(status)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SeverityField({
  draft,
  onChange,
}: Readonly<{ draft: QaItemDraft; onChange: (value: QaDefectSeverity | "") => void }>) {
  const required = statusNeedsSeverity(draft.status);
  return (
    <label className="hier-field qa-editor-field">
      <span className="hier-field-label">
        Severity{required ? <span className="qa-required"> (required)</span> : null}
      </span>
      <select
        className="hier-select"
        value={draft.defectSeverity}
        aria-required={required}
        onChange={(event) => onChange(event.target.value as QaDefectSeverity | "")}
      >
        <option value="">{required ? "Choose a severity" : "No severity"}</option>
        {QA_SEVERITIES.map((severity) => (
          <option key={severity} value={severity}>
            {severityLabel(severity)}
          </option>
        ))}
      </select>
    </label>
  );
}

function saveLabel(item: ProjectQaRunItem, draft: QaItemDraft, saving: boolean): string {
  if (saving) return "Saving…";
  return draft.status === item.status ? "Save" : `Mark ${itemStatusLabel(draft.status)}`;
}

function ItemEditor({ item, editor }: Readonly<{ item: ProjectQaRunItem; editor: ProjectVerificationViewModel }>) {
  const draft = editor.draft;
  if (editor.openItemId !== item.id || !draft) return null;
  const saving = editor.savingItemId === item.id;
  const defect = statusShowsDefect(draft.status);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void editor.saveDraft(item);
  }

  return (
    <form className="qa-item-editor" onSubmit={handleSubmit} noValidate>
      {defect ? <SeverityField draft={draft} onChange={(value) => editor.updateDraft({ defectSeverity: value })} /> : null}
      <label className="hier-field qa-editor-field">
        <span className="hier-field-label">Notes</span>
        <textarea
          className="hier-textarea"
          rows={2}
          value={draft.notes}
          disabled={saving}
          placeholder={defect ? "What went wrong" : "Anything worth knowing (optional)"}
          onChange={(event) => editor.updateDraft({ notes: event.target.value })}
        />
      </label>
      {defect ? (
        <label className="hier-field qa-editor-field">
          <span className="hier-field-label">Reproduction steps</span>
          <textarea
            className="hier-textarea"
            rows={3}
            value={draft.reproductionSteps}
            disabled={saving}
            placeholder={"1. Open /checkout\n2. Pay with the saved card\n3. …"}
            onChange={(event) => editor.updateDraft({ reproductionSteps: event.target.value })}
          />
        </label>
      ) : null}
      {editor.draftError ? (
        <p className="qa-form-error" role="alert">
          {editor.draftError}
        </p>
      ) : null}
      <div className="qa-item-editor__actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saveLabel(item, draft, saving)}
        </button>
        <button type="button" className="ghost-button" disabled={saving} onClick={editor.closeDetails}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemError({ item, editor, onReload }: ItemProps) {
  const error = editor.error;
  if (!error || error.itemId !== item.id) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{error.message}</p>
      {error.stale ? (
        <button type="button" className="ghost-button" onClick={onReload}>
          Reload run
        </button>
      ) : (
        <button type="button" className="qa-text-button" onClick={editor.dismissError}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function ItemControls({ item, index, editor }: Omit<ItemProps, "onReload">) {
  const editable = editor.allowedStatuses(item).length > 0;
  const editing = editor.openItemId === item.id;
  if (!editable) return null;
  const passHint = passedUnavailableReason(item);
  return (
    <>
      <div className="qa-run-item__controls">
        <VerificationSelect item={item} index={index} editor={editor} />
        {editing ? null : (
          <button
            type="button"
            className="qa-text-button"
            disabled={editor.savingItemId !== null}
            onClick={() => editor.openDetails(item)}
          >
            {item.notes || item.reproductionSteps ? "Edit notes" : "Add notes"}
          </button>
        )}
        {editor.savingItemId === item.id && !editing ? (
          <span className="qa-run-item__saving" role="status">
            Saving…
          </span>
        ) : null}
      </div>
      {passHint && item.status !== "passed" ? <p className="pqa-pass-hint">{passHint}</p> : null}
    </>
  );
}

/**
 * One item of a Project run: what to check, its acceptance criteria, how far
 * the Developers say it is, what QA found, and — for the QA Team, Product
 * owners and admins — the Verification control.
 */
export function ProjectRunItem(props: ItemProps) {
  const { item, index, editor } = props;
  const open = editor.openItemId === item.id;
  return (
    <li className={`qa-run-item${open ? " qa-run-item--open" : ""}`}>
      <StatusMarker status={item.status} index={index} />
      <div className="qa-run-item__body">
        <div className="qa-run-item__head">
          <span className="qa-run-item__title">{item.title}</span>
          <span className="qa-run-item__states">
            <StatusPill status={item.status} />
          </span>
        </div>
        {item.acceptanceCriteria ? (
          <div className="pqa-criteria">
            <span className="pqa-criteria__label">Acceptance criteria</span>
            <p>{item.acceptanceCriteria}</p>
          </div>
        ) : null}
        <div className="qa-run-item__tags">
          <ProgressTag item={item} />
          <VerificationBadge type={item.verificationType} />
          {needsTestIdentifier(item.verificationType) && item.testIdentifier ? (
            <code className="qa-run-item__test">{item.testIdentifier}</code>
          ) : null}
        </div>
        <VerifiedLine item={item} />
        {open ? null : <RecordedFacts item={item} />}
        <FixRequestNote item={item} />
        <ItemControls item={item} index={index} editor={editor} />
        <ItemEditor item={item} editor={editor} />
        <ItemError {...props} />
      </div>
    </li>
  );
}
