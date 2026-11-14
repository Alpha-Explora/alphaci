'use client';

import { useEffect, useRef, type RefObject } from 'react';

import {
  Avatar,
  Dialog,
  FormDialog,
  LoadingRows,
  ResourceBoundary,
  SectionHeader,
} from '@/features/groups/workspace';

import './project-members.css';
import type {
  DeliveryProjectMember,
  DeliveryProjectMemberKind,
  GroupMember,
} from '../../model/groups-types';
import {
  candidateKind,
  MEMBER_KIND_LABELS,
  memberDisplayName,
  opensOnProjectMembers,
  PROJECT_MEMBERS_ANCHOR,
  RESYNC_NOTE,
} from '../../model/project-members-rules';
import type { ProjectMembersViewModel } from '../view-models/use-project-members-view-model';

type PanelProps = Readonly<{ vm: ProjectMembersViewModel }>;

/**
 * `page`: a section of the Project page, under its own heading, opened by a
 * `#members` link. `section`: one block of the Project screen on /workflows,
 * labelled like its neighbours, with a one-line empty state.
 */
export type ProjectMembersLayout = 'page' | 'section';

const NO_MEMBERS_MESSAGE =
  "Add Developers and QA Team from this Project's team.";
const NO_MEMBERS_LINE = `No members yet. ${NO_MEMBERS_MESSAGE}`;

/**
 * The Project's members: Developers (GitHub Write on the repositories created
 * here) and QA Team (no GitHub write). Leads and admins only — the caller
 * renders nothing for anyone else.
 */
export function ProjectMembersPanel({
  vm,
  layout = 'page',
}: Readonly<{ vm: ProjectMembersViewModel; layout?: ProjectMembersLayout }>) {
  const sectionRef = useRef<HTMLElement | null>(null);
  // Any settled list counts: an empty one ("No members yet") is where a lead
  // most often arrives to add the first member.
  useScrollIntoViewWhenLinked(
    sectionRef,
    layout === 'page' && vm.visible && vm.status !== 'loading',
  );
  if (!vm.visible) return null;
  return (
    <section
      id={PROJECT_MEMBERS_ANCHOR}
      ref={sectionRef}
      className="project-members"
      data-layout={layout}
      aria-label="Project members"
    >
      <SectionHeader
        title="Project members"
        count={vm.status === 'ready' ? vm.members.length : undefined}
        actions={<PanelActions vm={vm} />}
      />
      <Feedback notice={vm.notice} error={vm.error} />
      <MemberList vm={vm} layout={layout} />
      <AddMemberDialog vm={vm} />
      <RemoveMemberDialog vm={vm} />
    </section>
  );
}

/** The reader's own scrolling ends the follow-up. */
const READER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
const FOLLOW_MS = 3000;

/**
 * Scroll the section to the top now, and again while the page around it
 * still grows (Requirements and QA load after the members, and until they
 * do the page is too short to scroll that far). Stops after a few seconds
 * or as soon as the reader scrolls. Returns the cleanup.
 */
function followIntoView(section: HTMLElement): () => void {
  const scroll = () => section.scrollIntoView?.({ block: 'start' });
  scroll();
  const page = section.parentElement;
  if (!page || typeof ResizeObserver === 'undefined') return () => undefined;
  const observer = new ResizeObserver(scroll);
  observer.observe(page);
  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    for (const type of READER_INPUT) window.removeEventListener(type, stop);
  };
  const timer = window.setTimeout(stop, FOLLOW_MS);
  for (const type of READER_INPUT)
    window.addEventListener(type, stop, { passive: true });
  return stop;
}

/**
 * Opened through a `#members` link (the Members action on a Project in the
 * explorer): bring the panel into view once its list has loaded. It renders
 * after the page's own data, so the browser's jump to the anchor finds
 * nothing. Once per mount, so a reload after an add does not scroll again.
 */
function useScrollIntoViewWhenLinked(
  ref: RefObject<HTMLElement | null>,
  ready: boolean,
) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    if (!opensOnProjectMembers(window.location.hash) || !ref.current) return;
    return followIntoView(ref.current);
  }, [ready, ref]);
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
          {vm.busy === 'sync' ? 'Re-syncing…' : 'Re-sync GitHub access'}
        </button>
      ) : null}
      <button
        type="button"
        className="hier-btn-sm project-members__add"
        onClick={vm.openAdd}
        disabled={vm.busy !== null}
      >
        Add member
      </button>
    </div>
  );
}

export function KindBadge({
  kind,
}: Readonly<{ kind: DeliveryProjectMemberKind }>) {
  return (
    <span
      className={`hier-badge project-members__kind project-members__kind--${kind}`}
    >
      {MEMBER_KIND_LABELS[kind]}
    </span>
  );
}

