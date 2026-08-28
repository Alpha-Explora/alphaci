"use client";

import { useState } from "react";

import { CreateGroupDialog } from "@/features/groups/create";
import {
  APP_ROLE_BADGE_LABELS,
  canCreateWorkspace,
  type WorkspaceAppRole,
  type WorkspacesMeResponse,
} from "../model/workspace-types";
import type { WorkspaceSelectionStatus } from "../view-models/use-workspace-selection-view-model";
import { useWorkspaceSelection } from "./workspace-selection-context";

/**
 * Sentinel option value. A <select> can only carry values, so "create" rides in
 * as one and is intercepted on change — the alternative was a second control
 * beside the dropdown, which is the thing this replaced.
 */
const CREATE = "__create__";

/**
 * The workspace picker, in the header.
 *
 * Switching workspace is the only control in the chrome that changes what the
 * rest of the app is scoped to, which is why it lives up here rather than
 * behind the rail's hover.
 *
 * It renders as a <select> even with ONE entry. Falling back to plain text
 * meant someone with a single workspace learned the app had no switcher and
 * never looked again after gaining a second — a control that only appears once
 * you already have the problem is one nobody discovers.
 */
export function WorkspaceSwitcher({
  workspaces,
  appRole,
  status = "ready",
  onRetry,
  onWorkspaceCreated,
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
  appRole?: WorkspaceAppRole | null;
  /**
   * Load state, so a failed fetch can say so instead of vanishing.
   * `enabled: false` reaches this component for two very different reasons —
   * the feature is switched off, or the request failed — and only the status
   * tells them apart.
   */
  status?: WorkspaceSelectionStatus;
  /** Re-runs the failed load, so the error state is recoverable in place. */
  onRetry?: () => void;
  /** Lets the owner of the workspace list re-fetch after a create. */
  onWorkspaceCreated?: (workspaceId: string) => void;
}>) {
  const { selectedWorkspace, selectedWorkspaceId, setSelectedWorkspaceId } =
    useWorkspaceSelection();
  const [createOpen, setCreateOpen] = useState(false);

  const items = workspaces?.items ?? [];
  const canCreate = canCreateWorkspace(appRole);
  const current =
    items.find((workspace) => workspace.id === selectedWorkspaceId) ??
    selectedWorkspace ??
    items[0] ??
    null;

  /* The header slot keeps its place in every state.
   *
   * It used to return null whenever anything was less than perfect, so a
   * failed request looked exactly like a feature that was switched off, and
   * both looked like a UI that had lost its workspace control. A team lead
   * reported the dropdown as "missing" for precisely this reason. */

  if (status === "error") {
    return (
      <div className="team-switcher team-switcher--notice" role="status">
        <span>Workspaces unavailable</span>
        {onRetry ? (
          <button type="button" className="inline-link" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  // Genuinely switched off by configuration — there is no workspace concept to
  // show, which is different from having none.
  if (workspaces?.enabled === false) {
    return null;
  }

  if (status === "loading" || workspaces === null) {
    return (
      <div className="team-switcher team-switcher--notice" aria-hidden="true">
        <span>Loading workspaces…</span>
      </div>
    );
  }

  /* Belongs to no team and cannot make one.
   *
   * Creating a workspace is a Lead/Admin action, so the way out of this state
   * is somebody else's — hence no create button. But "No team yet" on its own
   * was still a dead end, and a misleading one: it is also what a genuine Lead
   * sees when the app has misjudged their role, which is exactly how a Lead
   * came to be reported as "cannot see the workspace dropdown". The two causes
   * look identical and the message named neither.
   *
   * So this state now answers both questions it used to raise. The role label
   * is the tell — a Lead reading "Developer" here can see in one glance that
   * the problem is their role and not their teams, and say so. "Check again"
   * re-reads the TEAM LIST (not the role), which is the common case: an admin
   * has just added them and a reload should not be the way to find out. */
  if (items.length === 0 && !canCreate) {
    return (
      <div className="team-switcher team-switcher--notice" role="status">
        <span>No team yet — ask an admin to add you to one</span>
        <span className="team-switcher-role-hint">
          Signed in as {APP_ROLE_BADGE_LABELS[appRole ?? "member"]}
        </span>
        {onRetry ? (
          <button type="button" className="inline-link" onClick={onRetry}>
            Check again
          </button>
        ) : null}
      </div>
    );
  }

  /* No workspaces yet, but this caller may make one. A <select> whose only
   * entry is an action is not a picker — there is nothing to pick between, and
   * the affordance reads as an empty control rather than a thing to press. The
   * button says what it does. Leads land here on their first sign-in, so this
   * is the first thing they see. */
  if (items.length === 0) {
    return (
      <div className="team-switcher">
        <button
          type="button"
          className="primary-button team-switcher-create"
          data-testid="create-workspace-button"
          onClick={() => setCreateOpen(true)}
        >
          + Create workspace
        </button>
        <CreateGroupDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => {
            setSelectedWorkspaceId(group.id);
            onWorkspaceCreated?.(group.id);
          }}
        />
      </div>
    );
  }

  return (
    <div className="team-switcher">
      <label className="team-switcher-field">
        <span className="sr-only">Active workspace</span>
        <select
          aria-label="Active workspace"
          value={current?.id ?? ""}
          onChange={(event) => {
            if (event.target.value === CREATE) {
              // Never let the sentinel become the selection — reopen on the
              // workspace the user was already in, then show the dialog.
              event.target.value = current?.id ?? "";
              setCreateOpen(true);
              return;
            }
            setSelectedWorkspaceId(event.target.value || null);
          }}
          className="team-switcher-select"
        >
          {items.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
          {canCreate ? (
            <>
              <option disabled>──────────</option>
              <option value={CREATE}>+ Create workspace</option>
            </>
          ) : null}
        </select>
      </label>

      {canCreate ? (
        <CreateGroupDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => {
            setSelectedWorkspaceId(group.id);
            onWorkspaceCreated?.(group.id);
          }}
        />
      ) : null}
    </div>
  );
}
