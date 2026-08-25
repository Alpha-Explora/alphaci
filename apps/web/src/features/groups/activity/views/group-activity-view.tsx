"use client";


import {
  ActivityFeed,
  ActivityFilters,
  HierarchyPageShell,
} from "@/features/groups/workspace";
import {
  Breadcrumb,
  GroupSubNav,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/features/groups/workspace";

import type { GroupSummary } from "../../model/groups-types";
import { useGroupRouteViewModel, useGroupViewModel } from "@/features/groups";
import { useGroupActivityViewModel } from "../view-models/use-group-activity-view-model";

function ActivityInner({ group }: Readonly<{ group: GroupSummary }>) {
  const vm = useGroupActivityViewModel(group.id);

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

      <ActivityFilters value={vm.filters} onChange={vm.setFilters} />

      {vm.status === "ready" ? (
        <>
          <ActivityFeed items={vm.items} />
          {vm.cursor && (
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
          )}
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

function ActivityResolver() {
  const { groupId } = useGroupRouteViewModel();
  const vm = useGroupViewModel(groupId);

  if (vm.status !== "ready" || !vm.group) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "Activity" },
          ]}
        />
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <ActivityInner group={vm.group} />;
}

/** Public view for the group activity route. */
export function GroupActivityView() {
  return <HierarchyPageShell>{() => <ActivityResolver />}</HierarchyPageShell>;
}
