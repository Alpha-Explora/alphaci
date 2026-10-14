"use client";

import { AutomatedBadge, TonePill } from "../../items";
import {
  automatedCellNote,
  automationStages,
  hasStageResults,
  listedFailures,
  normalizeAutomatedResult,
  normalizeRunAutomation,
  stageCoverage,
  stageName,
  stageRunLabel,
  stageRunTone,
  unlistedFailuresNote,
} from "../../model/qa-automation-rules";
import type {
  QaAutomationStage,
  QaRunAutomationResult,
  QaStageResult,
  QaStageTests,
} from "../../model/qa-automation-types";
import { formatReportDate } from "../../model/qa-report-rules";
import type { QaReport } from "../../model/qa-report-types";
import { commitLabel } from "../../model/qa-run-rules";
import type { QaRunItem } from "../../model/qa-run-types";

/* ── Checklist table: the item's automated result beside its status ─────── */

/** The Automated badge and its scope, for an item CI reported on. Nothing for a manual item. */
export function ItemAutomatedCell({ item }: Readonly<{ item: QaRunItem }>) {
  const result = normalizeAutomatedResult(item.automated);
  if (!result) return null;
  const scope = automatedCellNote(result);
  return (
    <span className="qa-report-auto-cell">
      <AutomatedBadge status={result.status} inferred={result.inferred} />
      {scope ? <span className="qa-report-table__sub">{scope}</span> : null}
    </span>
  );
}

/* ── Section 03: automated results ───────────────────────────────────────── */

function testsCell(tests: QaStageTests | null) {
  if (!tests || tests.passed === null || tests.total === null) {
    return <span className="qa-report-muted">—</span>;
  }
  return (
    <>
      <span className="qa-report-auto__count">
        {tests.passed} / {tests.total}
      </span>
      {tests.failed ? <span className="qa-report-table__sub qa-report-auto__failed">{tests.failed} failed</span> : null}
    </>
  );
}

function StageRow({ stage, result }: Readonly<{ stage: QaAutomationStage; result: QaStageResult | null }>) {
  return (
    <tr>
      <th scope="row">
        <span className="qa-report-table__title">{stageName(stage)}</span>
        <span className="qa-report-table__sub">{stageCoverage(stage)}</span>
      </th>
      <td>
        {result ? (
          <TonePill tone={stageRunTone(result.status)} label={stageRunLabel(result.status)} />
        ) : (
          <span className="qa-report-muted">Not reported</span>
        )}
      </td>
      <td>{testsCell(result?.tests ?? null)}</td>
      <td>{result?.reportedAt ? formatReportDate(result.reportedAt) : <span className="qa-report-muted">—</span>}</td>
    </tr>
  );
}

function StageFailures({ result }: Readonly<{ result: QaStageResult }>) {
  const failures = listedFailures(result.tests);
  const note = unlistedFailuresNote(result.tests);
  if (failures.length === 0 && !note) return null;
  return (
    <div className="qa-report-auto__failures">
      <h3 className="qa-report-auto__failures-title">
        {stageName(result.stage)} failures{failures.length > 0 ? ` (${failures.length} listed)` : ""}
      </h3>
      {failures.length > 0 ? (
        <ol className="qa-report-auto__list">
          {failures.map((failure, index) => (
            <li key={`${index}-${failure.name}`}>
              <code className="qa-report-auto__name">{failure.name}</code>
              {failure.message ? <p className="qa-report-auto__message">{failure.message}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {note ? <p className="qa-report-auto__note">{note}</p> : null}
    </div>
  );
}

function NotCollected() {
  return (
    <div className="qa-report-empty">
      <p className="qa-report-empty__title">Not available yet</p>
      <p>
        No automated test results were collected for this report. Items verified by Playwright, unit
        tests or Bruno are recorded in the checklist above with the result the tester entered.
      </p>
    </div>
  );
}

/**
 * CI's results for the run's commit, per stage, with each stage's failures.
 * "Not available yet" when the report carries none — including every report
 * built before automation existed, where the field is absent altogether.
 */
export function AutomatedResultsBody({ report }: Readonly<{ report: QaReport }>) {
  if (report.automatedResults === null || report.automatedResults === undefined) return <NotCollected />;
  const automation = normalizeRunAutomation(report.automatedResults);
  const where = commitLabel(report.run.branch, report.run.commitSha);
  if (!hasStageResults(automation)) {
    return (
      <div className="qa-report-empty">
        <p className="qa-report-empty__title">No results reported</p>
        <p>CI had not reported the verify or quality stage for {where} when this report was generated.</p>
      </div>
    );
  }
  return (
    <div className="qa-report-auto">
      <p className="qa-report-auto__lede">
        From CI for <span className="qa-report-mono">{where}</span>. Informational — each item&apos;s status in the
        checklist is the result the tester recorded.
      </p>
      <AutomationTable automation={automation} />
    </div>
  );
}

/** The stage-by-stage table for one set of CI results, then each stage's listed failures. */
export function AutomationTable({ automation }: Readonly<{ automation: QaRunAutomationResult }>) {
  const stages = automationStages(automation);
  return (
    <>
      <div className="qa-report-table-wrap">
        <table className="qa-report-table qa-report-auto__table">
          <colgroup>
            <col className="qa-report-auto__col-stage" />
            <col className="qa-report-auto__col-status" />
            <col className="qa-report-auto__col-tests" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Status</th>
              <th scope="col">Tests passed</th>
              <th scope="col">Reported</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(({ stage, result }) => (
              <StageRow key={stage} stage={stage} result={result} />
            ))}
          </tbody>
        </table>
      </div>
      {stages.map(({ stage, result }) => (result ? <StageFailures key={stage} result={result} /> : null))}
    </>
  );
}
