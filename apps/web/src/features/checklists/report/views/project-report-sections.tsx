"use client";

import { Fragment, type ReactNode } from "react";

import { AutomatedBadge, StatusPill } from "../../items";
import { verificationTypeLabel } from "../../model/checklist-rules";
import { automatedCellNote, hasStageResults } from "../../model/qa-automation-rules";
import { repositoryHeadLabel } from "../../model/project-report-rules";
import type { QaProjectReport } from "../../model/project-report-types";
import type { ProjectQaRunItem } from "../../model/project-run-types";
import type { QaRunAutomationResult } from "../../model/qa-automation-types";
import { actorLabel } from "../../model/qa-report-rules";
import { kindCopy } from "../../model/requirement-rules";
import { AutomationTable } from "./qa-report-automation";

/* The Project report's own sections: its checklist carries the requirement each
 * item speaks for, and its automated results are per repository. Everything
 * else (summary, defects, sign-off) is the repository report's, reused. */

/** The Automated badge and its scope, for an item CI reported on. Nothing for a manual item. */
function AutomatedCell({ automated }: Readonly<{ automated: ProjectQaRunItem["automated"] }>) {
  if (!automated) return null;
  const scope = automatedCellNote(automated);
  return (
    <span className="qa-report-auto-cell">
      <AutomatedBadge status={automated.status} inferred={automated.inferred} />
      {scope ? <span className="qa-report-table__sub">{scope}</span> : null}
    </span>
  );
}

/** What the page draws under an item: its screenshots. */
export type RenderItemEvidence = (item: ProjectQaRunItem) => ReactNode;

/** The item's screenshots on a row of their own, under the item, across every column but the number. */
function EvidenceRow({ item, render }: Readonly<{ item: ProjectQaRunItem; render: RenderItemEvidence }>) {
  return (
    <tr className="qa-report-table__evidence">
      <td aria-hidden="true" />
      <td colSpan={5}>{render(item)}</td>
    </tr>
  );
}

function ItemRow({ item, withEvidence }: Readonly<{ item: ProjectQaRunItem; withEvidence?: boolean }>) {
  return (
    <tr data-evidence={withEvidence ? "true" : undefined}>
      <td className="qa-report-table__num">{item.position + 1}</td>
      <td>
        <span className="qa-report-table__title">{item.requirementName}</span>
        <span className="qa-report-table__sub">{kindCopy(item.requirementKind).singular}</span>
      </td>
      <td>
        <span className="qa-report-table__title">{item.title}</span>
        {item.acceptanceCriteria ? <span className="qa-report-table__sub">{item.acceptanceCriteria}</span> : null}
      </td>
      <td>
        {verificationTypeLabel(item.verificationType)}
        {item.testIdentifier ? <code className="qa-report-table__test">{item.testIdentifier}</code> : null}
      </td>
      <td>
        <StatusPill status={item.status} />
        {item.verifiedBy ? <span className="qa-report-table__sub">{actorLabel(item.verifiedBy)}</span> : null}
        <AutomatedCell automated={item.automated} />
      </td>
      <td>{item.notes ? <p className="qa-report-prose">{item.notes}</p> : <span className="qa-report-muted">—</span>}</td>
    </tr>
  );
}

/** Every item of the Project run, Features first then System requirements, as the server ordered them. */
export function ProjectChecklistTable({
  items,
  renderItemEvidence,
}: Readonly<{ items: ReadonlyArray<ProjectQaRunItem>; renderItemEvidence?: RenderItemEvidence }>) {
  if (items.length === 0) {
    return <p className="qa-report-muted">This run has no checklist items.</p>;
  }
  return (
    <div className="qa-report-table-wrap">
      <table className="qa-report-table">
        <colgroup>
          <col className="qa-report-table__col-num" />
          <col className="qa-report-table__col-persona" />
          <col className="qa-report-table__col-item" />
          <col className="qa-report-table__col-verify" />
          <col className="qa-report-table__col-status" />
          <col className="qa-report-table__col-notes" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Requirement</th>
            <th scope="col">Item</th>
            <th scope="col">Verification</th>
            <th scope="col">Status</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const withEvidence = Boolean(renderItemEvidence) && item.attachments.length > 0;
            return (
              <Fragment key={item.id}>
                <ItemRow item={item} withEvidence={withEvidence} />
                {withEvidence && renderItemEvidence ? <EvidenceRow item={item} render={renderItemEvidence} /> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One covered repository's CI results, on the head the run captured. */
function RepositoryResults({
  name,
  headLabel,
  automation,
}: Readonly<{
  name: string;
  headLabel: string;
  automation: QaRunAutomationResult;
}>) {
  return (
    <div className="qa-report-auto">
      <p className="qa-report-auto__lede">
        <strong>{name}</strong> · <span className="qa-report-mono">{headLabel}</span>
      </p>
      {hasStageResults(automation) ? (
        <AutomationTable automation={automation} />
      ) : (
        <p className="qa-report-muted">CI had not reported the verify or quality stage for this head.</p>
      )}
    </div>
  );
}

/**
 * CI's results for each repository the run covered, with each stage's
 * failures. "Not available yet" when the report carries no per-repository
 * breakdown — every report built before Project runs reported CI.
 */
export function ProjectAutomatedResults({
  report,
}: Readonly<{ report: Pick<QaProjectReport, "run" | "repositories"> }>) {
  const byRepository = report.run.automationByRepository;
  if (byRepository === null || byRepository.length === 0) {
    return (
      <div className="qa-report-empty">
        <p className="qa-report-empty__title">Not available yet</p>
        <p>No automated test results were collected for this report.</p>
      </div>
    );
  }
  return (
    <>
      {byRepository.map((entry) => {
        const repository = report.repositories.find((candidate) => candidate.projectId === entry.projectId);
        return (
          <RepositoryResults
            key={entry.projectId}
            name={repository?.name ?? entry.repoFullName}
            headLabel={repository ? repositoryHeadLabel(repository) : entry.repoFullName}
            automation={entry.automation}
          />
        );
      })}
    </>
  );
}
