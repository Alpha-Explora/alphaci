"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { getGroup, getGroupSystems } from "@/lib/api/client";
import type {
  GroupSummary,
  HierarchySystem,
} from "@/lib/api/hierarchy-contracts";
import { isGlobalCreatorRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { useAuthSession } from "@/hooks/use-auth-session";
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
  const { session } = useAuthSession();
  // Create capability follows the GLOBAL role (Lead/Admin), not the per-group
  // membership tier — mirrors the backend gate. Members can't create systems.
  const canManage = isGlobalCreatorRole(session?.appRole);
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
      Create project
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Groups", href: "/groups" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Projects" },
        ]}
      />
      <PageHeader
        title="Projects"
        subtitle="Projects owned by this group. Creating a project provisions its GitHub repository."
        actions={createButton}
      />
      <GroupSubNav groupId={group.id} active="systems" />

      {state === "ready" ? (
        <>
          <SectionHeader title="Projects" count={systems.length} />
          <SystemTree groupId={group.id} systems={systems} canManage={canManage} />
        </>
      ) : state === "loading" ? (
        <LoadingRows rows={3} />
      ) : (
        <ResourceBoundary
          state={state}
          onRetry={reload}
          emptyTitle="No projects yet"
          emptyMessage={
            canManage
              ? "Create a project to provision its GitHub repository."
              : "This group has no projects yet."
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
