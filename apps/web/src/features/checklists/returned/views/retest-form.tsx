"use client";

import "./returned.css";

import type { FormEvent } from "react";

import {
  retestKey,
  type RequestRetestViewModel,
  type RetestTarget,
} from "../view-models/use-request-retest-view-model";

/**
 * "Mark fixed & request re-test": a button until pressed, then an optional
 * note to QA and one request. The caller only renders it where the viewer may
 * ask — this component never decides that.
 */
export function RetestForm({
  vm,
  target,
  itemTitle,
}: Readonly<{ vm: RequestRetestViewModel; target: RetestTarget; itemTitle: string }>) {
  const key = retestKey(target);
  const open = vm.openKey === key;
  const submitting = open && vm.status === "submitting";

  if (!open) {
    return (
      <button
        type="button"
        className="ghost-button qa-retest__trigger"
        disabled={vm.status === "submitting"}
        onClick={() => vm.open(target)}
      >
        Mark fixed &amp; request re-test
      </button>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.submit(target);
  }

  const noteId = `qa-retest-note-${key}`;
  return (
    <form className="qa-retest" onSubmit={handleSubmit} aria-label={`Request a re-test of ${itemTitle}`}>
      <label className="hier-field qa-retest__field" htmlFor={noteId}>
        <span className="hier-field-label">Note to QA (optional)</span>
        <textarea
          id={noteId}
          className="hier-textarea qa-retest__note"
          rows={2}
          value={vm.note}
          disabled={submitting}
          placeholder="What you changed and where to look"
          onChange={(event) => vm.setNote(event.target.value)}
        />
      </label>
      {vm.error ? (
        <p className="qa-retest__error" role="alert">
          {vm.error.message}
        </p>
      ) : null}
      <div className="qa-retest__actions">
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Requesting…" : "Request re-test"}
        </button>
        <button type="button" className="ghost-button" disabled={submitting} onClick={vm.cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
