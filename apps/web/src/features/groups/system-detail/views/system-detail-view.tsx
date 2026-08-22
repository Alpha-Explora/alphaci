"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { LifecycleStatusBadge } from "@/components/hierarchy/badges";
import { CreateDeliveryProjectDialog } from "@/components/hierarchy/create-delivery-project-dialog";
import {
  Breadcrumb,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/components/hierarchy/primitives";

import { useSystemDetailViewModel } from "../view-models/use-system-detail-view-model";

function SystemDetail({
  groupId,
  systemId,
}: Readonly<{ groupId: string; systemId: string }>) {
  const vm = useSystemDetailViewModel(groupId, systemId);

  if (vm.status !== "ready" || !vm.system) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "System" },
          ]}
        />
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          notFoundTitle="System not found"
          notFoundMessage="This system doesn't exist, or you're not a member of its group."
        />
      </>
    );
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
          { label: vm.group?.name ?? "Group", href: `/groups/${groupId}` },
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

      {vm.deliveryProjectsStatus === "ready" ? (
        <>
          <SectionHeader
            title="Delivery projects"
            count={vm.deliveryProjects.length}
          />
          <div className="hier-card-grid">
            {vm.deliveryProjects.map((project) => (
              <Link
                key={project.id}
                href={`/groups/${groupId}/delivery-projects/${project.id}`}
                className="hier-card"
              >
                <div className="hier-card-top">
                  <h3 className="hier-card-name">{project.name}</h3>
                  <LifecycleStatusBadge status={project.status} />
                </div>
                {project.description && (
                  <p className="hier-card-desc">{project.description}</p>
                )}
                <div className="hier-card-meta">
                  <span>
                    <strong>{project.repositoryCount}</strong>{" "}
                    {project.repositoryCount === 1
                      ? "repository"
                      : "repositories"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : vm.deliveryProjectsStatus === "loading" ? (
        <LoadingRows rows={2} />
      ) : (
        <ResourceBoundary
          state={vm.deliveryProjectsStatus}
          onRetry={vm.reloadDeliveryProjects}
          emptyTitle="No delivery projects yet"
          emptyMessage={
            vm.canManage
              ? "Create a delivery project to start adding repositories."
              : "This system has no delivery projects yet."
          }
          emptyAction={createButton}
        />
      )}

      {vm.canManage && (
        <CreateDeliveryProjectDialog
          open={vm.dialogOpen}
          systemId={system.id}
          onClose={() => vm.setDialogOpen(false)}
          onCreated={vm.prependDeliveryProject}
        />
      )}
    </>
  );
}

/** Public view for the system detail route. */
export function SystemDetailView() {
  const params = useParams<{ groupId: string; systemId: string }>();
  return (
    <HierarchyPageShell>
      {() => (
        <SystemDetail groupId={params.groupId} systemId={params.systemId} />
      )}
    </HierarchyPageShell>
  );
}
