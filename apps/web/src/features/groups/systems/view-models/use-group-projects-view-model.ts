"use client";

import { useApiResource } from "@/features/groups";
import { useAuthSession } from "@/features/auth/session";

import { groupsRepository } from "../../data/groups-repository";
import { isGlobalCreatorRole } from "../../model/groups-rules";
import type { ProvisionedProject } from "../../model/groups-types";

export interface GroupProjectsViewModel {
  projects: ProvisionedProject[];
  status: ReturnType<typeof useApiResource<ProvisionedProject[]>>["state"];
  reload: () => void;
  /** True when the caller may create a project in this group. */
  canManage: boolean;
}

/**
 * ViewModel for the projects a group owns.
 *
 * `canManage` follows the GLOBAL role (Lead/Admin), not the per-group
 * membership tier, mirroring the backend gate — a plain member cannot create a
 * project even in a group they belong to. The list itself is scoped
 * server-side: managers and admins see everything, a member sees only the
 * repositories they are assigned to.
 */
export function useGroupProjectsViewModel(
  groupId: string,
): GroupProjectsViewModel {
  const { session } = useAuthSession();
  const { data, state, reload } = useApiResource<ProvisionedProject[]>(
    () => groupsRepository.groupProjects(groupId),
    [groupId],
    { emptyWhen: (projects) => projects.length === 0 },
  );

  return {
    projects: data ?? [],
    status: state,
    reload,
    canManage: isGlobalCreatorRole(session?.appRole),
  };
}
