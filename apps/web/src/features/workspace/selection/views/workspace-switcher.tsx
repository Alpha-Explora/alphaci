"use client";

import { useState } from "react";

import { CreateGroupDialog } from "@/components/hierarchy/create-group-dialog";
import {
  canCreateWorkspace,
  type WorkspaceAppRole,
  type WorkspacesMeResponse,
} from "../model/workspace-types";
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
  onWorkspaceCreated,
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
  appRole?: WorkspaceAppRole | null;
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

  if (workspaces?.enabled === false || (items.length === 0 && !canCreate)) {
    return null;
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
