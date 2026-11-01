"use client";

import { useApiResource } from "@/features/groups";
import { useAuthSession } from "@/features/auth/session";
import { newProjectHref } from "@/features/workflows";

import { groupsRepository } from "../../data/groups-repository";
import { canCreateProjectFolder } from "../../model/creation-role-rules";
import type { ProvisionedProject } from "../../model/groups-types";

export interface GroupProjectsViewModel {
  projects: ProvisionedProject[];
  status: ReturnType<typeof useApiResource<ProvisionedProject[]>>["state"];
  reload: () => void;
  /** True when the caller may create a Project in this group (Product owner, admin). */
  canManage: boolean;
  /** The Projects page, on this group, with the New Project dialog open. */
  createProjectHref: string;
}

/**
 * ViewModel for the projects a group owns.
 *
 * `canManage` follows the GLOBAL role (Product owner / admin), not the
 * per-group membership tier, mirroring the backend gate — a Developer adds
 * repositories to a Project but never creates one. The list itself is scoped
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
    canManage: canCreateProjectFolder(session?.appRole),
    createProjectHref: newProjectHref(groupId),
  };
}
