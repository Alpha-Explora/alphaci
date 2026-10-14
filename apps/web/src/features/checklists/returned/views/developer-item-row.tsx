"use client";

import type { FormEvent } from "react";

import { PersonaBadge, SeverityBadge, StatusPill, VerificationBadge } from "../../items";
import { needsTestIdentifier } from "../../model/checklist-rules";
import { myItemKey } from "../../model/qa-my-items-rules";
import {
  agoLabel,
  itemStatusLabel,
  QA_SEVERITIES,
  severityLabel,
  statusNeedsSeverity,
  statusShowsDefect,
} from "../../model/qa-run-rules";
import type { QaDefectSeverity, QaDeveloperItem, QaItemDraft, QaRunItemStatus } from "../../model/qa-run-types";
import type { DeveloperItemEditorViewModel } from "../view-models/use-developer-item-editor-view-model";

type RowProps = Readonly<{ entry: QaDeveloperItem; vm: DeveloperItemEditorViewModel; onReload: () => void }>;

/** "Passed by @miguel · 5m ago": who last set the status, when the server says. */
function VerifiedLine({ entry }: Readonly<{ entry: QaDeveloperItem }>) {
  const { item } = entry;
  if (!item.verifiedBy || item.status === "pending") return null;
  const ago = agoLabel(item.verifiedAt);
  return (
    <span>
      {itemStatusLabel(item.status)} by <strong>@{item.verifiedBy.login}</strong>
      {ago ? ` · ${ago}` : ""}
    </span>
  );
}

