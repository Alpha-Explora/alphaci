"use client";

import { useMemo, useState } from "react";

import {
  reconcileRepositoryAssignment,
  removeRepositoryAssignment,
} from "@/features/groups";
import type {
  RepositoryAccessStatus,
  RepositoryAssignment,
} from "@/features/groups";
import { timeAgo } from "@/features/groups";
import {
  shouldShowAssignmentReconcile,
  shouldShowAssignmentRevoke,
} from "@/features/groups";
import { AccessStatusBadge, SyncStateBadge } from "./badges";
import { Avatar, SectionHeader } from "./primitives";

/**
 * Assignments + GitHub access status for one repository.
 *
 * A failed REVOCATION (sync_state='failed' AND desired_state='unassigned', i.e.
 * isHighPriorityFailure per plan §1.6) is surfaced as a high-priority alert at
 * the top — access AlphaCI intended to remove is still live on GitHub, which is
 * a security-relevant condition, not a routine retry.
 */
export function AssignmentPanel({
  repositoryId,
  assignments,
  accessStatus,
  canManage,
  onAssignmentsChange,
  assignAction,
}: {
  repositoryId: string;
  assignments: RepositoryAssignment[];
  accessStatus: RepositoryAccessStatus[];
  canManage: boolean;
  onAssignmentsChange: (
    updater: (current: RepositoryAssignment[]) => RepositoryAssignment[],
  ) => void;
  assignAction?: React.ReactNode;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusByAssignment = useMemo(() => {
    const map = new Map<string, RepositoryAccessStatus>();
    for (const row of accessStatus) map.set(row.assignmentId, row);
    return map;
  }, [accessStatus]);

  const highPriorityFailures = useMemo(
    () => accessStatus.filter((row) => row.isHighPriorityFailure),
    [accessStatus],
  );

  const visibleAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) => assignment.status !== "revoked" || canManage,
      ),
    [assignments, canManage],
  );

  async function handleRemove(assignment: RepositoryAssignment) {
    setBusyId(assignment.id);
    setError(null);
    try {
      const updated = await removeRepositoryAssignment(
        repositoryId,
        assignment.id,
      );
      onAssignmentsChange((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("The assignment could not be revoked.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReconcile(assignment: RepositoryAssignment) {
    setBusyId(assignment.id);
    setError(null);
    try {
      const updated = await reconcileRepositoryAssignment(
        repositoryId,
        assignment.id,
      );
      onAssignmentsChange((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("The repair could not be triggered.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Member access">
      {highPriorityFailures.length > 0 && <RevocationAlert count={highPriorityFailures.length} />}

      <SectionHeader
        title="Member access"
        count={visibleAssignments.length}
        actions={assignAction}
      />

      <div className="hier-panel">
        {visibleAssignments.length === 0 ? (
          <div className="hier-tree-empty">No members are assigned yet.</div>
        ) : (
          visibleAssignments.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment}
            sync={statusByAssignment.get(assignment.id)} canManage={canManage}
            busy={busyId === assignment.id} onReconcile={handleReconcile} onRemove={handleRemove} />)
        )}
      </div>

      {error && (
        <p className="error-text" role="alert" style={{ margin: "0.6rem 0 0" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function RevocationAlert({ count }: Readonly<{ count: number }>) {
  return <div className="hier-alert" role="alert" style={{ marginBottom: "1rem" }}><span className="hier-alert-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></span><div className="hier-alert-body"><p className="hier-alert-title">{count} failed access removal{count === 1 ? "" : "s"}</p><p className="hier-alert-text">AlphaCI could not confirm that GitHub access was removed for {count === 1 ? "a member whose assignment was revoked" : "members whose assignments were revoked"}. Access may still be live. AlphaCI keeps retrying; use “Repair” to re-trigger the removal now.</p></div></div>;
}

function AssignmentRow({ assignment, sync, canManage, busy, onReconcile, onRemove }: Readonly<{
  assignment: RepositoryAssignment; sync?: RepositoryAccessStatus; canManage: boolean; busy: boolean;
  onReconcile: (assignment: RepositoryAssignment) => Promise<void>; onRemove: (assignment: RepositoryAssignment) => Promise<void>;
}>) {
  const failedStyle = sync?.isHighPriorityFailure ? { background: "var(--accent-rose-light)", borderLeft: "3px solid var(--danger)" } : undefined;
  return <div className="hier-row" style={failedStyle}><div className="hier-row-identity"><Avatar login={assignment.login} name={assignment.name} avatarUrl={assignment.avatarUrl} /><div className="hier-row-name"><strong>{assignment.name || assignment.login || assignment.userId}</strong><AssignmentSyncText sync={sync} /></div></div><AssignmentActions assignment={assignment} sync={sync} canManage={canManage} busy={busy} onReconcile={onReconcile} onRemove={onRemove} /></div>;
}

function AssignmentSyncText({ sync }: Readonly<{ sync?: RepositoryAccessStatus }>) {
  const status = sync?.lastError ? sync.lastError : sync?.lastSyncedAt ? `Last synced ${timeAgo(sync.lastSyncedAt)}` : "Awaiting first sync";
  const retries = sync && sync.retryCount > 0 ? ` · ${sync.retryCount} ${sync.retryCount === 1 ? "retry" : "retries"}` : "";
  return <span>{status}{retries}</span>;
}

function AssignmentActions({ assignment, sync, canManage, busy, onReconcile, onRemove }: Readonly<{
  assignment: RepositoryAssignment; sync?: RepositoryAccessStatus; canManage: boolean; busy: boolean;
  onReconcile: (assignment: RepositoryAssignment) => Promise<void>; onRemove: (assignment: RepositoryAssignment) => Promise<void>;
}>) {
  const showReconcile = shouldShowAssignmentReconcile(
    canManage,
    assignment.status,
    sync?.syncState,
  );
  const showRevoke = shouldShowAssignmentRevoke(
    canManage,
    assignment.desiredState,
    assignment.status,
  );
  return (
    <div className="hier-row-actions">
      <AccessStatusBadge status={assignment.status} />
      {sync ? <SyncStateBadge state={sync.syncState} /> : null}
      {showReconcile ? (
        <button type="button" className="hier-btn-sm" disabled={busy} onClick={() => void onReconcile(assignment)}>Repair</button>
      ) : null}
      {showRevoke ? (
        <button type="button" className="hier-btn-danger" disabled={busy} onClick={() => void onRemove(assignment)}>Revoke</button>
      ) : null}
    </div>
  );
}
