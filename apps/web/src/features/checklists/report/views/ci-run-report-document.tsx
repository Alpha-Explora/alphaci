"use client";

import type { StageResults } from "@/shared/api/contracts";

import { TonePill } from "../../items";
import {
  ciOverallLabel,
  ciOverallTone,
  ciShortSha,
  ciStageStatusLabel,
  ciStageTitle,
  ciStageTone,
  ciSummaryLine,
} from "../../model/ci-run-report-rules";
import type { CiRunReport, CiRunReportFailure, CiRunReportStage } from "../../model/ci-run-report-types";
import { formatReportDate } from "../../model/qa-report-rules";
import { Meta, ReportSection } from "./qa-report-document";

/* One pipeline execution as a printable sheet: what failed and how to fix it
 * first, then every stage with the figures it reported. The same fixed
 * template and print styling as the QA report; pure rendering of a
 * server-built `ci-run-report/v1`. */

function Masthead({ report }: Readonly<{ report: CiRunReport }>) {
  const tone = ciOverallTone(report.overallStatus);
  return (
    <header className="qa-report-masthead">
      <div className="qa-report-masthead__title">
        <p className="qa-report-masthead__eyebrow">ALPHACI · Pipeline</p>
        <h1>CI results</h1>
        <p className="qa-report-masthead__project">
          <span className="qa-report-masthead__name">{report.repoFullName}</span>
          <span className="qa-report-mono">
            {report.branch} @ {ciShortSha(report.commitSha)}
          </span>
        </p>
      </div>
      <div className={`qa-report-stamp qa-report-stamp--${tone}`}>
        <span className="qa-report-stamp__label">Result</span>
        <span className="qa-report-stamp__value">{ciOverallLabel(report.overallStatus)}</span>
      </div>
    </header>
  );
}

function MetaGrid({ report }: Readonly<{ report: CiRunReport }>) {
  return (
    <dl className="qa-report-meta">
      <Meta label="Repository">
        <span className="qa-report-mono">{report.repoFullName}</span>
      </Meta>
      <Meta label="Branch">
        <span className="qa-report-mono">{report.branch}</span>
      </Meta>
      <Meta label="Commit">
        <span className="qa-report-mono">{ciShortSha(report.commitSha)}</span>
      </Meta>
      <Meta label="Stages">{ciSummaryLine(report.summary)}</Meta>
      <Meta label="Started">{report.startedAt ? formatReportDate(report.startedAt) : "—"}</Meta>
      <Meta label="Generated">{formatReportDate(report.generatedAt)}</Meta>
    </dl>
  );
}