function StatusControl({ entry, vm }: Readonly<{ entry: QaDeveloperItem; vm: DeveloperItemEditorViewModel }>) {
  const allowed = vm.allowedStatuses(entry);
  const draft = vm.openKey === myItemKey(entry) ? vm.draft : null;
  const value = draft?.status ?? entry.item.status;
  // The current status stays visible even when it is not one this viewer can set.
  const options = allowed.includes(value) ? allowed : [value, ...allowed];
  return (
    <label className="qa-mine__status">
      <span className="sr-only">Status of {entry.item.title}</span>
      <select
        className="hier-select"
        value={value}
        disabled={vm.savingKey !== null}
        onChange={(event) => vm.chooseStatus(entry, event.target.value as QaRunItemStatus)}
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

function SeverityField({ draft, onChange }: Readonly<{ draft: QaItemDraft; onChange: (value: QaDefectSeverity | "") => void }>) {
  const required = statusNeedsSeverity(draft.status);
  return (
    <label className="hier-field qa-mine__field">
      <span className="hier-field-label">
        Severity{required ? <span className="qa-mine__required"> (required)</span> : null}
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

function saveLabel(entry: QaDeveloperItem, draft: QaItemDraft, saving: boolean): string {
  if (saving) return "Saving…";
  return draft.status === entry.item.status ? "Save" : `Mark ${itemStatusLabel(draft.status)}`;
}

function DetailsForm({ entry, vm }: Readonly<{ entry: QaDeveloperItem; vm: DeveloperItemEditorViewModel }>) {
  const draft = vm.draft;
  if (vm.openKey !== myItemKey(entry) || !draft) return null;
  const saving = vm.savingKey === myItemKey(entry);
  const defect = statusShowsDefect(draft.status);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.saveDraft(entry);
  }

  return (
    <form className="qa-mine__editor" onSubmit={handleSubmit} noValidate aria-label={`Record ${entry.item.title}`}>
      {defect ? <SeverityField draft={draft} onChange={(value) => vm.updateDraft({ defectSeverity: value })} /> : null}
      <label className="hier-field qa-mine__field">
        <span className="hier-field-label">Notes</span>
        <textarea
          className="hier-textarea"
          rows={2}
          value={draft.notes}
          disabled={saving}
          placeholder={defect ? "What went wrong" : "Anything worth knowing (optional)"}
          onChange={(event) => vm.updateDraft({ notes: event.target.value })}
        />
      </label>
      {defect ? (
        <label className="hier-field qa-mine__field">
          <span className="hier-field-label">Reproduction steps</span>
          <textarea
            className="hier-textarea"
            rows={3}
            value={draft.reproductionSteps}
            disabled={saving}
            onChange={(event) => vm.updateDraft({ reproductionSteps: event.target.value })}
          />
        </label>
      ) : null}
      {vm.draftError ? (
        <p className="qa-mine__error" role="alert">
          {vm.draftError}
        </p>
      ) : null}
      <div className="qa-mine__actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saveLabel(entry, draft, saving)}
        </button>
        <button type="button" className="ghost-button" disabled={saving} onClick={vm.closeDetails}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RowError({ entry, vm, onReload }: RowProps) {
  const error = vm.error;
  if (!error || error.key !== myItemKey(entry)) return null;
  return (
    <div className="qa-mine__alert" role="alert">
      <p>{error.message}</p>
      {error.stale ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            vm.dismissError();
            onReload();
          }}
        >
          Reload items
        </button>
      ) : (
        <button type="button" className="qa-mine__text-button" onClick={vm.dismissError}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function Controls({ entry, vm }: Readonly<{ entry: QaDeveloperItem; vm: DeveloperItemEditorViewModel }>) {
  const key = myItemKey(entry);
  const editing = vm.openKey === key;
  if (!entry.item.canUpdate) {
    return <p className="qa-mine__readonly">Read-only for your role</p>;
  }
  return (
    <div className="qa-mine__controls">
      <StatusControl entry={entry} vm={vm} />
      {editing ? null : (
        <button
          type="button"
          className="qa-mine__text-button"
          disabled={vm.savingKey !== null}
          onClick={() => vm.openDetails(entry)}
        >
          {entry.item.notes || entry.item.reproductionSteps ? "Edit notes" : "Add notes"}
        </button>
      )}
      {vm.savingKey === key && !editing ? (
        <span className="qa-mine__saving" role="status">
          Saving…
        </span>
      ) : null}
    </div>
  );
}

/** What was recorded against the item: severity (for a defect) and notes. */
function Recorded({ entry }: Readonly<{ entry: QaDeveloperItem }>) {
  const { item } = entry;
  const severity = statusShowsDefect(item.status) ? item.defectSeverity : null;
  if (!severity && !item.notes) return null;
  return (
    <div className="qa-mine__recorded">
      {severity ? <SeverityBadge severity={severity} /> : null}
      {item.notes ? <p>{item.notes}</p> : null}
    </div>
  );
}

/**
 * One developer item of the current uat run: what to check, what was
 * recorded, and — when the server allows this viewer — the same status
 * control QA Studio has. "Returned to dev" is never offered here.
 */
export function DeveloperItemRow({ entry, vm, onReload }: RowProps) {
  const { item } = entry;
  return (
    <li className="qa-mine__row">
      <div className="qa-mine__head">
        <span className="qa-mine__title">{item.title}</span>
        <StatusPill status={item.status} />
      </div>
      {item.description ? <p className="qa-mine__desc">{item.description}</p> : null}
      <div className="qa-mine__tags">
        <PersonaBadge persona={item.targetPersona} />
        <VerificationBadge type={item.verificationType} />
        {needsTestIdentifier(item.verificationType) && item.testIdentifier ? (
          <code className="qa-mine__test">{item.testIdentifier}</code>
        ) : null}
      </div>
      <p className="qa-returned__meta">
        <span>{entry.checklistName}</span>
        <VerifiedLine entry={entry} />
      </p>
      {vm.openKey === myItemKey(entry) ? null : <Recorded entry={entry} />}
      <Controls entry={entry} vm={vm} />
      <DetailsForm entry={entry} vm={vm} />
      <RowError entry={entry} vm={vm} onReload={onReload} />
    </li>
  );
}
