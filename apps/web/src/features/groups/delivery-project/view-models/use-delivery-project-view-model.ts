'use client';

import { useState } from 'react';

import { useApiResource } from '@/features/groups';
import { useAuthSession } from '@/features/auth/session';
import { useCapabilities } from '@/features/capabilities/current';
import type { AppRole } from '@/shared/api/contracts';
import { ApiError } from '@/shared/api/request';
import { serverErrorMessage } from '@/shared/api/error-message';

import { groupsRepository } from '../../data/groups-repository';
import { canCreateRepositoryInProject } from '../../model/creation-role-rules';
import { canManageProjectMembers } from '../../model/project-members-rules';
import type {
  DeliveryProject,
  GroupSummary,
  HierarchyRepository,
} from '../../model/groups-types';

export interface DeliveryProjectViewModel {
  /** Only needed for the breadcrumb label, so its failure is not fatal. */
  group: GroupSummary | null;
  project: DeliveryProject | null;
  /** The delivery project's own load state: it gates the whole surface. */
  status: ReturnType<typeof useApiResource<DeliveryProject>>['state'];
  reload: () => void;
  repositories: HierarchyRepository[];
  repositoriesStatus: ReturnType<
    typeof useApiResource<HierarchyRepository[]>
  >['state'];
  reloadRepositories: () => void;
  /** Whether the caller may create a repository here (Developer, admin). */
  canCreateRepository: boolean;
  canReopen: boolean;
  reopening: boolean;
  reopenError: string | null;
  reopen: () => Promise<void>;
  /** The caller's app role, for the Project's requirements and QA. */
  appRole: AppRole | null;
  /** Requirements and QA exist only with the qaChecklists capability. */
  qaEnabled: boolean;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  prependRepository: (repository: HierarchyRepository) => void;
}

function availableProjectActions(
  project: DeliveryProject | null,
  group: GroupSummary | null,
  appRole: AppRole | null,
) {
  return {
    canCreateRepository:
      project?.status === 'active' && canCreateRepositoryInProject(appRole),
    canReopen:
      project?.status === 'archived' &&
      group?.status === 'active' &&
      canManageProjectMembers(appRole),
  };
}

/**
 * ViewModel for one delivery project.
 *
 * `canCreateRepository` follows the GLOBAL role (Developer / admin), mirroring
 * the backend gate — not the per-group membership tier. A Product owner
 * creates the Project; Developers fill it with repositories.
 */
export function useDeliveryProjectViewModel(
  groupId: string,
  deliveryProjectId: string,
): DeliveryProjectViewModel {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const { session } = useAuthSession();
  const appRole = session?.appRole ?? null;
  const { qaChecklistsEnabled } = useCapabilities();

  const groupResource = useApiResource<GroupSummary>(
    () => groupsRepository.group(groupId),
    [groupId],
  );
  const projectResource = useApiResource<DeliveryProject>(
    () => groupsRepository.deliveryProject(deliveryProjectId),
    [deliveryProjectId],
  );
  const reposResource = useApiResource<HierarchyRepository[]>(
    () => groupsRepository.deliveryProjectRepositories(deliveryProjectId),
    [deliveryProjectId],
    { emptyWhen: (repos) => repos.length === 0 },
  );

  async function reopen() {
    setReopening(true);
    setReopenError(null);
    try {
      const reopened =
        await groupsRepository.reopenDeliveryProject(deliveryProjectId);
      projectResource.setData(() => reopened);
    } catch (cause) {
      const message =
        cause instanceof ApiError
          ? serverErrorMessage(cause.status, cause.details)
          : null;
      setReopenError(message ?? 'Could not reopen this Project.');
    } finally {
      setReopening(false);
    }
  }

  return {
    group: groupResource.data,
    project: projectResource.data,
    status: projectResource.state,
    reload: projectResource.reload,
    repositories: reposResource.data ?? [],
    repositoriesStatus: reposResource.state,
    reloadRepositories: reposResource.reload,
    ...availableProjectActions(
      projectResource.data,
      groupResource.data,
      appRole,
    ),
    reopening,
    reopenError,
    reopen,
    appRole,
    qaEnabled:
      qaChecklistsEnabled &&
      Boolean(appRole) &&
      projectResource.data?.canAccessQa !== false,
    dialogOpen,
    setDialogOpen,
    prependRepository: (repository) =>
      reposResource.setData((current) => [repository, ...(current ?? [])]),
  };
}
