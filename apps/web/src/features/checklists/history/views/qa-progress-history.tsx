'use client';
import { createContext, useContext, type ReactNode } from 'react';
import {
  historyEventDetails,
  historyEventLabel,
} from '../../model/qa-history-types';
import { useQaHistoryViewModel } from '../view-models/use-qa-history-view-model';
import './qa-progress-history.css';

const HistoryProject = createContext<string | null>(null);
export function QaHistoryScope({
  projectId,
  children,
}: Readonly<{ projectId: string; children: ReactNode }>) {
  return (
    <HistoryProject.Provider value={projectId}>
      {children}
    </HistoryProject.Provider>
  );
}
export function QaItemHistory({ itemId }: Readonly<{ itemId: string | null }>) {
  const projectId = useContext(HistoryProject);
  return projectId && itemId ? (
    <QaProgressHistory projectId={projectId} itemId={itemId} />
  ) : null;
}

/** The whole audit trail as .xlsx (the Project-wide timeline only). */
function AuditTrailExport({
  vm,
}: Readonly<{ vm: ReturnType<typeof useQaHistoryViewModel> }>) {
  return (
    <>
      <button
        type="button"
        className="qa-text-button"
        onClick={() => void vm.exportWorkbook()}
        disabled={vm.exporting}
      >
        {vm.exporting
          ? 'Preparing audit trail…'
          : 'Download audit trail (.xlsx)'}
      </button>
      {vm.exportError ? <p role="alert">{vm.exportError}</p> : null}
    </>
  );
}

/** Loaded only when opened, in the checklist and Release history. */
export function QaProgressHistory({
  projectId,
  itemId,
  iterationId,
}: Readonly<{ projectId: string; itemId?: string; iterationId?: string }>) {
  const vm = useQaHistoryViewModel(projectId, itemId, iterationId);
  return (
    <details
      className="qa-history"
      open={vm.open}
      onToggle={(event) => vm.setOpen(event.currentTarget.open)}
    >
      <summary>
        {itemId
          ? 'Progress and QA history'
          : 'Progress and QA activity tracker'}
      </summary>
      {vm.open ? (
        <div className="qa-history__body" aria-busy={vm.loading}>
          <p>
            Newest first. Earlier QA rounds and fix requests remain here.
            Developer progress is recorded from the history update onward.
          </p>
          <button
            type="button"
            className="qa-text-button"
            onClick={vm.reload}
            disabled={vm.loading}
          >
            Refresh history
          </button>
          {itemId ? null : <AuditTrailExport vm={vm} />}
          {vm.error ? (
            <p role="alert">
              {vm.error}{' '}
              <button
                type="button"
                className="qa-text-button"
                onClick={vm.reload}
              >
                Try again
              </button>
            </p>
          ) : null}
          {vm.loading ? <p role="status">Loading history…</p> : null}
          {!vm.loading && !vm.error && vm.events.length === 0 ? (
            <p>No recorded events yet.</p>
          ) : null}
          <ol className="qa-history__events">
            {vm.events.map((event) => (
              <li key={event.id}>
                <strong>{historyEventLabel(event)}</strong>
                {!itemId ? (
                  <p>
                    {event.requirementName ? `${event.requirementName} · ` : ''}
                    {event.title}
                  </p>
                ) : null}
                <p>
                  {event.actorLogin ? `@${event.actorLogin}` : 'System'} ·{' '}
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </p>
                {historyEventDetails(event).map((detail, index) => (
                  <p className="qa-history__detail" key={index}>
                    {detail}
                  </p>
                ))}
                {event.iterationNumber ? (
                  <small>Version {event.iterationNumber} - </small>
                ) : null}
                {event.runId ? (
                  <small>QA run {event.runId.slice(0, 8)}</small>
                ) : null}
              </li>
            ))}
          </ol>
          {vm.nextCursor ? (
            <button
              type="button"
              className="ghost-button"
              disabled={vm.loading}
              onClick={vm.loadMore}
            >
              Load older events
            </button>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
