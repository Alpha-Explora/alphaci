"use client";

import { type FormEvent } from "react";

import { SeverityBadge, StatusPill } from "../../items";
import { QaFindings } from "../../returned";
import { groupRunItems } from "../../model/project-run-rules";
import type { ProjectQaRun, ProjectQaRunItem } from "../../model/project-run-types";
import { agoLabel, QA_SEVERITIES, severityLabel } from "../../model/qa-run-rules";
import type { QaDefectSeverity } from "../../model/qa-run-types";
import { kindCopy } from "../../model/requirement-rules";
import type { PoAcceptanceViewModel } from "../view-models/use-po-acceptance-view-model";
import type { RunTestCasesViewModel } from "../view-models/use-run-test-cases-view-model";
import { RunTestCases } from "./run-test-cases";

type ItemProps = Readonly<{
  item: ProjectQaRunItem;
  acceptance: PoAcceptanceViewModel;
  testCases: RunTestCasesViewModel;
  onReload: () => void;
}>;

/** "2 of 3 passed by you", over the Product owner's own decisions. */
export function poPassedLabel(items: ReadonlyArray<Pick<ProjectQaRunItem, "poAcceptance">>): string {
  const passed = items.filter((item) => item.poAcceptance.status === "passed").length;
  return `${String(passed)} of ${String(items.length)} passed by you`;
}

function AcceptedLine({ item }: Readonly<{ item: ProjectQaRunItem }>) {
  const accepted = item.poAcceptance;
  if (accepted.status !== "passed") return null;
  const ago = agoLabel(accepted.acceptedAt);
  return (
    <p className="po-check__by">
      Passed by <strong>@{accepted.acceptedBy?.login ?? "a Product owner"}</strong>
      {ago ? ` · ${ago}` : ""}
    </p>
  );
}

/** Passed (yours), or Pass and Fail while it waits for you. Nothing before QA signs off. */
function Decision({ item, acceptance }: Pick<ItemProps, "item" | "acceptance">) {
  if (item.poAcceptance.status === "passed") {
    return <span className="po-check__accepted">Passed</span>;
  }
  if (!acceptance.canAccept || item.rowVersion === null) return null;
  const busy = acceptance.busyItemId !== null;
  const failing = acceptance.failing?.itemId === item.id;
  return (
    <span className="po-check__decide" role="group" aria-label={`Your decision on ${item.title}`}>
      <button
        type="button"
        className="po-check__pass"
        disabled={busy || failing}
        onClick={() => void acceptance.pass(item)}
      >
        {acceptance.busyItemId === item.id ? "Saving…" : "Pass"}
      </button>
      <button
        type="button"
        className="po-check__fail"
        disabled={busy || failing}
        onClick={() => acceptance.openFail(item)}
      >
        Fail
      </button>
    </span>
  );
}

