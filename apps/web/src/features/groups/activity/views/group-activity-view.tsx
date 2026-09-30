"use client";


import {
  Breadcrumb,
  GroupSubNav,
  HierarchyPageShell,
  PageHeader,
  ResourceBoundary,
} from "@/features/groups/workspace";

import type { GroupSummary } from "../../model/groups-types";
import { useGroupRouteViewModel, useGroupViewModel } from "@/features/groups";
import { GroupActivitySection } from "./group-activity-section";

function ActivityInner({ group }: Readonly<{ group: GroupSummary }>) {
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

      <GroupActivitySection groupId={group.id} />
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
