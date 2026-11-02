'use client';

import { useMemo, useState } from 'react';

import { useApiResource } from '@/features/groups';

import { groupsRepository } from '../../data/groups-repository';
import type {
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityResponse,
} from '../../model/groups-types';

export interface GroupActivityViewModel {
  filters: GroupActivityQuery;
  setFilters: (filters: GroupActivityQuery) => void;
  /** First page plus everything paged in after it. */
  items: GroupActivityItem[];
  status: ReturnType<typeof useApiResource<GroupActivityResponse>>['state'];
  reload: () => void;
  /** Null when there is nothing more to page. */
  cursor: string | null;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

/** Pages fetched after the first one, kept with the first page they follow. */
interface LaterPages {
  firstPage: GroupActivityResponse | null;
  items: GroupActivityItem[];
  cursor: string | null;
}

/**
 * ViewModel for a group's activity feed.
 *
 * Owns the filter state and the cursor pagination. `items` is the first page
 * concatenated with pages fetched since. Those pages are kept with the first
 * page they follow, so a new first page (a changed query, a reload) starts the
 * list and the cursor over.
 */
export function useGroupActivityViewModel(
  groupId: string,
): GroupActivityViewModel {
  const [filters, setFilters] = useState<GroupActivityQuery>({});
  const [laterPages, setLaterPages] = useState<LaterPages | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const { data, state, reload } = useApiResource<GroupActivityResponse>(
    () => groupsRepository.activity(groupId, filters),
    [groupId, filtersKey],
    { emptyWhen: (response) => response.items.length === 0 },
  );

  // Pages fetched after an older first page no longer apply.
  const later = laterPages?.firstPage === data ? laterPages : null;
  const cursor = later ? later.cursor : (data?.nextCursor ?? null);

  const items = useMemo(
    () => [...(data?.items ?? []), ...(later?.items ?? [])],
    [data, later],
  );

  async function loadMore() {
    if (!cursor) return;
    const firstPage = data;
    setLoadingMore(true);
    try {
      const next = await groupsRepository.activity(groupId, {
        ...filters,
        cursor,
      });
      setLaterPages((current) => ({
        firstPage,
        items: [
          ...(current?.firstPage === firstPage ? current.items : []),
          ...next.items,
        ],
        cursor: next.nextCursor,
      }));
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
