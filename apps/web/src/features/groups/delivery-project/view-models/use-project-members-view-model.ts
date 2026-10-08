"use client";

import { useState } from "react";

import { useApiResource, type ResourceState } from "@/features/groups";
import { useCapabilities } from "@/features/capabilities/current";
import type { AppRole } from "@/shared/api/contracts";

import { groupsRepository } from "../../data/groups-repository";
import type { DeliveryProjectMember, GroupMember } from "../../data/hierarchy-contracts";
import {
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
  syncProjectMembers,
} from "../../data/project-members-api";
import {
  addedMessage,
  canManageProjectMembers,
  eligibleProjectMemberCandidates,
  projectMemberErrorMessage,
  removedMessage,
  resyncedMessage,
} from "../../model/project-members-rules";

type Busy = "add" | "remove" | "sync" | null;

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
  candidatesStatus: "loading" | "ready" | "error";
  selectedUserId: string;
  setSelectedUserId: (userId: string) => void;
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

/** Team members who could join, read when the picker opens. */
function useCandidates(groupId: string) {
  const [teamMembers, setTeamMembers] = useState<GroupMember[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  function load() {
    setStatus("loading");
    groupsRepository
      .members(groupId)
      .then((items) => {
        setTeamMembers(items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  return { teamMembers, status, load };
}

/**
 * ViewModel for a Project's members panel: the list, adding a team member,
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
  const syncLive = hierarchyGithubSyncMode === "live";

  const resource = useApiResource<DeliveryProjectMember[]>(
    () => getProjectMembers(deliveryProjectId).then((response) => response.items),
    [deliveryProjectId],
    { enabled: canManage, emptyWhen: (items) => items.length === 0 },
  );
  const candidates = useCandidates(groupId);
  const [feedback, setFeedback] = useState<Feedback>({ notice: null, error: null });
  const [busy, setBusy] = useState<Busy>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<DeliveryProjectMember | null>(null);

  const members = resource.data ?? [];

  function upsert(member: DeliveryProjectMember) {
    resource.setData((current) => [
      ...(current ?? []).filter((item) => item.userId !== member.userId),
      member,
    ]);
  }

  function dropMember(userId: string) {
    resource.setData((current) => (current ?? []).filter((item) => item.userId !== userId));
  }

  function openAdd() {
    setSelectedUserId("");
    setAddError(null);
    setAddOpen(true);
    candidates.load();
  }

  async function add() {
    if (!selectedUserId) {
      setAddError("Choose a team member to add.");
      return;
    }
    setBusy("add");
    setAddError(null);
    try {
      const change = await addProjectMember(deliveryProjectId, selectedUserId);
      upsert(change.member);
      setFeedback({ notice: addedMessage(change.member, change.githubAccess), error: null });
      setAddOpen(false);
    } catch (cause) {
      setAddError(projectMemberErrorMessage(cause, "add"));
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy("remove");
    try {
      const change = await removeProjectMember(deliveryProjectId, removeTarget.userId);
      dropMember(removeTarget.userId);
      setFeedback({ notice: removedMessage(change.member, change.githubAccess), error: null });
    } catch (cause) {
      setFeedback({ notice: null, error: projectMemberErrorMessage(cause, "remove") });
    } finally {
      setRemoveTarget(null);
      setBusy(null);
    }
  }

  async function resync() {
    setBusy("sync");
    try {
      const response = await syncProjectMembers(deliveryProjectId);
      resource.setData(() => response.items);
      setFeedback({ notice: resyncedMessage(response.repositoriesQueued), error: null });
    } catch (cause) {
      setFeedback({ notice: null, error: projectMemberErrorMessage(cause, "sync") });
    } finally {
      setBusy(null);
    }
  }

  return {
    visible: canManage && resource.state !== "forbidden" && resource.state !== "notfound",
    status: resource.state,
    reload: resource.reload,
    members,
    syncLive,
    notice: feedback.notice,
    error: feedback.error,
    busy,
    addOpen,
    openAdd,
    closeAdd: () => setAddOpen(false),
    candidates: eligibleProjectMemberCandidates(candidates.teamMembers, members),
    candidatesStatus: candidates.status,
    selectedUserId,
    setSelectedUserId,
    addError,
    add,
    removeTarget,
    askRemove: setRemoveTarget,
    cancelRemove: () => setRemoveTarget(null),
    confirmRemove,
    resync,
  };
}
