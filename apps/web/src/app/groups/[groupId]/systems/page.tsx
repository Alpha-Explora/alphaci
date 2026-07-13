"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { getGroup, getGroupSystems } from "@/lib/api/client";
import type {
  GroupSummary,
  HierarchySystem,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { CreateSystemDialog } from "@/components/hierarchy/create-system-dialog";
import { SystemTree } from "@/components/hierarchy/system-tree";
import {
  Breadcrumb,
  GroupSubNav,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/components/hierarchy/primitives";

function SystemsInner({ group }: { group: GroupSummary }) {
  const canManage = isGroupManagerRole(group.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, state, reload, setData } = useApiResource<HierarchySystem[]>(
    () => getGroupSystems(group.id),
    [group.id],
    { emptyWhen: (systems) => systems.length === 0 },
  );

  const systems = data ?? [];
  const createButton = canManage ? (
    <button
      type="button"
      className="primary-button"
      onClick={() => setDialogOpen(true)}
    >
      Create system
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Groups", href: "/groups" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Systems" },
        ]}
      />
      <PageHeader
        title="Systems & delivery projects"
        subtitle="The system → delivery project → repository hierarchy owned by this group. Expand a system to see its delivery projects."
        actions={createButton}
      />
      <GroupSubNav groupId={group.id} active="systems" />

      {state === "ready" ? (
        <>
          <SectionHeader title="Systems" count={systems.length} />
          <SystemTree groupId={group.id} systems={systems} canManage={canManage} />
        </>
      ) : state === "loading" ? (
        <LoadingRows rows={3} />
      ) : (
        <ResourceBoundary
          state={state}
          onRetry={reload}
          emptyTitle="No systems yet"
          emptyMessage={
            canManage
              ? "Create a system to start building the delivery project and repository hierarchy."
              : "This group has no systems yet."
          }
          emptyAction={createButton}
        />
      )}

      {canManage && (
        <CreateSystemDialog
          open={dialogOpen}
          groupId={group.id}
          onClose={() => setDialogOpen(false)}
          onCreated={(system) => setData((current) => [system, ...(current ?? [])])}
        />
      )}
    </>
  );
}

function SystemsView() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { data, state, reload } = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );

  if (state !== "ready" || !data) {
    return (
      <>
        <Breadcrumb items={[{ label: "Groups", href: "/groups" }, { label: "Systems" }]} />
        <ResourceBoundary
          state={state}
          onRetry={reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <SystemsInner group={data} />;
}

export default function GroupSystemsPage() {
  return <HierarchyPageShell>{() => <SystemsView />}</HierarchyPageShell>;
}
