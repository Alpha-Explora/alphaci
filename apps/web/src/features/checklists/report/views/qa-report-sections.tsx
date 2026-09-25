"use client";

import { SeverityBadge, StatusPill, VerdictPill } from "../../items";
import { targetPersonaLabel, verificationTypeLabel } from "../../model/checklist-rules";
import {
  actorLabel,
  formatReportDate,
  orderedItems,
  previousSignoffs,
  reportSeverityLabel,
} from "../../model/qa-report-rules";
import type { QaReport, QaReportDefect, QaReportSignoffEntry } from "../../model/qa-report-types";
import type { QaDefectSeverity, QaFixRequest, QaRunItem } from "../../model/qa-run-types";

/* ── Shared ──────────────────────────────────────────────────────────────── */

/** A severity badge, or a neutral "Unrated" for a defect filed without one. */
function Severity({ severity }: Readonly<{ severity: QaDefectSeverity | null }>) {
  if (severity) return <SeverityBadge severity={severity} />;
  return (
    <span className="qa-severity">
      <span className="sr-only">Severity: </span>
      {reportSeverityLabel(null)}
    </span>
  );
}

/** Multi-line text with its line breaks kept (repro steps, notes, conditions). */
function Prose({ text, className = "" }: Readonly<{ text: string; className?: string }>) {
  return <p className={`qa-report-prose ${className}`.trim()}>{text}</p>;
}

/* ── 3. Checklist table ──────────────────────────────────────────────────── */

function ItemRow({ item }: Readonly<{ item: QaRunItem }>) {
  return (
    <tr>
      <td className="qa-report-table__num">{item.position + 1}</td>
      <td>
        <span className="qa-report-table__title">{item.title}</span>
        {item.description ? <span className="qa-report-table__sub">{item.description}</span> : null}
      </td>
      <td>{targetPersonaLabel(item.targetPersona)}</td>
      <td>
        {verificationTypeLabel(item.verificationType)}
        {item.testIdentifier ? (
          <code className="qa-report-table__test">{item.testIdentifier}</code>
        ) : null}
      </td>
      <td>
        <StatusPill status={item.status} />
        {item.verifiedBy ? <span className="qa-report-table__sub">{actorLabel(item.verifiedBy)}</span> : null}
      </td>
      <td>
        {item.defectSeverity ? <Severity severity={item.defectSeverity} /> : null}
        {item.notes ? <Prose text={item.notes} /> : null}
        {!item.notes && !item.defectSeverity ? <span className="qa-report-muted">—</span> : null}
      </td>
    </tr>
  );
}

