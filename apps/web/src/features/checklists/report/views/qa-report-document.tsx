"use client";

import type { ReactNode } from "react";

import { itemStatusLabel, shortSha } from "../../model/qa-run-rules";
import {
  actorLabel,
  commitSourceShortLabel,
  formatReportDate,
  percentFloor,
  reportStateLabel,
  reportVerdictLabel,
  reportVerdictTone,
  runStatusLabel,
  summaryBreakdown,
} from "../../model/qa-report-rules";
import type { QaReport } from "../../model/qa-report-types";
import { AutomatedResultsBody } from "./qa-report-automation";
import { ChecklistTable, DefectLog, SignoffRecord } from "./qa-report-sections";
import { LockIcon, PulseIcon } from "./report-icons";

/* ── Building blocks ─────────────────────────────────────────────────────── */

export function ReportSection({
  id,
  number,
  title,
  children,
}: Readonly<{ id: string; number: string; title: string; children: ReactNode }>) {
  return (
    <section className="qa-report-section" aria-labelledby={id}>
      <header className="qa-report-section__head">
        <span className="qa-report-section__num" aria-hidden="true">
          {number}
        </span>
        <h2 id={id} className="qa-report-section__title">
          {title}
        </h2>
      </header>
      {children}
    </section>
  );
}

