'use client';

import { useApiResource } from '@/features/groups';
import { useAuthSession } from '@/features/auth/session';
import {
  projectFoldersRepository,
  type ProjectFoldersSnapshot,
} from '@/features/teams/project-folders';
import { newProjectHref } from '@/features/workflows';

import { canCreateProjectFolder } from '../../model/creation-role-rules';

export interface GroupProjectsViewModel {
  projects: ProjectFoldersSnapshot['folders'];
  unfiled: ProjectFoldersSnapshot['unfiled'];
  status: ReturnType<typeof useApiResource<ProjectFoldersSnapshot>>['state'];
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
 * server-side by the Projects explorer.
 */
export function useGroupProjectsViewModel(
  groupId: string,
): GroupProjectsViewModel {
  const { session } = useAuthSession();
  const { data, state, reload } = useApiResource<ProjectFoldersSnapshot>(
    () => projectFoldersRepository.list(groupId),
    [groupId],
    { emptyWhen: ({ folders, unfiled }) => !folders.length && !unfiled.length },
  );

  return {
    projects: data?.folders ?? [],
    unfiled: data?.unfiled ?? [],
    status: state,
    reload,
    canManage: canCreateProjectFolder(session?.appRole),
    createProjectHref: newProjectHref(groupId),
  };
}
