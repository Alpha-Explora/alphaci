"use client";

import type { FormEvent } from "react";

import { SeverityBadge, StatusPill, VerificationBadge } from "../../items";
import { ProgressControl, QaFindings, type ItemProgressViewModel } from "../../returned";
import {
  needsTestIdentifier,
  testIdentifierPlaceholder,
  VERIFICATION_TYPE_OPTIONS,
} from "../../model/checklist-rules";
import type { ChecklistVerificationType } from "../../model/checklist-types";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import { agoLabel } from "../../model/qa-run-rules";
import { ACCEPTANCE_CRITERIA_MAX, REQUIREMENT_ITEM_TITLE_MAX } from "../../model/requirement-rules";
import type { RequirementItem, RequirementItemDraft } from "../../model/requirement-types";
import type { RequirementItemsViewModel } from "../view-models/use-requirement-items-view-model";
import { ArrowDownIcon, ArrowUpIcon } from "./requirement-icons";

/** Add or edit one story / item, in place. */
export function ItemForm({
  vm,
  itemLabel,
  submitLabel,
}: Readonly<{ vm: RequirementItemsViewModel; itemLabel: string; submitLabel: string }>) {
  const saving = vm.status === "saving";
  const draft = vm.draft;
  const formError = vm.error && (vm.editing?.mode === "add" ? vm.error.itemId === null : vm.error.itemId !== null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.submit();
  }

  function set(patch: Partial<RequirementItemDraft>) {
    vm.updateDraft(patch);
  }

  return (
    <form className="rq-item-form" onSubmit={handleSubmit} noValidate>
      <label className="hier-field">
        <span className="hier-field-label">{itemLabel}</span>
        <input
          className="hier-input"
          value={draft.title}
          maxLength={REQUIREMENT_ITEM_TITLE_MAX + 20}
          disabled={saving}
          placeholder={
            itemLabel === "User story"
              ? "As a shopper, I can pay with a saved card"
              : "Every endpoint rejects requests without a session"
          }
          onChange={(event) => set({ title: event.target.value })}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Acceptance criteria (optional)</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={draft.acceptanceCriteria}
          maxLength={ACCEPTANCE_CRITERIA_MAX + 100}
          disabled={saving}
          placeholder={"Given a saved card\nWhen I pay\nThen the order is confirmed"}
          onChange={(event) => set({ acceptanceCriteria: event.target.value })}
        />
      </label>
      <div className="rq-item-form__row">
        <label className="hier-field">
          <span className="hier-field-label">How QA verifies it</span>
          <select
            className="hier-select"
            value={draft.verificationType}
            disabled={saving}
            onChange={(event) => set({ verificationType: event.target.value as ChecklistVerificationType })}
          >
            {VERIFICATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {needsTestIdentifier(draft.verificationType) ? (
          <label className="hier-field">
            <span className="hier-field-label">Test</span>
            <input
              className="hier-input"
              value={draft.testIdentifier}
              disabled={saving}
              placeholder={testIdentifierPlaceholder(draft.verificationType)}
              onChange={(event) => set({ testIdentifier: event.target.value })}
            />
          </label>
        ) : null}
      </div>
      {vm.validationError ? (
        <p className="rq-form-error" role="alert">
          {vm.validationError}
        </p>
      ) : null}
      {formError && vm.error ? (
        <p className="rq-form-error" role="alert">
          {vm.error.message}
        </p>
      ) : null}
      <div className="rq-item-form__actions">
        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="ghost-button" disabled={saving} onClick={vm.cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ManageActions({
  item,
  index,
  count,
  vm,
}: Readonly<{ item: RequirementItem; index: number; count: number; vm: RequirementItemsViewModel }>) {
  const busy = vm.status === "saving";
  if (vm.confirmDeleteId === item.id) {
    return (
      <span className="rq-item__actions" role="group" aria-label={`Delete ${item.title}?`}>
        <span className="rq-item__confirm">Delete it? QA testing under way keeps its copy.</span>
        <button type="button" className="hier-btn-danger" disabled={busy} onClick={() => void vm.confirmDelete(item)}>
          {busy && vm.busyItemId === item.id ? "Deleting…" : "Delete"}
        </button>
        <button type="button" className="rq-link" disabled={busy} onClick={vm.cancelDelete}>
          Keep it
        </button>
      </span>
    );
  }
  return (
    <span className="rq-item__actions">
      <button
        type="button"
        className="rq-icon-button"
        disabled={busy || index === 0}
        onClick={() => void vm.move(item, -1)}
        aria-label={`Move ${item.title} up`}
        title="Move up"
      >
        <ArrowUpIcon />
      </button>
      <button
        type="button"
        className="rq-icon-button"
        disabled={busy || index === count - 1}
        onClick={() => void vm.move(item, 1)}
        aria-label={`Move ${item.title} down`}
        title="Move down"
      >
        <ArrowDownIcon />
      </button>
      <button type="button" className="rq-link" disabled={busy} onClick={() => vm.startEdit(item)}>
        Edit
      </button>
      <button type="button" className="rq-link rq-link--danger" disabled={busy} onClick={() => vm.askDelete(item)}>
        Delete
      </button>
    </span>
  );
}

function ProgressBy({ item }: Readonly<{ item: RequirementItem }>) {
  if (!item.progressBy) return null;
  const ago = agoLabel(item.progressAt);
  return (
    <span className="rq-item__by">
      by @{item.progressBy.login}
      {ago ? ` · ${ago}` : ""}
    </span>
  );
}

function isEditing(vm: RequirementItemsViewModel, itemId: string): boolean {
  return vm.editing?.mode === "edit" && vm.editing.itemId === itemId;
}

/** A failed write on this row (not one from its open form). */
function RowError({
  vm,
  itemId,
  onReload,
}: Readonly<{ vm: RequirementItemsViewModel; itemId: string; onReload: () => void }>) {
  const error = vm.error;
  if (!error || error.itemId !== itemId) return null;
  return (
    <div className="rq-alert" role="alert">
      <p>{error.message}</p>
      {error.stale ? (
        <button type="button" className="ghost-button" onClick={onReload}>
          Reload
        </button>
      ) : (
        <button type="button" className="rq-link" onClick={vm.dismissError}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function ItemFoot({
  item,
  editable,
  progress,
  onReload,
}: Readonly<{ item: RequirementItem; editable: boolean; progress: ItemProgressViewModel; onReload: () => void }>) {
  return (
    <div className="rq-item__foot">
      <VerificationBadge type={item.verificationType} />
      {needsTestIdentifier(item.verificationType) && item.testIdentifier ? (
        <code className="rq-item__test">{item.testIdentifier}</code>
      ) : null}
      <span className="rq-item__spacer" aria-hidden="true" />
      <span className="rq-item__progress-meta">
        <ProgressControl item={item} editable={editable} vm={progress} onReload={onReload} />
        <ProgressBy item={item} />
      </span>
    </div>
  );
}

/**
 * QA's verdict on the item, beside its title: nothing while it is pending
 * (QA has not looked), and how bad it is when QA failed it or sent it back.
 */
function Verdict({ verdict }: Readonly<{ verdict: ProjectQaRunItem | undefined }>) {
  if (!verdict || verdict.status === "pending") return null;
  return (
    <span className="rq-item__verdict">
      {verdict.defectSeverity ? <SeverityBadge severity={verdict.defectSeverity} /> : null}
      <StatusPill status={verdict.status} />
    </span>
  );
}

/**
 * One story or item: what it is, how QA knows it is done, and its Progress.
 * Developers get the Progress control and nothing else; Product owners and
 * admins also edit, reorder and delete it. Given QA's `verdict` (the
 * Project checklist), it shows that too, with QA's notes when the item
 * was sent back, failed or blocked.
 */
export function RequirementItemRow({
  item,
  index,
  count,
  itemLabel,
  canManage,
  progressEditable,
  items,
  progress,
  onReload,
  verdict,
}: Readonly<{
  item: RequirementItem;
  index: number;
  count: number;
  itemLabel: string;
  canManage: boolean;
  progressEditable: boolean;
  items: RequirementItemsViewModel;
  progress: ItemProgressViewModel;
  onReload: () => void;
  verdict?: ProjectQaRunItem;
}>) {
  if (isEditing(items, item.id)) {
    return (
      <li className="rq-item rq-item--editing">
        <ItemForm vm={items} itemLabel={itemLabel} submitLabel="Save" />
      </li>
    );
  }
  return (
    <li className="rq-item" data-progress={item.progress} data-verdict={verdict?.status}>
      <span className="rq-item__index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="rq-item__body">
        <div className="rq-item__head">
          <span className="rq-item__title">{item.title}</span>
          <Verdict verdict={verdict} />
          {canManage ? <ManageActions item={item} index={index} count={count} vm={items} /> : null}
        </div>
        {item.acceptanceCriteria ? <p className="rq-item__criteria">{item.acceptanceCriteria}</p> : null}
        <QaFindings runItem={verdict} />
        <ItemFoot item={item} editable={progressEditable} progress={progress} onReload={onReload} />
        <RowError vm={items} itemId={item.id} onReload={onReload} />
      </div>
    </li>
  );
}
