"use client";

import "./team-settings.css";

import type { ReactNode } from "react";

import { FormDialog } from "@/features/groups/workspace";
import type { GroupMember } from "@/features/groups";

import type { Team } from "../../model/teams-types";
import {
  useTeamSettingsViewModel,
  type TeamSettingsViewModel,
} from "../view-models/use-team-settings-view-model";

function memberDisplayName(member: GroupMember | undefined): string {
  return member?.name || member?.login || "";
}

function TeamDetailsSettings({ vm }: Readonly<{ vm: TeamSettingsViewModel }>) {
  const saving = vm.status === "saving";
  return (
    <section className="team-settings__block">
      <h4>Details</h4>
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="premium-input"
          value={vm.name}
          onChange={(event) => vm.setName(event.target.value)}
          disabled={saving}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description</span>
        <textarea
          className="premium-input"
          rows={2}
          value={vm.description}
          onChange={(event) => vm.setDescription(event.target.value)}
          disabled={saving}
        />
      </label>
      <div className="team-settings__actions">
        <button
          type="button"
          className="primary-button group-section-action"
          disabled={vm.status !== "idle" || !vm.dirty}
          onClick={() => void vm.save()}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}

function TeamLeadPicker({ vm }: Readonly<{ vm: TeamSettingsViewModel }>) {
  return (
    <div className="team-settings__actions">
      <select
        className="ws-select"
        aria-label="New Lead"
        value={vm.transferTo}
        onChange={(event) => vm.setTransferTo(event.target.value)}
      >
        <option value="">Choose a member…</option>
        {vm.candidates.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberDisplayName(member)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ghost-button group-section-action"
        disabled={!vm.transferTo}
        onClick={vm.askConfirmTransfer}
      >
        Transfer lead
      </button>
    </div>
  );
}

function TeamLeadConfirm({ vm }: Readonly<{ vm: TeamSettingsViewModel }>) {
  const label = memberDisplayName(
    vm.candidates.find((member) => member.userId === vm.transferTo),
  );
  const busy = vm.status === "working";
  return (
    <div className="team-settings__actions">
      <span className="team-settings__lede">
        Hand the team to <strong>{label}</strong>?
      </span>
      <button
        type="button"
        className="confirm-btn-danger group-section-action"
        disabled={vm.status !== "idle"}
        onClick={() => void vm.transfer()}
      >
        {busy ? "Transferring…" : "Yes, transfer"}
      </button>
      <button
        type="button"
        className="ghost-button group-section-action"
        onClick={vm.cancelTransfer}
      >
        Cancel
      </button>
    </div>
  );
}

function TeamLeadSettings({ vm }: Readonly<{ vm: TeamSettingsViewModel }>) {
  let body: ReactNode = (
    <p className="team-settings__lede">
      There is nobody to transfer to yet. Add another member first.
    </p>
  );
  if (vm.candidates.length > 0) {
    body = vm.confirmTransfer ? <TeamLeadConfirm vm={vm} /> : <TeamLeadPicker vm={vm} />;
  }
  return (
    <section className="team-settings__block">
      <h4>Lead</h4>
      <p className="team-settings__lede">
        A team keeps exactly one Lead. Transferring hands it to another member
        and makes you a Delegated lead — the only way to change who owns a
        team without deleting it.
      </p>
      {body}
    </section>
  );
}

function TeamArchiveSettings({ vm }: Readonly<{ vm: TeamSettingsViewModel }>) {
  return (
    <section className="team-settings__block">
      <h4>{vm.archived ? "Reopen" : "Archive"}</h4>
      <p className="team-settings__lede">
        {vm.archived
          ? "This team is archived. Reopening restores it everywhere."
          : "Archiving hides the team without deleting anything. Its repositories stay on GitHub and it can be reopened."}
      </p>
      <div className="team-settings__actions">
        <button
          type="button"
          className="ghost-button group-section-action"
          disabled={vm.status !== "idle"}
          onClick={() => void vm.toggleArchive()}
        >
          {vm.archived ? "Reopen team" : "Archive team"}
        </button>
      </div>
    </section>
  );
}

function deleteDescription(projectCount: number): string {
  if (projectCount === 0) {
    return "This permanently deletes the team, its membership, and its systems. This cannot be undone.";
  }
  const one = projectCount === 1;
  return `This permanently deletes the team and its membership. Its ${projectCount} ${one ? "repository stays" : "repositories stay"} on GitHub, but ${one ? "the project belongs" : "the projects belong"} to no team afterwards and will not be listed here. Move ${one ? "it" : "them"} to another team first. This cannot be undone.`;
}

function TeamDangerZone({
  vm,
  team,
  projectCount,
}: Readonly<{ vm: TeamSettingsViewModel; team: Team; projectCount: number }>) {
  return (
    <div className="group-danger-zone">
      <div>
        <strong>Delete this team</strong>
        <p>
          Removes the team and its membership. Its repositories stay on
          GitHub, but the projects end up belonging to no team and stop being
          listed — move them to another team first.
        </p>
      </div>
      <button type="button" className="hier-btn-danger" onClick={vm.openDelete}>
        Delete team
      </button>
      <FormDialog
        open={vm.deleteOpen}
        onClose={vm.closeDelete}
        title={`Delete "${team.name}"?`}
        description={deleteDescription(projectCount)}
        submitLabel="Delete team"
        submitting={vm.status === "deleting"}
        error={vm.deleteError}
        onSubmit={() => void vm.deleteTeam()}
      >
        <p className="project-list-empty" style={{ margin: 0 }}>
          Members will lose access to this team immediately.
        </p>
      </FormDialog>
    </div>
  );
}

/**
 * Everything a Lead can change about the team itself: details, the Lead,
 * archive / reopen, and delete — the old team rail's Settings section.
 */
export function TeamSettingsPanel({
  team,
  projectCount,
  onChanged,
  onDeleted,
}: Readonly<{
  team: Team;
  /** Repositories the team owns — the delete dialog warns about them. */
  projectCount: number;
  onChanged?: () => void;
  onDeleted?: (teamId: string) => void;
}>) {
  const vm = useTeamSettingsViewModel({ team, onChanged, onDeleted });
  return (
    <div className="team-settings">
      <TeamDetailsSettings vm={vm} />
      <TeamLeadSettings vm={vm} />
      <TeamArchiveSettings vm={vm} />
      {vm.message ? (
        <p className="team-settings__ok" role="status">
          {vm.message}
        </p>
      ) : null}
      {vm.error ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {vm.error}
        </p>
      ) : null}
      <TeamDangerZone vm={vm} team={team} projectCount={projectCount} />
    </div>
  );
}