function Feedback({
  notice,
  error,
}: Readonly<{ notice: string | null; error: string | null }>) {
  if (error) {
    return (
      <p className="error-text project-members__feedback" role="alert">
        {error}
      </p>
    );
  }
  return notice ? (
    <p
      className="project-members__feedback project-members__notice"
      role="status"
    >
      {notice}
    </p>
  ) : null;
}

function MemberList({
  vm,
  layout,
}: Readonly<{ vm: ProjectMembersViewModel; layout: ProjectMembersLayout }>) {
  if (vm.status === 'loading') return <LoadingRows rows={2} />;
  if (vm.status === 'empty' && layout === 'section') {
    return <p className="project-members__empty">{NO_MEMBERS_LINE}</p>;
  }
  if (vm.status !== 'ready') {
    return (
      <ResourceBoundary
        state={vm.status}
        onRetry={vm.reload}
        emptyTitle="No members yet"
        emptyMessage={NO_MEMBERS_MESSAGE}
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

function MemberRow({
  member,
  vm,
}: Readonly<{ member: DeliveryProjectMember; vm: ProjectMembersViewModel }>) {
  const name = memberDisplayName(member);
  return (
    <div className="hier-row">
      <div className="hier-row-identity">
        <Avatar
          login={member.login}
          name={member.name}
          avatarUrl={member.avatarUrl}
        />
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

function candidateStatus(vm: ProjectMembersViewModel): string | null {
  if (vm.candidatesStatus === 'loading') return 'Loading team members…';
  if (vm.candidatesStatus === 'error')
    return 'Team members could not be loaded';
  return vm.candidates.length === 0
    ? 'Everyone eligible is already in this Project'
    : null;
}

function CandidatePicker({ vm }: PanelProps) {
  const status = candidateStatus(vm);
  if (status)
    return (
      <p className="hier-field-hint" role="status">
        {status}
      </p>
    );
  return (
    <fieldset
      className="project-members-dialog__picker"
      disabled={vm.busy === 'add'}
    >
      <legend className="hier-field-label">Team members</legend>
      <div className="project-members-dialog__choices">
        {vm.candidates.map((member) => (
          <label key={member.userId} className="project-members-dialog__choice">
            <input
              type="checkbox"
              checked={vm.selectedUserIds.has(member.userId)}
              onChange={() => vm.toggleUser(member.userId)}
            />
            <span>{candidateLabel(member)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AddMemberDialog({ vm }: PanelProps) {
  const selectedCount = vm.selectedUserIds.size;
  return (
    <FormDialog
      open={vm.addOpen}
      onClose={vm.closeAdd}
      title="Add member"
      description="Choose one or more Developers or QA Team members from this Project's team."
      submitLabel={
        selectedCount > 1 ? `Add ${selectedCount} members` : 'Add member'
      }
      submitting={vm.busy === 'add'}
      error={vm.addError}
      canSubmit={selectedCount > 0 && vm.candidatesStatus === 'ready'}
      onSubmit={() => void vm.add()}
    >
      <div className="hier-field project-members-dialog">
        <CandidatePicker vm={vm} />
        <span className="hier-field-hint">
          Developers get GitHub Write on repositories created in this Project
          when live sync is on. QA Team get no GitHub write access.
        </span>
      </div>
    </FormDialog>
  );
}

function removalEffect(
  member: DeliveryProjectMember,
  syncLive: boolean,
): string {
  if (member.memberKind === 'qa')
    return "They leave this Project's QA. Nothing changes on GitHub.";
  return syncLive
    ? 'ALPHACI removes their GitHub Write on the repositories created in this Project.'
    : 'Live GitHub sync is off, so no GitHub access was granted and nothing changes on GitHub.';
}

function RemoveMemberDialog({ vm }: PanelProps) {
  const member = vm.removeTarget;
  return (
    <Dialog
      open={member !== null}
      onClose={vm.cancelRemove}
      title={member ? `Remove ${memberDisplayName(member)}?` : 'Remove member?'}
      description={member ? removalEffect(member, vm.syncLive) : undefined}
    >
      <div className="hier-dialog-actions project-members__confirm">
        <button
          type="button"
          className="ghost-button"
          onClick={vm.cancelRemove}
          disabled={vm.busy === 'remove'}
        >
          Cancel
        </button>
        <button
          type="button"
          className="hier-btn-danger"
          onClick={() => void vm.confirmRemove()}
          disabled={vm.busy === 'remove'}
        >
          {vm.busy === 'remove' ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </Dialog>
  );
}
