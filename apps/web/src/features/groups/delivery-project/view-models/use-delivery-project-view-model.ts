"use client";

import { useState } from "react";

import { useApiResource } from "@/features/groups";
import { useAuthSession } from "@/features/auth/session";

import { groupsRepository } from "../../data/groups-repository";
import { canCreateRepositoryInProject } from "../../model/creation-role-rules";
import type {
  DeliveryProject,
  GroupSummary,
  HierarchyRepository,
} from "../../model/groups-types";

export interface DeliveryProjectViewModel {
  /** Only needed for the breadcrumb label, so its failure is not fatal. */
  group: GroupSummary | null;
  project: DeliveryProject | null;
  /** The delivery project's own load state: it gates the whole surface. */
  status: ReturnType<typeof useApiResource<DeliveryProject>>["state"];
  reload: () => void;
  repositories: HierarchyRepository[];
  repositoriesStatus: ReturnType<
    typeof useApiResource<HierarchyRepository[]>
  >["state"];
  reloadRepositories: () => void;
  /** Whether the caller may create a repository here (Developer, admin). */
  canCreateRepository: boolean;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  prependRepository: (repository: HierarchyRepository) => void;
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
  const { session } = useAuthSession();

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

  return {
    group: groupResource.data,
    project: projectResource.data,
    status: projectResource.state,
    reload: projectResource.reload,
    repositories: reposResource.data ?? [],
    repositoriesStatus: reposResource.state,
    reloadRepositories: reposResource.reload,
    canCreateRepository: canCreateRepositoryInProject(session?.appRole),
    dialogOpen,
    setDialogOpen,
    prependRepository: (repository) =>
      reposResource.setData((current) => [repository, ...(current ?? [])]),
  };
}
