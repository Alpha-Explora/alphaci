"use client";

import { useState } from "react";

import { useApiResource } from "@/hooks/use-hierarchy";

import { groupsRepository } from "../../data/groups-repository";
import type {
  RepositoryAccessStatus,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
} from "../../model/groups-types";

export interface RepositoryAccessViewModel {
  assignments: RepositoryAssignment[];
  accessStatus: RepositoryAccessStatus[];
  /** Combined: the tab needs both resources before it can render. */
  status: ReturnType<typeof useApiResource<RepositoryAssignment[]>>["state"];
  reload: () => void;
  assignOpen: boolean;
  setAssignOpen: (open: boolean) => void;
  applyAssignments: (
    updater: (current: RepositoryAssignment[]) => RepositoryAssignment[],
  ) => void;
  /** Upserts the assignment and re-reads access, which the grant changes. */
  onAssigned: (assignment: RepositoryAssignment) => void;
}

/**
 * ViewModel for a repository's member access.
 *
 * Both resources are gated on `canManage`: a member without manage rights never
 * triggers the fetches, matching what the route did with `{ enabled }`.
 */
export function useRepositoryAccessViewModel(
  repositoryId: string,
  canManage: boolean,
): RepositoryAccessViewModel {
  const [assignOpen, setAssignOpen] = useState(false);

  const assignmentsResource = useApiResource<RepositoryAssignment[]>(
    () => groupsRepository.repositoryAssignments(repositoryId),
    [repositoryId],
    { enabled: canManage },
  );
  const accessResource = useApiResource<RepositoryAccessStatusResponse>(
    () => groupsRepository.repositoryAccessStatus(repositoryId),
    [repositoryId],
    { enabled: canManage },
  );

  // Either resource still loading means the tab is not ready; an assignments
  // failure is the one the tab surfaces, as before.
  const status =
    assignmentsResource.state === "loading" ||
    accessResource.state === "loading"
      ? "loading"
      : assignmentsResource.state;

  return {
    assignments: assignmentsResource.data ?? [],
    accessStatus: accessResource.data?.items ?? [],
    status,
    reload: assignmentsResource.reload,
    assignOpen,
    setAssignOpen,
    applyAssignments: (updater) =>
      assignmentsResource.setData((current) => updater(current ?? [])),
    onAssigned: (assignment) => {
      assignmentsResource.setData((current) => [
        assignment,
        ...(current ?? []).filter((item) => item.id !== assignment.id),
      ]);
      accessResource.reload();
    },
  };
}
