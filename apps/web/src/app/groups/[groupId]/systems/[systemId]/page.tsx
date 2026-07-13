"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  getDeliveryProjectRepositories,
  getGroup,
  getSystem,
  getSystemDeliveryProjects,
} from "@/lib/api/client";
import type {
  DeliveryProject,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
} from "@/lib/api/hierarchy-contracts";
import { isGlobalCreatorRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { useAuthSession } from "@/hooks/use-auth-session";
import { LifecycleStatusBadge } from "@/components/hierarchy/badges";
import { CreateDeliveryProjectDialog } from "@/components/hierarchy/create-delivery-project-dialog";
import { RepositoryDetailView } from "@/components/hierarchy/repository-detail-view";
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
}: Readonly<{
  groupId: string;
  systemId: string;
}>) {
  const { session } = useAuthSession();
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
  // A system now maps 1:1 to a repository (create-system provisions one). Resolve
  // that single repository so we can render its detail directly on this page.
  const projects = projectsResource.data ?? [];
  const singleDeliveryProjectId = projects.length === 1 ? projects[0].id : null;
  const reposResource = useApiResource<HierarchyRepository[]>(
    () => getDeliveryProjectRepositories(singleDeliveryProjectId ?? ""),
    [singleDeliveryProjectId],
    { enabled: Boolean(singleDeliveryProjectId) },
  );
  const repositories = reposResource.data ?? [];
  const singleRepositoryId =
    repositories.length === 1 ? repositories[0].id : null;

  // Create capability follows the GLOBAL role (Lead/Admin), mirroring the backend.
  const canManage = isGlobalCreatorRole(session?.appRole);

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Projects", href: "/groups" },
        { label: group?.name ?? "Group", href: `/groups/${groupId}` },
        { label: "Systems", href: `/groups/${groupId}/systems` },
        { label: system?.name ?? "System" },
      ]}
    />
  );

  if (systemResource.state !== "ready" || !system) {
    return (
      <>
        {breadcrumb}
        <ResourceBoundary
          state={systemResource.state}
          onRetry={systemResource.reload}
          notFoundTitle="System not found"
          notFoundMessage="This system doesn't exist, or you're not a member of its group."
        />
      </>
    );
  }

  // Primary path: the system has exactly one repository — show its contents
  // (member access + configuration) inline, treating the system AS the repo.
  if (singleRepositoryId) {
    return (
      <RepositoryDetailView
        groupId={groupId}
        repositoryId={singleRepositoryId}
        breadcrumb={breadcrumb}
      />
    );
  }

  // Still resolving the repository.
  if (
    projectsResource.state === "loading" ||
    (singleDeliveryProjectId && reposResource.state === "loading")
  ) {
    return (
      <>
        {breadcrumb}
        <PageHeader title={system.name} subtitle={system.description ?? undefined} />
        <LoadingRows rows={3} />
      </>
    );
  }

  // Fallback for legacy/edge systems (no repository, or multiple delivery
  // projects/repositories): show the delivery-project hierarchy so nothing is
  // hidden and managers can still drill in.
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
      {breadcrumb}
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
      ) : (
        <ResourceBoundary
          state={projectsResource.state}
          onRetry={projectsResource.reload}
          emptyTitle="No repository yet"
          emptyMessage={
            canManage
              ? "This system has no repository. Create a delivery project to add one."
              : "This system has no repository yet."
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
