"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getGroup, getGroupActivity } from "@/lib/api/client";
import type {
  GroupActivityItem,
  GroupActivityQuery,
  GroupActivityResponse,
  GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import {
  ActivityFeed,
  ActivityFilters,
} from "@/components/hierarchy/activity-feed";
import {
  Breadcrumb,
  GroupSubNav,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

function ActivityInner({ group }: { group: GroupSummary }) {
  const [filters, setFilters] = useState<GroupActivityQuery>({});
  const [extraItems, setExtraItems] = useState<GroupActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const filtersKey = JSON.stringify(filters);

  const { data, state, reload } = useApiResource<GroupActivityResponse>(
    () => getGroupActivity(group.id, filters),
    [group.id, filtersKey],
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
      const next = await getGroupActivity(group.id, { ...filters, cursor });
      setExtraItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Activity" },
        ]}
      />
      <PageHeader
        title="Activity & audit"
        subtitle="Membership changes, assignment grants and revocations, configuration writes, and GitHub synchronization results for this group."
      />
      <GroupSubNav groupId={group.id} active="activity" />

      <ActivityFilters value={filters} onChange={setFilters} />

      {state === "ready" ? (
        <>
          <ActivityFeed items={items} />
          {cursor && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : state === "loading" ? (
        <LoadingRows rows={4} />
      ) : (
        <ResourceBoundary
          state={state}
          onRetry={reload}
          emptyTitle="No activity yet"
          emptyMessage="Nothing matches these filters. Activity appears as members, assignments, and configuration change."
          forbiddenMessage="The activity feed is available to group leads."
        />
      )}
    </>
  );
}

function ActivityView() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { data, state, reload } = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );

  if (state !== "ready" || !data) {
    return (
      <>
        <Breadcrumb items={[{ label: "Projects", href: "/workflows" }, { label: "Activity" }]} />
        <ResourceBoundary
          state={state}
          onRetry={reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <ActivityInner group={data} />;
}

export default function GroupActivityPage() {
  return <HierarchyPageShell>{() => <ActivityView />}</HierarchyPageShell>;
}
