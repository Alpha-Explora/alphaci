'use client';

import { useState } from 'react';

import { useApiResource, type ResourceState } from '@/features/groups';
import { useCapabilities } from '@/features/capabilities/current';
import type { AppRole } from '@/shared/api/contracts';

import { groupsRepository } from '../../data/groups-repository';
import type {
  DeliveryProjectMember,
  GroupMember,
} from '../../data/hierarchy-contracts';
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  syncProjectMembers,
} from '../../data/project-members-api';
import {
  addedMessage,
  canManageProjectMembers,
  eligibleProjectMemberCandidates,
  memberDisplayName,
  projectMemberErrorMessage,
  removedMessage,
  resyncedMessage,
} from '../../model/project-members-rules';

type Busy = 'add' | 'remove' | 'sync' | null;

function memberListStatus(state: ResourceState, count: number): ResourceState {
  if (state === 'empty' || state === 'ready') {
    return count === 0 ? 'empty' : 'ready';
  }
  return state;
}

export interface ProjectMembersViewModel {
  /**
   * Leads and admins only: the list endpoint is theirs alone. A refusal from
   * the server (they don't manage this team) hides the panel too.
   */
  visible: boolean;
  status: ResourceState;
  reload: () => void;
  members: DeliveryProjectMember[];
  /** GitHub grants are real only in live sync mode. */
  syncLive: boolean;
  /** One sentence about the last change (what GitHub is doing about it). */
  notice: string | null;
  /** The last failed change, as one sentence. */
  error: string | null;
  busy: Busy;

  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
  candidates: GroupMember[];
  candidatesStatus: 'loading' | 'ready' | 'error';
  selectedUserIds: ReadonlySet<string>;
  toggleUser: (userId: string) => void;
  addError: string | null;
  add: () => Promise<void>;

  removeTarget: DeliveryProjectMember | null;
  askRemove: (member: DeliveryProjectMember) => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;

  resync: () => Promise<void>;
}

interface Feedback {
  notice: string | null;
  error: string | null;
}

/** Add each person through the existing permission and GitHub grant path. */
async function addSelectedMembers(
  projectId: string,
  pending: GroupMember[],
  onAdded: (member: DeliveryProjectMember) => void,
) {
  const notices: string[] = [];
  const errors: string[] = [];
  const failedIds = new Set<string>();
  for (const candidate of pending) {
    try {
      const { member, githubAccess } = await addProjectMember(
        projectId,
        candidate.userId,
      );
      onAdded(member);
      notices.push(addedMessage(member, githubAccess));
    } catch (cause) {
      failedIds.add(candidate.userId);
      errors.push(
        `${memberDisplayName(candidate)}: ${projectMemberErrorMessage(cause, 'add')}`,
      );
    }
  }
  return { notices, errors, failedIds };
}

/** Team members who could join, read when the picker opens. */
function useCandidates(groupId: string) {
  const [teamMembers, setTeamMembers] = useState<GroupMember[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  function load() {
    setStatus('loading');
    groupsRepository
      .members(groupId)
      .then((items) => {
        setTeamMembers(items);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }

  return { teamMembers, status, load };
}

/**
 * ViewModel for a Project's members panel: the list, adding team members,
 * removing one (after a confirmation), and re-running the Developers'
 * GitHub grants. Nothing loads for anyone but a lead or admin.
 */
export function useProjectMembersViewModel(input: {
  groupId: string;
  deliveryProjectId: string;
  appRole: AppRole | null;
}): ProjectMembersViewModel {
  const { groupId, deliveryProjectId, appRole } = input;
  const canManage = canManageProjectMembers(appRole);
  const { hierarchyGithubSyncMode } = useCapabilities();
  const syncLive = hierarchyGithubSyncMode === 'live';

  const resource = useApiResource<DeliveryProjectMember[]>(
    () =>
      getProjectMembers(deliveryProjectId).then((response) => response.items),
    [deliveryProjectId],
    { enabled: canManage, emptyWhen: (items) => items.length === 0 },
  );
  const roster = useCandidates(groupId);
  const [feedback, setFeedback] = useState<Feedback>({
    notice: null,
    error: null,
  });
  const [busy, setBusy] = useState<Busy>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] =
    useState<DeliveryProjectMember | null>(null);

  const members = resource.data ?? [];
  const candidates = eligibleProjectMemberCandidates(
    roster.teamMembers,
    members,
  );

  function upsert(member: DeliveryProjectMember) {
    resource.setData((current) => [
      ...(current ?? []).filter((item) => item.userId !== member.userId),
      member,
    ]);
  }

  function dropMember(userId: string) {
    resource.setData((current) =>
      (current ?? []).filter((item) => item.userId !== userId),
    );
  }

  function openAdd() {
    setSelectedUserIds(new Set());
    setAddError(null);
    setAddOpen(true);
    roster.load();
  }

  function toggleUser(userId: string) {
    setAddError(null);
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function add() {
    if (busy !== null || roster.status !== 'ready') return;
    const pending = candidates.filter((member) =>
      selectedUserIds.has(member.userId),
    );
    if (pending.length === 0) return;
    setBusy('add');
    setAddError(null);
    try {
      const { notices, errors, failedIds } = await addSelectedMembers(
        deliveryProjectId,
        pending,
        upsert,
      );
      setFeedback({
        notice: notices.join('\n') || null,
        error: null,
      });
      setSelectedUserIds(failedIds);
      if (errors.length === 0) setAddOpen(false);
      else setAddError(errors.join('\n'));
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy('remove');
    try {
      const change = await removeProjectMember(
        deliveryProjectId,
        removeTarget.userId,
      );
      dropMember(removeTarget.userId);
      setFeedback({
        notice: removedMessage(change.member, change.githubAccess),
        error: null,
      });
    } catch (cause) {
      setFeedback({
        notice: null,
        error: projectMemberErrorMessage(cause, 'remove'),
      });
    } finally {
      setRemoveTarget(null);
      setBusy(null);
    }
  }

  async function resync() {
    setBusy('sync');
    try {
      const response = await syncProjectMembers(deliveryProjectId);
      resource.setData(() => response.items);
      setFeedback({
        notice: resyncedMessage(response.repositoriesQueued),
        error: null,
      });
    } catch (cause) {
      setFeedback({
        notice: null,
        error: projectMemberErrorMessage(cause, 'sync'),
      });
    } finally {
      setBusy(null);
    }
  }

  return {
    visible:
      canManage &&
      resource.state !== 'forbidden' &&
      resource.state !== 'notfound',
    status: memberListStatus(resource.state, members.length),
    reload: resource.reload,
    members,
    syncLive,
    notice: feedback.notice,
    error: feedback.error,
    busy,
    addOpen,
    openAdd,
    closeAdd: () => {
      if (busy !== 'add') setAddOpen(false);
    },
    candidates,
    candidatesStatus: roster.status,
    selectedUserIds,
    toggleUser,
    addError,
    add,
    removeTarget,
    askRemove: setRemoveTarget,
    cancelRemove: () => setRemoveTarget(null),
    confirmRemove,
    resync,
  };
}
