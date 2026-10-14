"use client";

import {
  Avatar,
  Dialog,
  FormDialog,
  LoadingRows,
  ResourceBoundary,
  SectionHeader,
} from "@/features/groups/workspace";

import "./project-members.css";
import type { DeliveryProjectMember, DeliveryProjectMemberKind, GroupMember } from "../../model/groups-types";
import {
  candidateKind,
  DEVELOPER_ACCESS_NOTE,
  MEMBER_KIND_LABELS,
  memberDisplayName,
  QA_ACCESS_NOTE,
  RESYNC_NOTE,
  STUB_SYNC_NOTE,
} from "../../model/project-members-rules";
import type { ProjectMembersViewModel } from "../view-models/use-project-members-view-model";

type PanelProps = Readonly<{ vm: ProjectMembersViewModel }>;

/**
 * The Project's members: Developers (GitHub Write on the repositories created
 * here) and QA Team (no GitHub write). Leads and admins only — the caller
 * renders nothing for anyone else.
 */
export function ProjectMembersPanel({ vm }: PanelProps) {
  if (!vm.visible) return null;
  return (
    <section className="project-members" aria-label="Project members">
      <SectionHeader
        title="Project members"
        count={vm.status === "ready" ? vm.members.length : undefined}
        actions={<PanelActions vm={vm} />}
      />
      <AccessExplainer syncLive={vm.syncLive} />
      <Feedback notice={vm.notice} error={vm.error} />
      <MemberList vm={vm} />
      <AddMemberDialog vm={vm} />
      <RemoveMemberDialog vm={vm} />
    </section>
  );
}

function PanelActions({ vm }: PanelProps) {
  return (
    <div className="project-members__actions">
      {vm.syncLive ? (
        <button
          type="button"
          className="hier-btn-sm"
          onClick={() => void vm.resync()}
          disabled={vm.busy !== null}
          title={RESYNC_NOTE}
        >
          {vm.busy === "sync" ? "Re-syncing…" : "Re-sync GitHub access"}
        </button>
      ) : null}
      <button type="button" className="hier-btn-sm project-members__add" onClick={vm.openAdd} disabled={vm.busy !== null}>
        Add member
      </button>
    </div>
  );
}

export function KindBadge({ kind }: Readonly<{ kind: DeliveryProjectMemberKind }>) {
  return (
    <span className={`hier-badge project-members__kind project-members__kind--${kind}`}>
      {MEMBER_KIND_LABELS[kind]}
    </span>
  );
}

function AccessExplainer({ syncLive }: Readonly<{ syncLive: boolean }>) {
  return (
    <div className="project-members__explainer">
      <p>
        <KindBadge kind="developer" /> <span>{DEVELOPER_ACCESS_NOTE}</span>
      </p>
      <p>
        <KindBadge kind="qa" /> <span>{QA_ACCESS_NOTE}</span>
      </p>
      {syncLive ? null : (
        <p className="project-members__stub" role="note">
          {STUB_SYNC_NOTE}
        </p>
      )}
    </div>
  );
}

function Feedback({ notice, error }: Readonly<{ notice: string | null; error: string | null }>) {
  if (error) {
    return (
      <p className="error-text project-members__feedback" role="alert">
        {error}
      </p>
    );
  }
  return notice ? (
    <p className="project-members__feedback project-members__notice" role="status">
      {notice}
    </p>
  ) : null;
}

function MemberList({ vm }: PanelProps) {
  if (vm.status === "loading") return <LoadingRows rows={2} />;
  if (vm.status !== "ready") {
    return (
      <ResourceBoundary
        state={vm.status}
        onRetry={vm.reload}
        emptyTitle="No members yet"
        emptyMessage="Add Developers and QA Team from this Project's team."
      />
    );
  }
  return (
    <div className="hier-panel">
      {vm.members.map((member) => (
        <MemberRow key={member.userId} member={member} vm={vm} />
      ))}
    </div>
  );
}

