"use client";

import "./progress.css";

import { useId } from "react";

import { TonePill } from "../../items";
import { PROGRESS_VALUES, progressLabel, progressTone } from "../../model/requirement-rules";
import type { RequirementItem } from "../../model/requirement-types";
import type { ItemProgressViewModel } from "../view-models/use-item-progress-view-model";

/**
 * An item's Progress: a three-way segmented control (To do, In progress,
 * Done) for whoever may move it — Developers, Product owners, admins — and a
 * read-only pill for everyone else. Native radios, so arrow keys move between
 * the options and a screen reader announces the group.
 */
export function ProgressControl({
  item,
  editable,
  vm,
  onReload,
}: Readonly<{
  item: RequirementItem;
  editable: boolean;
  vm: ItemProgressViewModel;
  /** Offered when a write failed because someone else changed the item first. */
  onReload?: () => void;
}>) {
  const name = useId();
  const saving = vm.savingItemId === item.id;
  const error = vm.error?.itemId === item.id ? vm.error : null;
  if (!editable) {
    return <TonePill tone={progressTone(item.progress)} label={`Progress: ${progressLabel(item.progress)}`} />;
  }
  return (
    <div className="rq-progress-wrap">
      <fieldset className="rq-progress" disabled={vm.savingItemId !== null} aria-busy={saving}>
        <legend className="sr-only">Progress of {item.title}</legend>
        {PROGRESS_VALUES.map((value) => (
          <label key={value} className="rq-progress__option" data-tone={progressTone(value)}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={item.progress === value}
              onChange={() => void vm.setProgress(item, value)}
            />
            <span>{progressLabel(value)}</span>
          </label>
        ))}
      </fieldset>
      {saving ? (
        <span className="rq-progress__note" role="status">
          Saving…
        </span>
      ) : null}
      {vm.notifiedItemId === item.id ? (
        <span className="rq-progress__note" role="status">
          QA has been told this is ready.
        </span>
      ) : null}
      {error ? (
        <div className="rq-alert" role="alert">
          <p>{error.message}</p>
          {error.stale && onReload ? (
            <button type="button" className="ghost-button" onClick={onReload}>
              Reload
            </button>
          ) : (
            <button type="button" className="rq-link" onClick={vm.dismissError}>
              Dismiss
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