function Meta({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="qa-report-meta__cell">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ── 1. Header and metadata ──────────────────────────────────────────────── */

function VerdictStamp({ report }: Readonly<{ report: QaReport }>) {
  const verdict = report.summary.verdict;
  return (
    <div className={`qa-report-stamp qa-report-stamp--${reportVerdictTone(verdict)}`}>
      <span className="qa-report-stamp__label">Verdict</span>
      <span className="qa-report-stamp__value">{reportVerdictLabel(verdict)}</span>
    </div>
  );
}

function Masthead({ report }: Readonly<{ report: QaReport }>) {
  const { project } = report;
  return (
    <header className="qa-report-masthead">
      <div className="qa-report-masthead__title">
        <p className="qa-report-masthead__eyebrow">ALPHACI · Quality assurance</p>
        <h1>QA Report</h1>
        <p className="qa-report-masthead__project">
          <span className="qa-report-masthead__name">{project.name}</span>
          <span className="qa-report-mono">{project.repoFullName}</span>
        </p>
      </div>
      <VerdictStamp report={report} />
    </header>
  );
}

function StateNote({ frozen }: Readonly<{ frozen: boolean }>) {
  return (
    <p className={`qa-report-state-note qa-report-state-note--${frozen ? "frozen" : "live"}`}>
      {frozen ? <LockIcon /> : <PulseIcon />}
      <strong>{reportStateLabel(frozen)}</strong>
      <span>
        {frozen
          ? "Results are the copy recorded when the run was signed off; later edits to the checklist are not reflected."
          : "Results can still change while the run is open. Export again before relying on this copy."}
      </span>
    </p>
  );
}

function MetaGrid({ report }: Readonly<{ report: QaReport }>) {
  const { run } = report;
  const signoff = run.signoff;
  return (
    <dl className="qa-report-meta">
      <Meta label="Branch">
        <span className="qa-report-mono">{run.branch}</span>
      </Meta>
      <Meta label="Commit">
        <span className="qa-report-mono">{shortSha(run.commitSha)}</span>
        <span className="qa-report-meta__aside">{commitSourceShortLabel(run.commitSource)}</span>
      </Meta>
      <Meta label="Checklist">
        {run.checklistName}
        <span className="qa-report-meta__aside">Version {run.checklistVersion}</span>
      </Meta>
      <Meta label="Run status">{runStatusLabel(run.status)}</Meta>
      <Meta label="Signed off by">
        {signoff ? (
          <>
            {actorLabel(signoff.signedBy)}
            <span className="qa-report-meta__aside">{formatReportDate(signoff.signedAt)}</span>
          </>
        ) : (
          <span className="qa-report-muted">Not signed off</span>
        )}
      </Meta>
      <Meta label="Generated">{formatReportDate(report.generatedAt)}</Meta>
    </dl>
  );
}

/* ── 2. Executive summary ────────────────────────────────────────────────── */

function CompletionBar({ report }: Readonly<{ report: QaReport }>) {
  const { summary } = report;
  const breakdown = summaryBreakdown(summary);
  const label = breakdown.length
    ? breakdown.map((entry) => `${entry.count} ${itemStatusLabel(entry.status).toLowerCase()}`).join(", ")
    : "No items";
  return (
    <>
      <div className="qa-report-bar" role="img" aria-label={label}>
        {breakdown.map((entry) => (
          <span
            key={entry.status}
            className={`qa-report-bar__segment qa-report-bar__segment--${entry.status}`}
            style={{ width: `${(entry.count / Math.max(1, summary.totalItems)) * 100}%` }}
          />
        ))}
      </div>
      <ul className="qa-report-legend" aria-hidden="true">
        {breakdown.map((entry) => (
          <li key={entry.status}>
            <span className={`qa-report-legend__swatch qa-report-bar__segment--${entry.status}`} />
            {itemStatusLabel(entry.status)} <strong>{entry.count}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function SummaryFact({ label, value, tone }: Readonly<{ label: string; value: number; tone: "danger" | "warning" }>) {
  return (
    <div className={`qa-report-fact${value > 0 ? ` qa-report-fact--${tone}` : ""}`}>
      <span className="qa-report-fact__value">{value}</span>
      <span className="qa-report-fact__label">{label}</span>
    </div>
  );
}

function ExecutiveSummary({ report }: Readonly<{ report: QaReport }>) {
  const { summary } = report;
  return (
    <ReportSection id="qa-report-summary" number="01" title="Executive summary">
      <div className="qa-report-summary">
        <div className="qa-report-summary__completion">
          <p className="qa-report-summary__label">Completion</p>
          <p className="qa-report-summary__figure">
            <span className="qa-report-summary__big">
              {summary.passed} / {summary.totalItems}
            </span>{" "}
            passed <span className="qa-report-summary__pct">({percentFloor(summary.passed, summary.totalItems)}%)</span>
          </p>
          <CompletionBar report={report} />
        </div>
        <div className="qa-report-summary__facts">
          <SummaryFact label="Open defects" value={summary.openDefects} tone="warning" />
          <SummaryFact label="Blockers" value={summary.blockers} tone="danger" />
        </div>
      </div>
    </ReportSection>
  );
}

/* ── 3. Automated results ────────────────────────────────────────────────── */

function AutomatedResults({ report }: Readonly<{ report: QaReport }>) {
  return (
    <ReportSection id="qa-report-automated" number="03" title="Automated results">
      <AutomatedResultsBody report={report} />
    </ReportSection>
  );
}

/* ── The document ────────────────────────────────────────────────────────── */

/** The fixed report template. Pure rendering of a server-built `qa-report/v1`. */
export function QaReportDocument({ report }: Readonly<{ report: QaReport }>) {
  return (
    <article
      className={`qa-report-sheet qa-report qa-report--${reportVerdictTone(report.summary.verdict)}`}
      aria-label="QA Report"
    >
      <Masthead report={report} />
      <StateNote frozen={report.frozen} />
      <MetaGrid report={report} />
      <ExecutiveSummary report={report} />
      <ReportSection id="qa-report-checklist" number="02" title="Checklist">
        <ChecklistTable items={report.run.items} />
      </ReportSection>
      <AutomatedResults report={report} />
      <ReportSection id="qa-report-defects" number="04" title="Defect log">
        <DefectLog defects={report.defects} />
      </ReportSection>
      <ReportSection id="qa-report-signoff" number="05" title="Sign-off">
        <SignoffRecord report={report} />
      </ReportSection>
      <footer className="qa-report-footer">
        <span>
          Run <span className="qa-report-mono">{report.run.id}</span> · {report.schemaVersion}
        </span>
        <span>
          Generated by ALPHACI · {formatReportDate(report.generatedAt)} · {report.frozen ? "Frozen at sign-off" : "Live"}
        </span>
      </footer>
    </article>
  );
}
