"use client";

import "./audit-tab.css";

import type { ProvisionedProject } from "@/features/projects";
import {
  auditAbsoluteTime,
  auditEmptyMessage,
  auditLoadMoreLabel,
  auditRelativeTime,
  type AuditRow,
} from "../model/audit-event-rules";
import type { ProjectAuditViewModel } from "../view-models/use-project-audit-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The repository's Audit trail, newest first: what happened, who did it and
 * when, with the Project's own events (requirements, checklists) tagged. Open
 * to every team member of the repository.
 */
export function AuditTab({
  vm,
}: Readonly<{
  project: ProvisionedProject;
  vm: ProjectDetailTabsViewModel;
  dangerZone?: React.ReactNode;
}>) {
  return (
    <section className="audit-trail" aria-labelledby="audit-trail-title">
      <h2 className="audit-trail__title" id="audit-trail-title">
        Audit trail
      </h2>
      <AuditBody audit={vm.audit} />
    </section>
  );
}

function AuditBody({ audit }: Readonly<{ audit: ProjectAuditViewModel }>) {
  if (audit.status === "error") {
    return (
      <p className="error-text" role="alert" style={{ margin: 0 }}>
        {audit.error}
      </p>
    );
  }
  if (audit.status === "loading") {
    return (
      <ul className="audit-trail__list" aria-busy="true" aria-label="Loading audit events">
        {[0, 1, 2].map((key) => (
          <li key={key} className="audit-trail__row audit-trail__row--skeleton" aria-hidden="true" />
        ))}
      </ul>
    );
  }
  if (audit.rows.length === 0) {
    return (
      <p className="audit-trail__empty" data-recording={audit.recording ? "on" : "off"}>
        {auditEmptyMessage(audit.recording)}
      </p>
    );
  }
  return (
    <>
      <ol className="audit-trail__list">
        {audit.rows.map((row) => (
          <AuditEventRow key={row.id} row={row} readAt={audit.readAt} />
        ))}
      </ol>
      <LoadMore audit={audit} />
    </>
  );
}

function AuditEventRow({ row, readAt }: Readonly<{ row: AuditRow; readAt: number }>) {
  return (
    <li className="audit-trail__row" data-event={row.eventCode}>
      <span className="audit-trail__dot" aria-hidden="true" />
      <div className="audit-trail__body">
        <p className="audit-trail__label">
          {row.label}
          {row.scope === "project" ? (
            <span className="audit-trail__tag" title="Recorded on the Project this repository belongs to">
              Project
            </span>
          ) : null}
          {row.restored ? (
            <span className="audit-trail__tag audit-trail__tag--quiet" title="Recovered after it was first missed">
              Restored
            </span>
          ) : null}
        </p>
        {row.detail ? <p className="audit-trail__detail">{row.detail}</p> : null}
        <p className="audit-trail__meta">
          <span className="audit-trail__actor">{row.actor}</span>
          <time dateTime={row.createdAt} title={auditAbsoluteTime(row.createdAt)}>
            {auditRelativeTime(row.createdAt, readAt)}
          </time>
        </p>
      </div>
    </li>
  );
}

function LoadMore({ audit }: Readonly<{ audit: ProjectAuditViewModel }>) {
  if (!audit.hasMore) return null;
  return (
    <div className="audit-trail__more">
      <button
        type="button"
        className="ghost-button audit-trail__more-button"
        disabled={audit.loadingMore}
        onClick={() => void audit.loadMore()}
      >
        {auditLoadMoreLabel(audit.loadingMore)}
      </button>
      {audit.loadMoreError ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {audit.loadMoreError}
        </p>
      ) : null}
    </div>
  );
}