function MemberRow({ member, vm }: Readonly<{ member: DeliveryProjectMember; vm: ProjectMembersViewModel }>) {
  const name = memberDisplayName(member);
  return (
    <div className="hier-row">
      <div className="hier-row-identity">
        <Avatar login={member.login} name={member.name} avatarUrl={member.avatarUrl} />
        <div className="hier-row-name">
          <strong>{name}</strong>
          {member.login ? <span>@{member.login}</span> : null}
        </div>
      </div>
      <div className="hier-row-actions">
        <KindBadge kind={member.memberKind} />
        <button
          type="button"
          className="hier-btn-danger"
          onClick={() => vm.askRemove(member)}
          disabled={vm.busy !== null}
          aria-label={`Remove ${name} from this Project`}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function candidateLabel(member: GroupMember): string {
  const kind = candidateKind(member);
  const who = `${member.name || member.login} (@${member.login})`;
  return kind ? `${who} · ${MEMBER_KIND_LABELS[kind]}` : who;
}

function candidatePlaceholder(vm: ProjectMembersViewModel): string {
  if (vm.candidatesStatus === "loading") return "Loading team members…";
  if (vm.candidatesStatus === "error") return "Team members could not be loaded";
  return vm.candidates.length > 0 ? "Select a team member" : "Everyone eligible is already in this Project";
}

function selectedKindNote(vm: ProjectMembersViewModel): string {
  const selected = vm.candidates.find((member) => member.userId === vm.selectedUserId);
  const kind = selected ? candidateKind(selected) : null;
  if (kind === "qa") return QA_ACCESS_NOTE;
  if (kind === "developer") {
    return vm.syncLive ? DEVELOPER_ACCESS_NOTE : `${DEVELOPER_ACCESS_NOTE} ${STUB_SYNC_NOTE}`;
  }
  return "Developers and QA Team of this Project's team can be added. Their kind comes from their role.";
}

function AddMemberDialog({ vm }: PanelProps) {
  return (
    <FormDialog
      open={vm.addOpen}
      onClose={vm.closeAdd}
      title="Add member"
      description="Add a Developer or QA Team member of this Project's team."
      submitLabel="Add member"
      submitting={vm.busy === "add"}
      error={vm.addError}
      canSubmit={vm.selectedUserId !== ""}
      onSubmit={() => void vm.add()}
    >
      <div className="hier-field project-members-dialog">
        <label className="hier-field-label" htmlFor="project-member-user">
          Team member
        </label>
        <select
          id="project-member-user"
          className="hier-select"
          value={vm.selectedUserId}
          onChange={(event) => vm.setSelectedUserId(event.target.value)}
          disabled={vm.candidatesStatus !== "ready" || vm.candidates.length === 0}
        >
          <option value="">{candidatePlaceholder(vm)}</option>
          {vm.candidates.map((member) => (
            <option key={member.userId} value={member.userId}>
              {candidateLabel(member)}
            </option>
          ))}
        </select>
        <span className="hier-field-hint">{selectedKindNote(vm)}</span>
      </div>
    </FormDialog>
  );
}

function removalEffect(member: DeliveryProjectMember, syncLive: boolean): string {
  if (member.memberKind === "qa") return "They leave this Project's QA. Nothing changes on GitHub.";
  return syncLive
    ? "ALPHACI removes their GitHub Write on the repositories created in this Project."
    : "Live GitHub sync is off, so no GitHub access was granted and nothing changes on GitHub.";
}

function RemoveMemberDialog({ vm }: PanelProps) {
  const member = vm.removeTarget;
  return (
    <Dialog
      open={member !== null}
      onClose={vm.cancelRemove}
      title={member ? `Remove ${memberDisplayName(member)}?` : "Remove member?"}
      description={member ? removalEffect(member, vm.syncLive) : undefined}
    >
      <div className="hier-dialog-actions project-members__confirm">
        <button type="button" className="ghost-button" onClick={vm.cancelRemove} disabled={vm.busy === "remove"}>
          Cancel
        </button>
        <button
          type="button"
          className="hier-btn-danger"
          onClick={() => void vm.confirmRemove()}
          disabled={vm.busy === "remove"}
        >
          {vm.busy === "remove" ? "Removing…" : "Remove"}
        </button>
      </div>
    </Dialog>
  );
}
