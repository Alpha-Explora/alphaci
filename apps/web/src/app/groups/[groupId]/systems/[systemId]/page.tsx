"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  getGroup,
  getSystem,
  getSystemDeliveryProjects,
} from "@/lib/api/client";
import type {
  DeliveryProject,
  GroupSummary,
  HierarchySystem,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
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

function SystemDetail({
  groupId,
  systemId,
}: {
  groupId: string;
  systemId: string;
}) {
  const groupResource = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );
  const systemResource = useApiResource<HierarchySystem>(
    () => getSystem(systemId),
    [systemId],
  );
  const projectsResource = useApiResource<DeliveryProject[]>(
    () => getSystemDeliveryProjects(systemId),
    [systemId],
    { emptyWhen: (projects) => projects.length === 0 },
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const group = groupResource.data;
  const system = systemResource.data;
  const canManage = isGroupManagerRole(group?.role);
  const projects = projectsResource.data ?? [];

  if (systemResource.state !== "ready" || !system) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "System" },
          ]}
        />
        <ResourceBoundary
          state={systemResource.state}
          onRetry={systemResource.reload}
          notFoundTitle="System not found"
          notFoundMessage="This system doesn't exist, or you're not a member of its group."
        />
      </>
    );
  }

  const createButton = canManage ? (
    <button
      type="button"
      className="primary-button"
      onClick={() => setDialogOpen(true)}
    >
      Create delivery project
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: group?.name ?? "Group", href: `/groups/${groupId}` },
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

      {projectsResource.state === "ready" ? (
        <>
          <SectionHeader title="Delivery projects" count={projects.length} />
          <div className="hier-card-grid">
            {projects.map((project) => (
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
                    {project.repositoryCount === 1 ? "repository" : "repositories"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : projectsResource.state === "loading" ? (
        <LoadingRows rows={2} />
      ) : (
        <ResourceBoundary
          state={projectsResource.state}
          onRetry={projectsResource.reload}
          emptyTitle="No delivery projects yet"
          emptyMessage={
            canManage
              ? "Create a delivery project to start adding repositories."
              : "This system has no delivery projects yet."
          }
          emptyAction={createButton}
        />
      )}

      {canManage && (
        <CreateDeliveryProjectDialog
          open={dialogOpen}
          systemId={system.id}
          onClose={() => setDialogOpen(false)}
          onCreated={(project) =>
            projectsResource.setData((current) => [project, ...(current ?? [])])
          }
        />
      )}
    </>
  );
}

export default function SystemDetailPage() {
  const params = useParams<{ groupId: string; systemId: string }>();
  return (
    <HierarchyPageShell>
      {() => (
        <SystemDetail groupId={params.groupId} systemId={params.systemId} />
      )}
    </HierarchyPageShell>
  );
}
