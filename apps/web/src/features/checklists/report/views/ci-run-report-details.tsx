"use client";

import {
  hasSonarDetail,
  normalizeTestCases,
  sonarCondition,
  sonarGate,
  sonarIssueWhere,
  sonarMeasures,
  sonarSeverityLabel,
  testCaseMeta,
  testCaseName,
  testCaseStatusWord,
  type SonarResult,
} from "@/features/runs/test-report";
import type { StageResults, TestCase } from "@/shared/api/contracts";

import { Meta } from "./qa-report-document";

/* The printable CI report's two detailed blocks: every browser test, and what
 * SonarCloud said. Same wording as the Pipeline runs card, laid out with the
 * report's own print styles so they read on paper. */

function CaseDetail({ test }: Readonly<{ test: TestCase }>) {
  const meta = testCaseMeta(test);
  return (
    <li>
      <code className="qa-report-auto__name">{testCaseName(test)}</code>
      <span className="qa-report-table__sub">
        {testCaseStatusWord(test.status)}
        {meta ? ` · ${meta}` : ""}
      </span>
      {test.description ? <p className="qa-report-auto__message">What it checks: {test.description}</p> : null}
      {(test.notes ?? []).map((note, index) => (
        <p key={`${String(index)}-${note.type}`} className="qa-report-auto__message">
          {note.type === "visual" ? "Screenshot" : note.type.charAt(0).toUpperCase() + note.type.slice(1)}:{" "}
          {note.text}
        </p>
      ))}
      {test.steps ? (
        <ol className="qa-report-prose">
          {test.steps.map((step, index) => (
            <li key={`${String(index)}-${step.title}`}>
              {step.title}
              {step.failed ? " — failed" : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {test.error ? <pre className="qa-report-auto__message qa-report-mono">{test.error.message}</pre> : null}
      {test.error?.location ? <p className="qa-report-table__sub">at {test.error.location}</p> : null}
    </li>
  );
}

/**
 * Every browser test in a table, then the detail of each one worth reading:
 * a failure, a retry, or one that wrote a note. Null when the run carried no
 * per-test records, so the caller keeps its plain failure list.
 */
export function PrintTestCases({ results }: Readonly<{ results: StageResults | null }>) {
  const cases = normalizeTestCases(results?.tests?.cases);
  if (!cases || cases.length === 0) return null;
  const detailed = cases.filter((test) => test.status !== "passed" || Boolean(test.notes) || Boolean(test.description));
  return (
    <div className="qa-report-auto__failures">
      <h4 className="qa-report-auto__failures-title">
        Browser tests ({cases.length}
        {results?.tests?.total && results.tests.total > cases.length ? ` of ${String(results.tests.total)}` : ""})
      </h4>
      <div className="qa-report-table-wrap">
        <table className="qa-report-table">
          <thead>
            <tr>
              <th scope="col">Test</th>
              <th scope="col">Result</th>
              <th scope="col">Where</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((test, index) => (
              <tr key={`${String(index)}-${test.title}`}>
                <td>
                  <span className="qa-report-table__title">{testCaseName(test)}</span>
                </td>
                <td>{testCaseStatusWord(test.status)}</td>
                <td>
                  <span className="qa-report-table__sub">{testCaseMeta(test)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailed.length > 0 ? <ol className="qa-report-auto__list">{detailed.map((test, index) => <CaseDetail key={`${String(index)}-${test.title}`} test={test} />)}</ol> : null}
    </div>
  );
}

/** The gate, failed conditions in words, measures and issues on new code. */
export function PrintSonar({ sonar }: Readonly<{ sonar: SonarResult | undefined }>) {
  if (!hasSonarDetail(sonar)) return null;
  const gate = sonarGate(sonar);
  const measures = sonarMeasures(sonar.measures);
  const issues = sonar.issues ?? [];
  return (
    <div className="qa-report-auto__failures">
      <h4 className="qa-report-auto__failures-title">SonarCloud · {gate.label}</h4>
      {gate.blockedReason ? <p className="qa-report-auto__message">{gate.blockedReason}</p> : null}
      {(sonar.failedConditions ?? []).length > 0 ? (
        <ul className="qa-report-prose">
          {(sonar.failedConditions ?? []).map((condition, index) => (
            <li key={`${String(index)}-${condition.metric}`}>Failed: {sonarCondition(condition)}</li>
          ))}
        </ul>
      ) : null}
      {measures.length > 0 ? (
        <dl className="qa-report-meta">
          {measures.map((measure) => (
            <Meta key={measure.metric} label={measure.label}>
              {measure.value}
            </Meta>
          ))}
        </dl>
      ) : null}
      {issues.length > 0 ? (
        <ol className="qa-report-auto__list">
          {issues.map((issue, index) => (
            <li key={`${String(index)}-${issue.rule}`}>
              <p className="qa-report-auto__message">{issue.message}</p>
              <span className="qa-report-table__sub">
                {[sonarSeverityLabel(issue.severity), sonarIssueWhere(issue), issue.rule]
                  .filter((part): part is string => Boolean(part))
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