function FailureBlock({ failure }: Readonly<{ failure: CiRunReportFailure }>) {
  return (
    <article className="qa-report-defect qa-report-defect--major">
      <header className="qa-report-defect__head">
        <h3 className="qa-report-defect__title">{failure.title}</h3>
        <span className="qa-report-defect__tags">
          <TonePill tone="danger" label={ciStageTitle(failure.stage)} />
        </span>
      </header>
      <dl className="qa-report-defect__body">
        {failure.detail ? (
          <div>
            <dt>What happened</dt>
            <dd>
              <p className="qa-report-prose">{failure.detail}</p>
            </dd>
          </div>
        ) : null}
        {failure.hint ? (
          <div>
            <dt>How to fix it</dt>
            <dd>
              <p className="qa-report-prose">{failure.hint}</p>
            </dd>
          </div>
        ) : null}
        {failure.items.length > 0 ? (
          <div>
            <dt>Details ({failure.items.length})</dt>
            <dd>
              <ul className="qa-report-prose">
                {failure.items.map((item, index) => (
                  <li key={`${index}-${item.label}`}>
                    {item.label}
                    {item.sub ? <span className="qa-report-table__sub">{item.sub}</span> : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function Failures({ report }: Readonly<{ report: CiRunReport }>) {
  if (report.failures.length === 0) {
    return (
      <div className="qa-report-empty">
        <p className="qa-report-empty__title">No failed stages</p>
        <p>Nothing in this run needs fixing.</p>
      </div>
    );
  }
  return (
    <div className="qa-report-defects">
      {report.failures.map((failure, index) => (
        <FailureBlock key={`${failure.stage}-${index}-${failure.title}`} failure={failure} />
      ))}
    </div>
  );
}

function StagesTable({ report }: Readonly<{ report: CiRunReport }>) {
  return (
    <div className="qa-report-table-wrap">
      <table className="qa-report-table">
        <thead>
          <tr>
            <th scope="col">Stage</th>
            <th scope="col">Status</th>
            <th scope="col">Reported</th>
          </tr>
        </thead>
        <tbody>
          {report.stages.map((stage) => (
            <tr key={stage.stage}>
              <th scope="row">
                <span className="qa-report-table__title">{ciStageTitle(stage.stage)}</span>
              </th>
              <td>
                <TonePill tone={ciStageTone(stage.status)} label={ciStageStatusLabel(stage.status)} />
              </td>
              <td>
                {stage.reportedAt ? formatReportDate(stage.reportedAt) : <span className="qa-report-muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FigureLine {
  label: string;
  value: string;
}

function testsLine(results: StageResults): FigureLine[] {
  const { tests } = results;
  if (!tests) return [];
  const failed = tests.failed > 0 ? `, ${tests.failed} failed` : "";
  return [{ label: "Tests", value: `${tests.passed} / ${tests.total} passed${failed}` }];
}

function coverageLine(results: StageResults): FigureLine[] {
  const { coverage } = results;
  return coverage ? [{ label: "Coverage", value: `${coverage.pct}% (threshold ${coverage.threshold}%)` }] : [];
}

function lintLine(results: StageResults): FigureLine[] {
  const { lint } = results;
  return lint ? [{ label: "Lint", value: `${lint.errors} errors, ${lint.warnings} warnings` }] : [];
}

function securityLine(results: StageResults): FigureLine[] {
  const { security } = results;
  return security
    ? [{ label: "Dependency vulnerabilities", value: `${security.critical} critical, ${security.high} high` }]
    : [];
}

function findingsLine(results: StageResults): FigureLine[] {
  const { findings } = results;
  if (!findings) return [];
  const parts = [
    findings.secrets !== undefined ? `${findings.secrets} secrets` : null,
    findings.forbiddenLicenses !== undefined ? `${findings.forbiddenLicenses} forbidden licences` : null,
    findings.undeterminedLicenses !== undefined ? `${findings.undeterminedLicenses} undetermined licences` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? [{ label: "Findings", value: parts.join(", ") }] : [];
}

function sonarLine(results: StageResults): FigureLine[] {
  const { sonar } = results;
  return sonar ? [{ label: "Quality gate", value: sonar.gate ?? "—" }] : [];
}

/** The figures a stage reported, one line each. Empty when it reported none. */
function figureLines(results: StageResults | null): FigureLine[] {
  if (!results) return [];
  return [
    ...testsLine(results),
    ...coverageLine(results),
    ...lintLine(results),
    ...securityLine(results),
    ...findingsLine(results),
    ...sonarLine(results),
  ];
}

function FailedTests({ results }: Readonly<{ results: StageResults | null }>) {
  const failures = results?.tests?.failures ?? [];
  if (failures.length === 0) return null;
  return (
    <div className="qa-report-auto__failures">
      <h4 className="qa-report-auto__failures-title">Failed tests ({failures.length} listed)</h4>
      <ol className="qa-report-auto__list">
        {failures.map((failure, index) => (
          <li key={`${index}-${failure.name}`}>
            <code className="qa-report-auto__name">{failure.name}</code>
            {failure.message ? <p className="qa-report-auto__message">{failure.message}</p> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StageDetail({ stage }: Readonly<{ stage: CiRunReportStage }>) {
  const lines = figureLines(stage.results);
  return (
    <div className="qa-report-auto">
      <p className="qa-report-auto__lede">
        <strong>{ciStageTitle(stage.stage)}</strong> · {ciStageStatusLabel(stage.status)}
      </p>
      {lines.length > 0 ? (
        <dl className="qa-report-meta">
          {lines.map((line) => (
            <Meta key={line.label} label={line.label}>
              {line.value}
            </Meta>
          ))}
        </dl>
      ) : (
        <p className="qa-report-muted">No figures were reported for this stage.</p>
      )}
      <FailedTests results={stage.results} />
      {stage.checks.length > 0 ? (
        <div className="qa-report-table-wrap">
          <table className="qa-report-table">
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {stage.checks.map((check) => (
                <tr key={check.name}>
                  <td>{check.name}</td>
                  <td>{check.conclusion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** The fixed CI run template. */
export function CiRunReportDocument({ report }: Readonly<{ report: CiRunReport }>) {
  return (
    <article
      className={`qa-report-sheet qa-report qa-report--${ciOverallTone(report.overallStatus)}`}
      aria-label="CI results"
    >
      <Masthead report={report} />
      <MetaGrid report={report} />
      <ReportSection id="ci-report-failures" number="01" title="Failures">
        <Failures report={report} />
      </ReportSection>
      <ReportSection id="ci-report-stages" number="02" title="Stages">
        <StagesTable report={report} />
      </ReportSection>
      <ReportSection id="ci-report-details" number="03" title="Stage details">
        {report.stages.map((stage) => (
          <StageDetail key={stage.stage} stage={stage} />
        ))}
      </ReportSection>
      <footer className="qa-report-footer">
        <span>
          {report.repoFullName} · {report.branch} @ {ciShortSha(report.commitSha)} · {report.schemaVersion}
        </span>
        <span>Generated by ALPHACI · {formatReportDate(report.generatedAt)}</span>
      </footer>
    </article>
  );
}
