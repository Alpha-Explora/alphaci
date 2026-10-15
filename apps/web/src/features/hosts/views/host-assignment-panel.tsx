"use client";
import Link from "next/link";
import { useWorkspaceSelection } from "@/features/workspace/selection";
import {
  useHostAssignmentViewModel,
  type HostAssignmentOptions,
} from "../view-models/use-host-assignment-view-model";
import { AssignmentForm, AssignmentSummary } from "./host-assignment-form";
export function HostAssignmentPanel(options: HostAssignmentOptions) {
  const { workspaces } = useWorkspaceSelection();
  const membership = workspaces?.items.find(
    (workspace) => workspace.id === options.workspaceId,
  );
  const canManage =
    options.canManage && Boolean(membership) && membership?.role !== "viewer";
  const vm = useHostAssignmentViewModel({ ...options, canManage });
  return (
    <section
      aria-label="Environment host assignment"
      style={{ display: "grid", gap: 8 }}
    >
      <h5>Assigned machine</h5>
      <AssignmentSummary vm={vm} />
      {vm.error ? (
        <p role="alert" className="error-text">
          {vm.error}
        </p>
      ) : null}
      <Link
        href={`/hosts?workspace=${encodeURIComponent(options.workspaceId)}`}
      >
        Add or manage hosts
      </Link>
      {canManage && vm.status === "ready" ? <AssignmentForm vm={vm} /> : null}
      <details>
        <summary>Deployment prerequisites</summary>
        <ul>
          {vm.checks.map((check) => (
            <li key={check.id}>
              {check.id}: {check.status}. {check.message}
            </li>
          ))}
        </ul>
        <button
          className="ghost-button"
          type="button"
          disabled={vm.busy}
          onClick={vm.reload}
        >
          Refresh checks
        </button>
      </details>
    </section>
  );
}
