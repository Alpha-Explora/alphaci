"use client";

import { useState } from "react";

import { CreateGroupDialog } from "@/features/groups/create";
import {
  APP_ROLE_BADGE_LABELS,
  OTHER_TEAMS_HEADING,
  canCreateWorkspace,
  selectableWorkspaces,
  workspaceSwitcherKind,
  type WorkspaceAppRole,
  type WorkspaceSummary,
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

const NO_OTHER_TEAMS: readonly WorkspaceSummary[] = [];

function findCurrentWorkspace(
  items: WorkspacesMeResponse["items"],
  selectedWorkspaceId: string | null,
  selectedWorkspace: WorkspacesMeResponse["items"][number] | null,
) {
  return items.find((workspace) => workspace.id === selectedWorkspaceId) ?? selectedWorkspace ?? items[0] ?? null;
}

function currentWorkspaceId(current: WorkspacesMeResponse["items"][number] | null) {
  return current?.id ?? "";
}

function SwitcherRetryNotice({
  message,
  action,
  onRetry,
}: Readonly<{ message: string; action: string; onRetry?: () => void }>) {
  return (
    <div className="team-switcher team-switcher--notice" role="status">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="inline-link" onClick={onRetry}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

function SwitcherLoadingNotice() {
  return (
    <div className="team-switcher team-switcher--notice" aria-hidden="true">
      <span>Loading workspaces…</span>
    </div>
  );
}

function NoTeamNotice({
  appRole,
  onRetry,
}: Readonly<{ appRole?: WorkspaceAppRole | null; onRetry?: () => void }>) {
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

function createdWorkspaceHandler(
  setSelectedWorkspaceId: (id: string | null) => void,
  onWorkspaceCreated?: (workspaceId: string) => void,
) {
  return (group: { id: string }) => {
    setSelectedWorkspaceId(group.id);
    onWorkspaceCreated?.(group.id);
  };
}

function EmptyWorkspaceCreate({
  createOpen,
  setCreateOpen,
  onCreated,
}: Readonly<{
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  onCreated: (group: { id: string }) => void;
}>) {
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
        onCreated={onCreated}
      />
    </div>
  );
}

function CreateWorkspaceOptions() {
  return (
    <>
      <option disabled>──────────</option>
      <option value={CREATE}>+ Create workspace</option>
    </>
  );
}

function applyWorkspaceSelectChange(
  value: string,
  currentId: string,
  select: HTMLSelectElement,
  setCreateOpen: (open: boolean) => void,
  setSelectedWorkspaceId: (id: string | null) => void,
) {
  if (value === CREATE) {
    select.value = currentId;
    setCreateOpen(true);
    return;
  }
  setSelectedWorkspaceId(value || null);
}

/**
 * The options. With no other teams (everyone but a platform admin) this is the
 * flat list it always was; an admin's non-member teams follow under their own
 * heading, with the admin's own teams grouped above them for symmetry.
 */
function WorkspaceOptions({
  items,
  otherTeams,
}: Readonly<{ items: WorkspacesMeResponse["items"]; otherTeams: readonly WorkspaceSummary[] }>) {
  const own = items.map((workspace) => (
    <option key={workspace.id} value={workspace.id}>
      {workspace.name}
    </option>
  ));
  if (otherTeams.length === 0) return <>{own}</>;
  return (
    <>
      {items.length > 0 ? <optgroup label="Your teams">{own}</optgroup> : null}
      <optgroup label={OTHER_TEAMS_HEADING}>
        {otherTeams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}

function WorkspacePicker({
  items,
  otherTeams,
  currentId,
  canCreate,
  createOpen,
  setCreateOpen,
  setSelectedWorkspaceId,
  onCreated,
}: Readonly<{
  items: WorkspacesMeResponse["items"];
  otherTeams: readonly WorkspaceSummary[];
  currentId: string;
  canCreate: boolean;
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  setSelectedWorkspaceId: (id: string | null) => void;
  onCreated: (group: { id: string }) => void;
}>) {
  return (
    <div className="team-switcher">
      <label className="team-switcher-field">
        <span className="sr-only">Active workspace</span>
        <select
          aria-label="Active workspace"
          value={currentId}
          onChange={(event) =>
            applyWorkspaceSelectChange(
              event.target.value,
              currentId,
              event.target,
              setCreateOpen,
              setSelectedWorkspaceId,
            )
          }
          className="team-switcher-select"
        >
          <WorkspaceOptions items={items} otherTeams={otherTeams} />
          {canCreate ? <CreateWorkspaceOptions /> : null}
        </select>
      </label>
      {canCreate ? (
        <CreateGroupDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
        />
      ) : null}
    </div>
  );
}

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
  otherTeams = NO_OTHER_TEAMS,
  appRole,
  status = "ready",
  onRetry,
  onWorkspaceCreated,
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
  /**
   * A platform admin's teams they are not a member of, listed under "Other
   * teams (admin)". Omitted (empty) for everybody else, who see no change.
   */
  otherTeams?: readonly WorkspaceSummary[];
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
  const selectable = selectableWorkspaces(workspaces, otherTeams);
  const canCreate = canCreateWorkspace(appRole);
  const current = findCurrentWorkspace(selectable, selectedWorkspaceId, selectedWorkspace);
  const onCreated = createdWorkspaceHandler(setSelectedWorkspaceId, onWorkspaceCreated);
  const kind = workspaceSwitcherKind(status, workspaces, selectable.length, canCreate);

  if (kind === "error") {
    return (
      <SwitcherRetryNotice
        message="Workspaces unavailable"
        action="Retry"
        onRetry={onRetry}
      />
    );
  }
  if (kind === "disabled") return null;
  if (kind === "loading") return <SwitcherLoadingNotice />;
  if (kind === "no-team") return <NoTeamNotice appRole={appRole} onRetry={onRetry} />;
  if (kind === "create") {
    return (
      <EmptyWorkspaceCreate
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        onCreated={onCreated}
      />
    );
  }
  return (
    <WorkspacePicker
      items={items}
      otherTeams={otherTeams}
      currentId={currentWorkspaceId(current)}
      canCreate={canCreate}
      createOpen={createOpen}
      setCreateOpen={setCreateOpen}
      setSelectedWorkspaceId={setSelectedWorkspaceId}
      onCreated={onCreated}
    />
  );
}
