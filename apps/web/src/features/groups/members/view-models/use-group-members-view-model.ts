"use client";

import { useState } from "react";

import { useApiResource } from "@/hooks/use-hierarchy";

import { groupsRepository } from "../../data/groups-repository";
import { isGroupManagerRole } from "../../model/groups-rules";
import type { GroupMember, GroupSummary } from "../../model/groups-types";

export interface GroupMembersViewModel {
  members: GroupMember[];
  status: ReturnType<typeof useApiResource<GroupMember[]>>["state"];
  reload: () => void;
  /** Whether the caller may add or remove members. */
  canManage: boolean;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  /** Applied optimistically by the member table and the add dialog. */
  applyMembers: (updater: (current: GroupMember[]) => GroupMember[]) => void;
  prependMember: (member: GroupMember) => void;
}

/** ViewModel for a group's member list. */
export function useGroupMembersViewModel(
  group: GroupSummary,
): GroupMembersViewModel {
  const [addOpen, setAddOpen] = useState(false);
  const resource = useApiResource<GroupMember[]>(
    () => groupsRepository.members(group.id),
    [group.id],
  );

  return {
    members: resource.data ?? [],
    status: resource.state,
    reload: resource.reload,
    canManage: isGroupManagerRole(group.role),
    addOpen,
    setAddOpen,
    applyMembers: (updater) =>
      resource.setData((current) => updater(current ?? [])),
    prependMember: (member) =>
      resource.setData((current) => [member, ...(current ?? [])]),
  };
}
