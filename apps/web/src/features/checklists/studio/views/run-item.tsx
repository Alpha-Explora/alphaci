"use client";

import type { FormEvent } from "react";

import { PersonaBadge, SeverityBadge, StatusPill, VerificationBadge } from "../../items";
import { RetestForm, type RequestRetestViewModel } from "../../returned";
import { needsTestIdentifier } from "../../model/checklist-rules";
import {
  agoLabel,
  allowedItemStatuses,
  canEditItem,
  canRequestRetest,
  itemStatusLabel,
  previousResultLabel,
  QA_SEVERITIES,
  severityLabel,
  statusNeedsSeverity,
  statusShowsDefect,
} from "../../model/qa-run-rules";
import type {
  QaDefectSeverity,
  QaItemDraft,
  QaRun,
  QaRunItem,
  QaRunItemStatus,
} from "../../model/qa-run-types";
import type { QaItemEditorViewModel } from "../view-models/use-qa-item-editor-view-model";
import { StatusMarker } from "./status-marker";
import { HistoryIcon } from "./studio-icons";

type ItemProps = Readonly<{
  item: QaRunItem;
  index: number;
  run: QaRun;
  editor: QaItemEditorViewModel;
  retest: RequestRetestViewModel;
  onReload: () => void;
}>;

/** "Failed by @lee · 2h ago": who last set the status, when the server says. */
function VerifiedLine({ item }: Readonly<{ item: QaRunItem }>) {
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

/** What was recorded against the item: severity, notes and how to reproduce it. */
function RecordedFacts({ item }: Readonly<{ item: QaRunItem }>) {
  const defect = statusShowsDefect(item.status);
  const hasFacts = item.notes || (defect && (item.defectSeverity || item.reproductionSteps));
  if (!hasFacts) return null;
  return (
    <div className={`qa-run-item__facts${defect ? " qa-run-item__facts--defect" : ""}`}>
      {defect && item.defectSeverity ? <SeverityBadge severity={item.defectSeverity} /> : null}
      <TextBlock label="Notes" text={item.notes} />
      {defect ? <TextBlock label="Reproduction steps" text={item.reproductionSteps} /> : null}
    </div>
  );
}

/** A developer's "fixed, please re-test", with their note. */
function FixRequestNote({ item }: Readonly<{ item: QaRunItem }>) {
  if (!item.fixRequest) return null;
  const ago = agoLabel(item.fixRequest.requestedAt);
  return (
    <div className="qa-fix-note">
      <p className="qa-fix-note__head">
        Marked fixed by <strong>@{item.fixRequest.requestedBy.login}</strong>
        {ago ? ` · ${ago}` : ""} — re-test requested
      </p>
      {item.fixRequest.note ? <p className="qa-fix-note__text">{item.fixRequest.note}</p> : null}
    </div>
  );
}

function StatusSelect({
  item,
  index,
  run,
  editor,
}: Omit<ItemProps, "retest" | "onReload">) {
  const allowed = allowedItemStatuses(item, run);
  const draft = editor.openItemId === item.id ? editor.draft : null;
  const value = draft?.status ?? item.status;
  // The current status stays visible even when this viewer could not set it.
  const options = allowed.includes(value) ? allowed : [value, ...allowed];
  return (
    <label className="qa-status-select">
      <span className="sr-only">Status of item {index + 1}</span>
      <select
        className="hier-select"
        value={value}
        disabled={editor.savingItemId !== null}
        onChange={(event) => editor.chooseStatus(item, event.target.value as QaRunItemStatus)}
      >
        {options.map((status) => (
          <option key={status} value={status} disabled={!allowed.includes(status)}>
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

function saveLabel(item: QaRunItem, draft: QaItemDraft, saving: boolean): string {
  if (saving) return "Saving…";
  return draft.status === item.status ? "Save" : `Mark ${itemStatusLabel(draft.status)}`;
}

function ItemEditor({ item, editor }: Readonly<{ item: QaRunItem; editor: QaItemEditorViewModel }>) {
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
      {defect ? (
        <SeverityField draft={draft} onChange={(value) => editor.updateDraft({ defectSeverity: value })} />
      ) : null}
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

function ItemError({
  item,
  editor,
  onReload,
}: Readonly<{ item: QaRunItem; editor: QaItemEditorViewModel; onReload: () => void }>) {
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

function detailsLabel(item: QaRunItem): string {
  return item.notes || item.reproductionSteps ? "Edit notes" : "Add notes";
}

function ItemControls({ item, index, run, editor, retest }: Omit<ItemProps, "onReload">) {
  const editable = canEditItem(item, run);
  const retestable = canRequestRetest(item, run);
  const editing = editor.openItemId === item.id;
  if (!editable && !retestable) return null;
  return (
    <div className="qa-run-item__controls">
      {editable ? <StatusSelect item={item} index={index} run={run} editor={editor} /> : null}
      {editable && !editing ? (
        <button
          type="button"
          className="qa-text-button"
          disabled={editor.savingItemId !== null}
          onClick={() => editor.openDetails(item)}
        >
          {detailsLabel(item)}
        </button>
      ) : null}
      {editor.savingItemId === item.id && !editing ? (
        <span className="qa-run-item__saving" role="status">
          Saving…
        </span>
      ) : null}
      {retestable && !editing ? (
        <RetestForm vm={retest} target={{ runId: run.id, itemId: item.id }} itemTitle={item.title} />
      ) : null}
    </div>
  );
}

/**
 * One item on the run: what to check, who checks it and how, what was found,
 * and — for those allowed — the control to record the result. Everything the
 * viewer cannot change is still shown, just without a control.
 */
export function RunItem(props: ItemProps) {
  const { item, index, run, editor } = props;
  const previous = previousResultLabel(item);
  const readOnly =
    run.status === "open" && !canEditItem(item, run) && !canRequestRetest(item, run);
  return (
    <li className={`qa-run-item${editor.openItemId === item.id ? " qa-run-item--open" : ""}`}>
      <StatusMarker status={item.status} index={index} />
      <div className="qa-run-item__body">
        <div className="qa-run-item__head">
          <span className="qa-run-item__title">{item.title}</span>
          <StatusPill status={item.status} />
        </div>
        {item.description ? <p className="qa-run-item__desc">{item.description}</p> : null}
        <div className="qa-run-item__tags">
          <PersonaBadge persona={item.targetPersona} />
          <VerificationBadge type={item.verificationType} />
          {needsTestIdentifier(item.verificationType) && item.testIdentifier ? (
            <code className="qa-run-item__test">{item.testIdentifier}</code>
          ) : null}
        </div>
        {previous ? (
          <p className="qa-run-item__previous">
            <HistoryIcon />
            {previous}
          </p>
        ) : null}
        <VerifiedLine item={item} />
        {editor.openItemId === item.id ? null : <RecordedFacts item={item} />}
        <FixRequestNote item={item} />
        <ItemControls {...props} />
        {readOnly ? <p className="qa-run-item__readonly">Read-only for your role</p> : null}
        <ItemEditor item={item} editor={editor} />
        <ItemError item={item} editor={editor} onReload={props.onReload} />
      </div>
    </li>
  );
}
