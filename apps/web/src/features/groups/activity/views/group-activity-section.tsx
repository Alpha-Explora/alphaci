"use client";

import {
  ActivityFeed,
  ActivityFilters,
  LoadingRows,
  ResourceBoundary,
} from "@/features/groups/workspace";

import { useGroupActivityViewModel } from "../view-models/use-group-activity-view-model";

/**
 * A team's activity & audit feed: filters, the first page, and "Load more".
 *
 * One component for both places the feed appears — the /activity page (for
 * the header's team) and /groups/[groupId]/activity. It used to be written
 * twice: once here, and once inline in the Teams page's section rail with its
 * own fetch in the view.
 */
export function GroupActivitySection({ groupId }: Readonly<{ groupId: string }>) {
  const vm = useGroupActivityViewModel(groupId);

  return (
    <>
      <ActivityFilters value={vm.filters} onChange={vm.setFilters} />

      {vm.status === "ready" ? (
        <>
          <ActivityFeed items={vm.items} />
          {vm.cursor ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "1rem",
              }}
            >
              <button
                type="button"
                className="ghost-button"
                onClick={() => void vm.loadMore()}
                disabled={vm.loadingMore}
              >
                {vm.loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      ) : vm.status === "loading" ? (
        <LoadingRows rows={4} />
      ) : (
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          emptyTitle="No activity yet"
          emptyMessage="Nothing matches these filters. Activity appears as members, assignments, and configuration change."
          forbiddenMessage="The activity feed is available to group leads."
        />
      )}
    </>
  );
}
