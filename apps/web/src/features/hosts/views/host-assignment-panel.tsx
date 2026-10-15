"use client";
import "./host-assignment.css";
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
  const failed = vm.checks.filter((check) => check.status === "failed");
  return (
    <div className="hassign" aria-label="Environment host assignment">
      <AssignmentSummary vm={vm} />
      {vm.error ? (
        <p role="alert" className="hassign-alert">
          {vm.error}
        </p>
      ) : null}
      {failed.length ? (
        <div className="hassign-alert" role="alert">
          <p className="hassign-alert__title">Before this can deploy:</p>
          <ul>
            {failed.map((check) => (
              <li key={check.id}>{check.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {canManage && vm.status === "ready" ? (
        <details className="hassign-change" open={!vm.current}>
          <summary>
            {vm.current ? "Change machine or ports" : "Assign a machine"}
          </summary>
          <AssignmentForm vm={vm} />
        </details>
      ) : null}
      <div className="hassign-footer">
        <Link
          className="hassign-link"
          href={`/hosts?workspace=${encodeURIComponent(options.workspaceId)}`}
        >
          Manage hosts →
        </Link>
        <Prerequisites vm={vm} failed={failed.length} />
      </div>
    </div>
  );
}
type PanelVm = ReturnType<typeof useHostAssignmentViewModel>;
const CHECK_ICON = { passed: "✓", failed: "✕", unverified: "•" } as const;
function Prerequisites({ vm, failed }: { vm: PanelVm; failed: number }) {
  let summary = "";
  if (vm.checks.length)
    summary = failed ? `(${failed} to fix)` : "(all passed)";
  return (
    <details className="hassign-checks">
      <summary>Prerequisites {summary}</summary>
      <ul>
        {vm.checks.map((check) => (
          <li
            key={check.id}
            className={`hassign-check hassign-check--${check.status}`}
          >
            <span aria-hidden="true">{CHECK_ICON[check.status]}</span>{" "}
            {check.message}
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
  );
}