export function ChecklistTable({ items }: Readonly<{ items: ReadonlyArray<QaRunItem> }>) {
  if (items.length === 0) {
    return <p className="qa-report-muted">This run has no checklist items.</p>;
  }
  return (
    <div className="qa-report-table-wrap">
      <table className="qa-report-table">
        <colgroup>
          <col className="qa-report-table__col-num" />
          <col className="qa-report-table__col-item" />
          <col className="qa-report-table__col-persona" />
          <col className="qa-report-table__col-verify" />
          <col className="qa-report-table__col-status" />
          <col className="qa-report-table__col-notes" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Item</th>
            <th scope="col">Persona</th>
            <th scope="col">Verification</th>
            <th scope="col">Status</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {orderedItems(items).map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 5. Defect log ───────────────────────────────────────────────────────── */

function FixRequest({ fix }: Readonly<{ fix: QaFixRequest | null }>) {
  if (!fix) return <span className="qa-report-muted">Not requested yet</span>;
  return (
    <>
      Re-test requested by {actorLabel(fix.requestedBy)} · {formatReportDate(fix.requestedAt)}
      {fix.note ? <Prose text={fix.note} className="qa-report-prose--quote" /> : null}
    </>
  );
}

function DefectBlock({ defect }: Readonly<{ defect: QaReportDefect }>) {
  return (
    <article className={`qa-report-defect qa-report-defect--${defect.severity ?? "unrated"}`}>
      <header className="qa-report-defect__head">
        <h3 className="qa-report-defect__title">
          <span className="qa-report-defect__num">#{defect.position + 1}</span> {defect.title}
        </h3>
        <span className="qa-report-defect__tags">
          <Severity severity={defect.severity} />
          <StatusPill status={defect.status} />
        </span>
      </header>
      <dl className="qa-report-defect__body">
        <div>
          <dt>Persona</dt>
          <dd>{targetPersonaLabel(defect.targetPersona)}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{defect.notes ? <Prose text={defect.notes} /> : <span className="qa-report-muted">None</span>}</dd>
        </div>
        <div>
          <dt>Reproduction steps</dt>
          <dd>
            {defect.reproductionSteps ? (
              <Prose text={defect.reproductionSteps} className="qa-report-prose--steps" />
            ) : (
              <span className="qa-report-muted">None recorded</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Fix request</dt>
          <dd>
            <FixRequest fix={defect.fixRequest} />
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function DefectLog({ defects }: Readonly<{ defects: ReadonlyArray<QaReportDefect> }>) {
  if (defects.length === 0) {
    return (
      <div className="qa-report-empty">
        <p className="qa-report-empty__title">No open defects</p>
        <p>No item on this run is failed, blocked or returned to dev.</p>
      </div>
    );
  }
  // Already ordered by the server: severity first, then checklist position.
  return (
    <div className="qa-report-defects">
      {defects.map((defect) => (
        <DefectBlock key={`${defect.position}-${defect.title}`} defect={defect} />
      ))}
    </div>
  );
}

/* ── 6. Sign-off ─────────────────────────────────────────────────────────── */

function SignoffText({ entry }: Readonly<{ entry: Pick<QaReportSignoffEntry, "summary" | "conditions"> }>) {
  return (
    <>
      {entry.summary ? <Prose text={entry.summary} /> : null}
      {entry.conditions ? (
        <div className="qa-report-conditions">
          <span className="qa-report-conditions__label">Conditions</span>
          <Prose text={entry.conditions} />
        </div>
      ) : null}
    </>
  );
}

function PreviousSignoff({ entry }: Readonly<{ entry: QaReportSignoffEntry }>) {
  return (
    <li className="qa-report-history__item">
      <div className="qa-report-history__line">
        <VerdictPill verdict={entry.verdict} />
        <span>
          Signed by {actorLabel(entry.signedBy)} · {formatReportDate(entry.signedAt)}
        </span>
        <span className="qa-report-muted">
          Superseded {formatReportDate(entry.supersededAt)}
          {entry.supersededBy ? ` by ${actorLabel(entry.supersededBy)}` : ""}
        </span>
      </div>
      <SignoffText entry={entry} />
    </li>
  );
}

function CurrentSignoff({ report }: Readonly<{ report: QaReport }>) {
  const signoff = report.run.signoff;
  if (!signoff) {
    return (
      <div className="qa-report-empty">
        <p className="qa-report-empty__title">Not signed off</p>
        <p>This run has not been signed off. The results above are live and may still change.</p>
      </div>
    );
  }
  return (
    <div className="qa-report-signoff">
      <div className="qa-report-signoff__line">
        <VerdictPill verdict={signoff.verdict} />
        <span>
          Signed by <strong>{actorLabel(signoff.signedBy)}</strong> · {formatReportDate(signoff.signedAt)}
        </span>
      </div>
      <SignoffText entry={signoff} />
    </div>
  );
}

export function SignoffRecord({ report }: Readonly<{ report: QaReport }>) {
  const previous = previousSignoffs(report.signoffHistory);
  return (
    <>
      <CurrentSignoff report={report} />
      {previous.length > 0 ? (
        <div className="qa-report-history">
          <h3 className="qa-report-history__title">Previous sign-offs ({previous.length})</h3>
          <ol className="qa-report-history__list">
            {previous.map((entry) => (
              <PreviousSignoff key={`${entry.signedAt}-${entry.signedBy.id}`} entry={entry} />
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );
}
