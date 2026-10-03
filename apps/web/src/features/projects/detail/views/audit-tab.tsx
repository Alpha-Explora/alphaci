"use client";

import "./audit-tab.css";

import { useId, useState } from "react";

import type { ProvisionedProject } from "@/features/projects";
import {
  AUDIT_FILTERS,
  auditAbsoluteTime,
  auditEmptyMessage,
  auditFilterEmptyMessage,
  auditLoadMoreLabel,
  auditRelativeTime,
  auditSyncButtonLabel,
  auditSyncLine,
  pushCommitsToggleLabel,
  type AuditRow,
} from "../model/audit-event-rules";
import type { ProjectAuditViewModel } from "../view-models/use-project-audit-view-model";
import type { ProjectDetailTabsViewModel } from "../view-models/use-project-detail-tabs-view-model";

/**
 * The repository's Audit trail, newest first: what happened, who did it and
 * when, with the Project's own events (requirements, checklists) and the
 * activity read from GitHub (pushes, pull requests, branches, tags) tagged.
 * Open to every team member of the repository.
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
      {vm.audit.status === "ready" ? <SyncLine audit={vm.audit} /> : null}
      <AuditBody audit={vm.audit} />
    </section>
  );
}

/** When GitHub activity was last read, and a way to read it now. Absent on an older backend. */
function SyncLine({ audit }: Readonly<{ audit: ProjectAuditViewModel }>) {
  const line = auditSyncLine(audit.githubSync, audit.readAt);
  if (!line) return null;
  return (
    <div className="audit-trail__sync" data-tone={line.tone}>
      <span className="audit-trail__sync-dot" aria-hidden="true" />
      <p className="audit-trail__sync-text" role="status">
        {line.text}
      </p>
      <button
        type="button"
        className="ghost-button audit-trail__sync-button"
        disabled={audit.syncing}
        onClick={() => void audit.syncNow()}
      >
        {auditSyncButtonLabel(audit.syncing)}
      </button>
      {audit.syncError ? (
        <p className="error-text audit-trail__sync-error" role="alert">
          {audit.syncError}
          {audit.syncSignInHref ? (
            <>
              {" "}
              <a href={audit.syncSignInHref}>Sign in again</a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
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
      {audit.showFilters ? <SourceFilters audit={audit} /> : null}
      {audit.filteredRows.length === 0 ? (
        <p className="audit-trail__empty">{auditFilterEmptyMessage(audit.filter)}</p>
      ) : (
        <ol className="audit-trail__list">
          {audit.filteredRows.map((row) => (
            <AuditEventRow key={row.id} row={row} readAt={audit.readAt} />
          ))}
        </ol>
      )}
      <LoadMore audit={audit} />
    </>
  );
}

/** All / ALPHACI / GitHub, over the rows loaded so far. */
function SourceFilters({ audit }: Readonly<{ audit: ProjectAuditViewModel }>) {
  return (
    <div className="audit-trail__filters" role="group" aria-label="Show events from">
      {AUDIT_FILTERS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="audit-trail__filter"
          aria-pressed={audit.filter === option.id}
          onClick={() => audit.setFilter(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AuditEventRow({ row, readAt }: Readonly<{ row: AuditRow; readAt: number }>) {
  return (
    <li className="audit-trail__row" data-event={row.eventCode} data-scope={row.scope}>
      <span className="audit-trail__dot" aria-hidden="true" />
      <div className="audit-trail__body">
        <p className="audit-trail__label">
          {row.label}
          <ScopeTag row={row} />
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
        {row.commits.length > 0 ? <PushCommits row={row} /> : null}
      </div>
    </li>
  );
}

function ScopeTag({ row }: Readonly<{ row: AuditRow }>) {
  if (row.scope === "project") {
    return (
      <span className="audit-trail__tag" title="Recorded on the Project this repository belongs to">
        Project
      </span>
    );
  }
  if (row.scope === "github") {
    return (
      <span className="audit-trail__tag audit-trail__tag--github" title="Read from GitHub, not done in ALPHACI">
        GitHub
      </span>
    );
  }
  return null;
}

/** A push's commits, collapsed until asked for. */
function PushCommits({ row }: Readonly<{ row: AuditRow }>) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="audit-trail__push">
      <button
        type="button"
        className="audit-trail__push-toggle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="audit-trail__push-caret" aria-hidden="true" />
        {pushCommitsToggleLabel(row.commits.length + row.moreCommits, open)}
      </button>
      {open ? (
        <ul className="audit-trail__commits" id={listId}>
          {row.commits.map((commit) => (
            <li key={commit.sha} className="audit-trail__commit">
              <code className="audit-trail__sha" title={commit.sha}>
                {commit.shortSha}
              </code>
              <span className="audit-trail__commit-title">{commit.title}</span>
            </li>
          ))}
          {row.moreCommits > 0 ? (
            <li className="audit-trail__commit audit-trail__commit--more">
              and {row.moreCommits} more not listed
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
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
