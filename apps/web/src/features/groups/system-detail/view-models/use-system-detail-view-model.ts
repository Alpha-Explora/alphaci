"use client";

import { useState } from "react";

import { useApiResource } from "@/hooks/use-hierarchy";

import { groupsRepository } from "../../data/groups-repository";
import { isGroupManagerRole } from "../../model/groups-rules";
import type {
  DeliveryProject,
  GroupSummary,
  HierarchySystem,
} from "../../model/groups-types";

export interface SystemDetailViewModel {
  /** Null while loading, or when the group could not be read. */
  group: GroupSummary | null;
  system: HierarchySystem | null;
  /** The system's own load state: it gates the whole surface. */
  status: ReturnType<typeof useApiResource<HierarchySystem>>["state"];
  reload: () => void;
  deliveryProjects: DeliveryProject[];
  deliveryProjectsStatus: ReturnType<
    typeof useApiResource<DeliveryProject[]>
  >["state"];
  reloadDeliveryProjects: () => void;
  /** Whether the caller may create a delivery project here. */
  canManage: boolean;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  prependDeliveryProject: (project: DeliveryProject) => void;
}

/**
 * ViewModel for one system inside a group.
 *
 * The group, the system and its delivery projects load independently: the page
 * is usable as soon as the system resolves, and the group is only needed for the
 * breadcrumb label and the manage check.
 */
export function useSystemDetailViewModel(
  groupId: string,
  systemId: string,
): SystemDetailViewModel {
  const [dialogOpen, setDialogOpen] = useState(false);

  const groupResource = useApiResource<GroupSummary>(
    () => groupsRepository.group(groupId),
    [groupId],
  );
  const systemResource = useApiResource<HierarchySystem>(
    () => groupsRepository.system(systemId),
    [systemId],
  );
  const projectsResource = useApiResource<DeliveryProject[]>(
    () => groupsRepository.systemDeliveryProjects(systemId),
    [systemId],
    { emptyWhen: (projects) => projects.length === 0 },
  );

  return {
    group: groupResource.data,
    system: systemResource.data,
    status: systemResource.state,
    reload: systemResource.reload,
    deliveryProjects: projectsResource.data ?? [],
    deliveryProjectsStatus: projectsResource.state,
    reloadDeliveryProjects: projectsResource.reload,
    canManage: isGroupManagerRole(groupResource.data?.role),
    dialogOpen,
    setDialogOpen,
    prependDeliveryProject: (project) =>
      projectsResource.setData((current) => [project, ...(current ?? [])]),
  };
}
