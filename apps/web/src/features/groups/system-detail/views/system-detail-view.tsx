"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  useGroupSystemRouteViewModel,
  type DeliveryProject,
  type ResourceState,
} from "@/features/groups";
import {
  CreateDeliveryProjectDialog,
  HierarchyPageShell,
  LifecycleStatusBadge,
} from "@/features/groups/workspace";
import {
  Breadcrumb,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/features/groups/workspace";

import { useSystemDetailViewModel } from "../view-models/use-system-detail-view-model";
import { groupDisplayName } from "../../model/groups-rules";

function SystemDetailNotReady({
  state,
  onRetry,
}: Readonly<{ state: ResourceState; onRetry: () => void }>) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: "System" },
        ]}
      />
      <ResourceBoundary
        state={state}
        onRetry={onRetry}
        notFoundTitle="System not found"
        notFoundMessage="This system doesn't exist, or you're not a member of its group."
      />
    </>
  );
}

function SystemDeliveryProjects({
  groupId,
  status,
  projects,
  canManage,
  createButton,
  onRetry,
}: Readonly<{
  groupId: string;
  status: ResourceState;
  projects: DeliveryProject[];
  canManage: boolean;
  createButton: ReactNode;
  onRetry: () => void;
}>) {
  if (status === "ready") {
    return (
      <>
        <SectionHeader
          title="Delivery projects"
          count={projects.length}
        />
        <div className="hier-card-grid">
          {projects.map((project) => (
            <SystemDeliveryProjectCard
              key={project.id}
              groupId={groupId}
              project={project}
            />
          ))}
        </div>
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
      emptyTitle="No delivery projects yet"
      emptyMessage={
        canManage
          ? "Create a delivery project to start adding repositories."
          : "This system has no delivery projects yet."
      }
      emptyAction={createButton}
    />
  );
}

function SystemDeliveryProjectCard({
  groupId,
  project,
}: Readonly<{ groupId: string; project: DeliveryProject }>) {
  return (
    <Link
      href={`/groups/${groupId}/delivery-projects/${project.id}`}
      className="hier-card"
    >
      <div className="hier-card-top">
        <h3 className="hier-card-name">{project.name}</h3>
        <LifecycleStatusBadge status={project.status} />
      </div>
      {project.description ? (
        <p className="hier-card-desc">{project.description}</p>
      ) : null}
      <div className="hier-card-meta">
        <span>
          <strong>{project.repositoryCount}</strong>{" "}
          {project.repositoryCount === 1 ? "repository" : "repositories"}
        </span>
      </div>
    </Link>
  );
}

function SystemDetail({
  groupId,
  systemId,
}: Readonly<{ groupId: string; systemId: string }>) {
  const vm = useSystemDetailViewModel(groupId, systemId);

  if (vm.status !== "ready" || !vm.system) {
    return <SystemDetailNotReady state={vm.status} onRetry={vm.reload} />;
  }

  const system = vm.system;
  const createButton = vm.canManage ? (
    <button
      type="button"
      className="primary-button"
      onClick={() => vm.setDialogOpen(true)}
    >
      Create delivery project
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: groupDisplayName(vm.group), href: `/groups/${groupId}` },
          { label: "Projects", href: `/groups/${groupId}/systems` },
          { label: system.name },
        ]}
      />
      <PageHeader
        title={system.name}
        subtitle={system.description ?? undefined}
        actions={
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <LifecycleStatusBadge status={system.status} />
            {createButton}
          </div>
        }
      />

      <SystemDeliveryProjects
        groupId={groupId}
        status={vm.deliveryProjectsStatus}
        projects={vm.deliveryProjects}
        canManage={vm.canManage}
        createButton={createButton}
        onRetry={vm.reloadDeliveryProjects}
      />

      {vm.canManage ? (
        <CreateDeliveryProjectDialog
          open={vm.dialogOpen}
          systemId={system.id}
          onClose={() => vm.setDialogOpen(false)}
          onCreated={vm.prependDeliveryProject}
        />
      ) : null}
    </>
  );
}

/** Public view for the system detail route. */
export function SystemDetailView() {
  const { groupId, systemId } = useGroupSystemRouteViewModel();
  return (
    <HierarchyPageShell>
      {() => (
        <SystemDetail groupId={groupId} systemId={systemId} />
      )}
    </HierarchyPageShell>
  );
}
