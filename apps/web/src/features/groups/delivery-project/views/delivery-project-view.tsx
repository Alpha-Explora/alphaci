"use client";

import { useParams } from "next/navigation";

import {
  CreateRepositoryDialog,
  HierarchyPageShell,
  LifecycleStatusBadge,
  RepositoryTable,
} from "@/features/groups/workspace";
import {
  Breadcrumb,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/features/groups/workspace";

import { useDeliveryProjectViewModel } from "../view-models/use-delivery-project-view-model";

function DeliveryProjectDetail({
  groupId,
  deliveryProjectId,
}: Readonly<{ groupId: string; deliveryProjectId: string }>) {
  const vm = useDeliveryProjectViewModel(groupId, deliveryProjectId);

  if (vm.status !== "ready" || !vm.project) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "Delivery project" },
          ]}
        />
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          notFoundTitle="Delivery project not found"
          notFoundMessage="This delivery project doesn't exist, or you're not a member of its group."
        />
      </>
    );
  }

  const project = vm.project;
  const createButton = vm.canManage ? (
    <button
      type="button"
      className="primary-button"
      onClick={() => vm.setDialogOpen(true)}
    >
      Create repository
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: vm.group?.name ?? "Group", href: `/groups/${groupId}` },
          { label: "Projects", href: `/groups/${groupId}/systems` },
          { label: project.name },
        ]}
      />
      <PageHeader
        title={project.name}
        subtitle={project.description ?? undefined}
        actions={
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <LifecycleStatusBadge status={project.status} />
            {createButton}
          </div>
        }
      />

      {vm.repositoriesStatus === "ready" ? (
        <>
          <SectionHeader title="Repositories" count={vm.repositories.length} />
          <RepositoryTable groupId={groupId} repositories={vm.repositories} />
        </>
      ) : vm.repositoriesStatus === "loading" ? (
        <LoadingRows rows={2} />
      ) : (
        <ResourceBoundary
          state={vm.repositoriesStatus}
          onRetry={vm.reloadRepositories}
          emptyTitle="No repositories yet"
          emptyMessage={
            vm.canManage
              ? "Create a repository to provision a GitHub repo and start assigning members."
              : "You don't have access to any repositories in this delivery project yet."
          }
          emptyAction={createButton}
        />
      )}

      {vm.canManage && (
        <CreateRepositoryDialog
          open={vm.dialogOpen}
          deliveryProjectId={project.id}
          onClose={() => vm.setDialogOpen(false)}
          onCreated={vm.prependRepository}
        />
      )}
    </>
  );
}

/** Public view for the delivery project route. */
export function DeliveryProjectView() {
  const params = useParams<{ groupId: string; deliveryProjectId: string }>();
  return (
    <HierarchyPageShell>
      {() => (
        <DeliveryProjectDetail
          groupId={params.groupId}
          deliveryProjectId={params.deliveryProjectId}
        />
      )}
    </HierarchyPageShell>
  );
}
