"use client";

import type { ReactNode } from "react";

import { repositoryHeadLabel } from "../../model/project-report-rules";
import type { QaProjectReport, QaProjectReportRepository } from "../../model/project-report-types";
import { actorLabel, formatReportDate, reportVerdictTone, runStatusLabel } from "../../model/qa-report-rules";
import { ExecutiveSummary, Meta, ReportSection, StateNote, VerdictStamp } from "./qa-report-document";
import { ProjectAutomatedResults, ProjectChecklistTable, type RenderItemEvidence } from "./project-report-sections";
import { DefectLog, SignoffRecord } from "./qa-report-sections";

function Masthead({ report }: Readonly<{ report: QaProjectReport }>) {
  return (
    <header className="qa-report-masthead">
      <div className="qa-report-masthead__title">
        <p className="qa-report-masthead__eyebrow">ALPHACI · Quality assurance</p>
        <h1>QA Report</h1>
        <p className="qa-report-masthead__project">
          <span className="qa-report-masthead__name">{report.project.name}</span>
          <span className="qa-report-mono">{report.repositories.length} repositories</span>
        </p>
      </div>
      <VerdictStamp report={report} />
    </header>
  );
}

function MetaGrid({ report }: Readonly<{ report: QaProjectReport }>) {
  const signoff = report.run.signoff;
  return (
    <dl className="qa-report-meta">
      <Meta label="Repositories">
        {report.repositories.map((repository) => (
          <span key={repository.projectId} className="qa-report-mono qa-report-meta__aside">
            {repositoryHeadLabel(repository)}
          </span>
        ))}
      </Meta>
      <Meta label="Branch">
        <span className="qa-report-mono">uat</span>
      </Meta>
      <Meta label="Run status">{runStatusLabel(report.run.status)}</Meta>
      <Meta label="Started by">
        {report.run.createdBy ? actorLabel(report.run.createdBy) : <span className="qa-report-muted">Unknown</span>}
        {report.run.createdAt ? (
          <span className="qa-report-meta__aside">{formatReportDate(report.run.createdAt)}</span>
        ) : null}
      </Meta>
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

/**
 * What the host draws for one repository's screenshots. The Project page owns
 * the screenshots (their storage, their images), so the report asks it rather
 * than reaching into it.
 */
export type RenderVisualEvidence = (repository: QaProjectReportRepository) => ReactNode;

/** An appendix: the screenshots are the branch's latest run, so they come after the signed record. */
function VisualEvidenceSection({
  report,
  render,
}: Readonly<{ report: QaProjectReport; render: RenderVisualEvidence }>) {
  return (
    <ReportSection id="qa-report-visual" number="06" title="Visual evidence">
      {report.repositories.map((repository) => (
        <div key={repository.projectId} className="qa-report-auto">
          <p className="qa-report-auto__lede">
            <strong>{repository.name}</strong>
          </p>
          {render(repository)}
        </div>
      ))}
    </ReportSection>
  );
}

/** The fixed Project report template. Pure rendering of a server-built `qa-report/v2`. */
export function ProjectQaReportDocument({
  report,
  renderVisualEvidence,
  renderItemEvidence,
}: Readonly<{
  report: QaProjectReport;
  renderVisualEvidence?: RenderVisualEvidence;
  /** Each item's own screenshots, under it in the checklist. The appendix above is separate. */
  renderItemEvidence?: RenderItemEvidence;
}>) {
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
        <ProjectChecklistTable items={report.run.items} renderItemEvidence={renderItemEvidence} />
      </ReportSection>
      <ReportSection id="qa-report-automated" number="03" title="Automated results">
        <ProjectAutomatedResults report={report} />
      </ReportSection>
      <ReportSection id="qa-report-defects" number="04" title="Defect log">
        <DefectLog defects={report.defects} />
      </ReportSection>
      <ReportSection id="qa-report-signoff" number="05" title="Sign-off">
        <SignoffRecord report={report} />
      </ReportSection>
      {renderVisualEvidence && report.repositories.length > 0 ? (
        <VisualEvidenceSection report={report} render={renderVisualEvidence} />
      ) : null}
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
