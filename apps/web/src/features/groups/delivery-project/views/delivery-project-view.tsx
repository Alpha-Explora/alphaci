"use client";

import type { ReactNode } from "react";
import {
  useGroupDeliveryProjectRouteViewModel,
  type HierarchyRepository,
  type ResourceState,
} from "@/features/groups";
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
import { groupDisplayName } from "../../model/groups-rules";

function HierarchyNotReady({
  crumb,
  state,
  onRetry,
  notFoundTitle,
  notFoundMessage,
}: Readonly<{
  crumb: string;
  state: ResourceState;
  onRetry: () => void;
  notFoundTitle: string;
  notFoundMessage: string;
}>) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: crumb },
        ]}
      />
      <ResourceBoundary
        state={state}
        onRetry={onRetry}
        notFoundTitle={notFoundTitle}
        notFoundMessage={notFoundMessage}
      />
    </>
  );
}

function DeliveryProjectRepositories({
  groupId,
  status,
  repositories,
  canManage,
  createButton,
  onRetry,
}: Readonly<{
  groupId: string;
  status: ResourceState;
  repositories: HierarchyRepository[];
  canManage: boolean;
  createButton: ReactNode;
  onRetry: () => void;
}>) {
  if (status === "ready") {
    return (
      <>
        <SectionHeader title="Repositories" count={repositories.length} />
        <RepositoryTable groupId={groupId} repositories={repositories} />
      </>
    );
  }
  if (status === "loading") {
    return <LoadingRows rows={2} />;
  }
  return (
    <ResourceBoundary
      state={status}
      onRetry={onRetry}
      emptyTitle="No repositories yet"
      emptyMessage={
        canManage
          ? "Create a repository to provision a GitHub repo and start assigning members."
          : "You don't have access to any repositories in this delivery project yet."
      }
      emptyAction={createButton}
    />
  );
}

function DeliveryProjectDetail({
  groupId,
  deliveryProjectId,
}: Readonly<{ groupId: string; deliveryProjectId: string }>) {
  const vm = useDeliveryProjectViewModel(groupId, deliveryProjectId);

  if (vm.status !== "ready" || !vm.project) {
    return (
      <HierarchyNotReady
        crumb="Delivery project"
        state={vm.status}
        onRetry={vm.reload}
        notFoundTitle="Delivery project not found"
        notFoundMessage="This delivery project doesn't exist, or you're not a member of its group."
      />
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
          { label: groupDisplayName(vm.group), href: `/groups/${groupId}` },
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

      <DeliveryProjectRepositories
        groupId={groupId}
        status={vm.repositoriesStatus}
        repositories={vm.repositories}
        canManage={vm.canManage}
        createButton={createButton}
        onRetry={vm.reloadRepositories}
      />

      {vm.canManage ? (
        <CreateRepositoryDialog
          open={vm.dialogOpen}
          deliveryProjectId={project.id}
          onClose={() => vm.setDialogOpen(false)}
          onCreated={vm.prependRepository}
        />
      ) : null}
    </>
  );
}

/** Public view for the delivery project route. */
export function DeliveryProjectView() {
  const { groupId, deliveryProjectId } = useGroupDeliveryProjectRouteViewModel();
  return (
    <HierarchyPageShell>
      {() => (
        <DeliveryProjectDetail
          groupId={groupId}
          deliveryProjectId={deliveryProjectId}
        />
      )}
    </HierarchyPageShell>
  );
}
