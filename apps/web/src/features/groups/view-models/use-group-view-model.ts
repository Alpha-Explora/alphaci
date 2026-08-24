"use client";

import { useApiResource } from "@/features/groups";

import { groupsRepository } from "../data/groups-repository";
import type { GroupSummary } from "../model/groups-types";

export interface GroupViewModel {
  group: GroupSummary | null;
  status: ReturnType<typeof useApiResource<GroupSummary>>["state"];
  reload: () => void;
}

/**
 * Resolves the group every surface in this domain is scoped to.
 *
 * Domain-level rather than per-slice: all seven group surfaces open by loading
 * the same group, and duplicating that into each action slice would mean seven
 * copies of one fetch to keep in step.
 */
export function useGroupViewModel(groupId: string): GroupViewModel {
  const { data, state, reload } = useApiResource<GroupSummary>(
    () => groupsRepository.group(groupId),
    [groupId],
  );
  return { group: data, status: state, reload };
}
