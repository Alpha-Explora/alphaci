"use client";

import type { ReactNode } from "react";
import {
  useGroupDeliveryProjectRouteViewModel,
  type HierarchyRepository,
  type ResourceState,
} from "@/features/groups";
import {
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

import { IterationHeader } from "@/features/checklists/iteration";
import { ProjectQaWorkspace } from "@/features/checklists/requirements";

import { useDeliveryProjectViewModel } from "../view-models/use-delivery-project-view-model";
import { useProjectMembersViewModel } from "../view-models/use-project-members-view-model";
import type { AppRole } from "@/shared/api/contracts";
import { CreateRepositoryDialog } from "./create-repository-dialog";
import { ProjectMembersPanel } from "./project-members-panel";
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
          ? "Add a repository to provision a GitHub repo with its pipeline and hosting."
          : "You don't have access to any repositories in this delivery project yet."
      }
      emptyAction={createButton}
    />
  );
}

/** Leads and admins manage who works on the Project; nobody else sees it. */
function ProjectMembersSection({
  groupId,
  deliveryProjectId,
  appRole,
}: Readonly<{ groupId: string; deliveryProjectId: string; appRole: AppRole | null }>) {
  const vm = useProjectMembersViewModel({ groupId, deliveryProjectId, appRole });
  return <ProjectMembersPanel vm={vm} />;
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
  const createButton = vm.canCreateRepository ? (
    <button
      type="button"
      className="primary-button"
      onClick={() => vm.setDialogOpen(true)}
    >
      Add repository
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
            {/* "Iteration 3 · Delivered 14 Oct", and Start iteration 4 for a Product owner or admin. */}
            <IterationHeader deliveryProjectId={project.id} enabled={vm.qaEnabled} appRole={vm.appRole} />
            {createButton}
          </div>
        }
      />

      <DeliveryProjectRepositories
        groupId={groupId}
        status={vm.repositoriesStatus}
        repositories={vm.repositories}
        canManage={vm.canCreateRepository}
        createButton={createButton}
        onRetry={vm.reloadRepositories}
      />

      <ProjectMembersSection
        groupId={groupId}
        deliveryProjectId={project.id}
        appRole={vm.appRole}
      />

      {vm.qaEnabled ? (
        <>
          <SectionHeader title="Requirements and QA" />
          <ProjectQaWorkspace deliveryProjectId={project.id} projectName={project.name} appRole={vm.appRole} />
        </>
      ) : null}

      {vm.canCreateRepository ? (
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