function FailForm({ item, acceptance }: Pick<ItemProps, "item" | "acceptance">) {
  const draft = acceptance.failing;
  if (!draft || draft.itemId !== item.id) return null;
  const saving = acceptance.busyItemId === item.id;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void acceptance.submitFail(item);
  }

  return (
    <form className="po-check__fail-form" aria-label={`Fail ${item.title}`} onSubmit={handleSubmit} noValidate>
      <label className="hier-field">
        <span className="hier-field-label">What is wrong</span>
        <textarea
          className="hier-textarea"
          rows={3}
          value={draft.notes}
          disabled={saving}
          autoFocus
          aria-required="true"
          placeholder="The profile does not show in the header after logging in"
          onChange={(event) => acceptance.updateFail({ notes: event.target.value })}
        />
      </label>
      <label className="hier-field po-check__severity">
        <span className="hier-field-label">Severity</span>
        <select
          className="hier-select"
          value={draft.severity}
          disabled={saving}
          onChange={(event) => acceptance.updateFail({ severity: event.target.value as QaDefectSeverity })}
        >
          {QA_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {severityLabel(severity)}
            </option>
          ))}
        </select>
      </label>
      <p className="po-check__fail-note">
        Failing reopens the QA run and sends this story back to the Developers. The QA Team and the Developers are
        notified, and QA checks it again once it is fixed.
      </p>
      {acceptance.failError ? (
        <p className="qa-form-error" role="alert">
          {acceptance.failError}
        </p>
      ) : null}
      <div className="po-check__fail-actions">
        <button type="submit" className="po-check__fail-submit" disabled={saving}>
          {saving ? "Sending back…" : "Fail and return to Development"}
        </button>
        <button type="button" className="ghost-button" disabled={saving} onClick={acceptance.cancelFail}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ItemError({ item, acceptance, onReload }: Pick<ItemProps, "item" | "acceptance" | "onReload">) {
  const error = acceptance.error;
  if (!error || error.itemId !== item.id) return null;
  return (
    <div className="qa-inline-alert" role="alert">
      <p>{error.message}</p>
      {error.stale ? (
        <button type="button" className="ghost-button" onClick={onReload}>
          Reload run
        </button>
      ) : (
        <button type="button" className="qa-text-button" onClick={acceptance.dismissError}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function CheckItem({ item, acceptance, testCases, onReload }: ItemProps) {
  return (
    <li className="po-check__item" data-status={item.status} data-accepted={item.poAcceptance.status}>
      <div className="po-check__item-head">
        <span className="po-check__title">{item.title}</span>
        <span className="po-check__qa">
          {item.defectSeverity ? <SeverityBadge severity={item.defectSeverity} /> : null}
          <StatusPill status={item.status} />
        </span>
      </div>
      {item.acceptanceCriteria ? (
        <details className="pqa-criteria">
          <summary className="pqa-criteria__label">Acceptance criteria</summary>
          <p>{item.acceptanceCriteria}</p>
        </details>
      ) : null}
      {/* QA's test cases and results, read-only for the Product owner. */}
      <RunTestCases item={item} vm={testCases} onReload={onReload} canEditDefinitions={false} />
      <QaFindings runItem={item} />
      <div className="po-check__foot">
        <AcceptedLine item={item} />
        <Decision item={item} acceptance={acceptance} />
      </div>
      <FailForm item={item} acceptance={acceptance} />
      <ItemError item={item} acceptance={acceptance} onReload={onReload} />
    </li>
  );
}

/**
 * The Product owner's checklist in PO Studio: every item QA verified,
 * grouped by Feature, with QA's verdict and test cases (read-only). Once QA
 * signed the run off, each item gets Pass, or Fail with what is wrong, which
 * reopens the run and returns the story to the Developers. Merge to main
 * waits until every item is passed here.
 */
export function PoRunItems({
  run,
  acceptance,
  testCases,
  onReload,
}: Readonly<{
  run: ProjectQaRun;
  acceptance: PoAcceptanceViewModel;
  testCases: RunTestCasesViewModel;
  onReload: () => void;
}>) {
  if (run.items.length === 0) return null;
  const groups = groupRunItems(run.items);
  return (
    <section className="po-check" aria-label="Your check">
      <p className="po-check__head">
        <span className="qa-toolbar__label">Your check</span>
        <span className="po-check__count">{poPassedLabel(run.items)}</span>
      </p>
      {groups.map((group) => (
        <section
          key={group.key}
          className="po-check__group"
          aria-label={`${kindCopy(group.kind).singular} ${group.requirementName}`}
        >
          <p className="po-check__group-head">
            <span className="pqa-kind" data-kind={group.kind}>
              {kindCopy(group.kind).singular}
            </span>
            <span className="po-check__name">{group.requirementName}</span>
            <span className="po-check__passed">{poPassedLabel(group.items)}</span>
          </p>
          <ol className="po-check__items">
            {group.items.map((item) => (
              <CheckItem key={item.id} item={item} acceptance={acceptance} testCases={testCases} onReload={onReload} />
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}
