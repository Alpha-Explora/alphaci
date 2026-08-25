"use client";

/* Preserve the existing pagination reset timing while this action is moved
 * behind its feature VM. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";

import { useApiResource } from "@/features/groups";

import { groupsRepository } from "../../data/groups-repository";
import type {
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityResponse,
} from "../../model/groups-types";

export interface GroupActivityViewModel {
  filters: GroupActivityQuery;
  setFilters: (filters: GroupActivityQuery) => void;
  /** First page plus everything paged in after it. */
  items: GroupActivityItem[];
  status: ReturnType<typeof useApiResource<GroupActivityResponse>>["state"];
  reload: () => void;
  /** Null when there is nothing more to page. */
  cursor: string | null;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * ViewModel for a group's activity feed.
 *
 * Owns the filter state and the cursor pagination. `items` is the first page
 * concatenated with pages fetched since, which is why the appended list resets
 * whenever the first-page query changes.
 */
export function useGroupActivityViewModel(
  groupId: string,
): GroupActivityViewModel {
  const [filters, setFilters] = useState<GroupActivityQuery>({});
  const [extraItems, setExtraItems] = useState<GroupActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const { data, state, reload } = useApiResource<GroupActivityResponse>(
    () => groupsRepository.activity(groupId, filters),
    [groupId, filtersKey],
    { emptyWhen: (response) => response.items.length === 0 },
  );

  // Reset pagination whenever the first-page query changes.
  useEffect(() => {
    setExtraItems([]);
    setCursor(data?.nextCursor ?? null);
  }, [data]);

  const items = useMemo(
    () => [...(data?.items ?? []), ...extraItems],
    [data, extraItems],
  );

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await groupsRepository.activity(groupId, {
        ...filters,
        cursor,
      });
      setExtraItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    filters,
    setFilters,
    items,
    status: state,
    reload,
    cursor,
    loadingMore,
    loadMore,
  };
}
