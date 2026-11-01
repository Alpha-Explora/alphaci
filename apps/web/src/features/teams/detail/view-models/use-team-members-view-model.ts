"use client";

import { useState } from "react";

import { useAuthSession } from "@/features/auth/session";
import {
  getGroupMembers,
  isGroupManagerRole,
  useApiResource,
  type GroupMember,
  type ResourceState,
} from "@/features/groups";

import type { Team } from "../../model/teams-types";

export interface TeamMembersViewModel {
  status: ResourceState;
  members: GroupMember[];
  reload: () => void;
  /** Lead or Delegated lead of this team: may add, re-role and remove. */
  canManage: boolean;
  currentUserId: string;
  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
  /** Apply a roster edit made by the table, then re-read the team's count. */
  applyChange: (updater: (current: GroupMember[]) => GroupMember[]) => void;
  /** A member added by the dialog is active at once, so it goes to the top. */
  applyAdded: (member: GroupMember) => void;
}

/**
 * ViewModel for the Teams page: the roster of the header's team.
 *
 * `onMembershipChanged` re-reads the team so the member-count badge in the
 * page heading agrees with the table after every add or removal.
 */
export function useTeamMembersViewModel(options: {
  team: Team;
  onMembershipChanged?: () => void;
}): TeamMembersViewModel {
  const { team, onMembershipChanged } = options;
  const { session } = useAuthSession();
  const [addOpen, setAddOpen] = useState(false);
  const resource = useApiResource<GroupMember[]>(() => getGroupMembers(team.id), [team.id]);

  return {
    status: resource.state,
    members: resource.data ?? [],
    reload: resource.reload,
    canManage: isGroupManagerRole(team.role),
    currentUserId: session?.user.id ?? "",
    addOpen,
    openAdd: () => setAddOpen(true),
    closeAdd: () => setAddOpen(false),
    applyChange: (updater) => {
      resource.setData((current) => updater(current ?? []));
      onMembershipChanged?.();
    },
    applyAdded: (member) => {
      resource.setData((current) => [member, ...(current ?? [])]);
      onMembershipChanged?.();
    },
  };
}
