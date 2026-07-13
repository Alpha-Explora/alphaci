"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import {
  getDeliveryProject,
  getDeliveryProjectRepositories,
  getGroup,
} from "@/lib/api/client";
import type {
  DeliveryProject,
  GroupSummary,
  HierarchyRepository,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { LifecycleStatusBadge } from "@/components/hierarchy/badges";
import { CreateRepositoryDialog } from "@/components/hierarchy/create-repository-dialog";
import { RepositoryTable } from "@/components/hierarchy/repository-table";
import {
  Breadcrumb,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/components/hierarchy/primitives";

function DeliveryProjectDetail({
  groupId,
  deliveryProjectId,
}: {
  groupId: string;
  deliveryProjectId: string;
}) {
  const groupResource = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );
  const projectResource = useApiResource<DeliveryProject>(
    () => getDeliveryProject(deliveryProjectId),
    [deliveryProjectId],
  );
  const reposResource = useApiResource<HierarchyRepository[]>(
    () => getDeliveryProjectRepositories(deliveryProjectId),
    [deliveryProjectId],
    { emptyWhen: (repos) => repos.length === 0 },
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const group = groupResource.data;
  const project = projectResource.data;
  const canManage = isGroupManagerRole(group?.role);
  const repositories = reposResource.data ?? [];

  if (projectResource.state !== "ready" || !project) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Groups", href: "/groups" }, { label: "Delivery project" }]}
        />
        <ResourceBoundary
          state={projectResource.state}
          onRetry={projectResource.reload}
          notFoundTitle="Delivery project not found"
          notFoundMessage="This delivery project doesn't exist, or you're not a member of its group."
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
      Create repository
    </button>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Groups", href: "/groups" },
          { label: group?.name ?? "Group", href: `/groups/${groupId}` },
          { label: "Systems", href: `/groups/${groupId}/systems` },
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

      {reposResource.state === "ready" ? (
        <>
          <SectionHeader title="Repositories" count={repositories.length} />
          <RepositoryTable groupId={groupId} repositories={repositories} />
        </>
      ) : reposResource.state === "loading" ? (
        <LoadingRows rows={2} />
      ) : (
        <ResourceBoundary
          state={reposResource.state}
          onRetry={reposResource.reload}
          emptyTitle="No repositories yet"
          emptyMessage={
            canManage
              ? "Create a repository to provision a GitHub repo and start assigning members."
              : "You don't have access to any repositories in this delivery project yet."
          }
          emptyAction={createButton}
        />
      )}

      {canManage && (
        <CreateRepositoryDialog
          open={dialogOpen}
          deliveryProjectId={project.id}
          onClose={() => setDialogOpen(false)}
          onCreated={(repository) =>
            reposResource.setData((current) => [repository, ...(current ?? [])])
          }
        />
      )}
    </>
  );
}

export default function DeliveryProjectPage() {
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
