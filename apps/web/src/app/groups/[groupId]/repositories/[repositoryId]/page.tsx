"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import {
  getGroup,
  getRepository,
  getRepositoryAccessStatus,
  getRepositoryAssignments,
} from "@/lib/api/client";
import type {
  GroupSummary,
  HierarchyRepository,
  RepositoryAccessStatus,
  RepositoryAccessStatusResponse,
  RepositoryAssignment,
} from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { RepositoryStatusBadge } from "@/components/hierarchy/badges";
import { AssignDeveloperDialog } from "@/components/hierarchy/assign-developer-dialog";
import { AssignmentPanel } from "@/components/hierarchy/assignment-panel";
import { ConfigurationPanel } from "@/components/hierarchy/configuration-panel";
import {
  Breadcrumb,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

type RepoTab = "access" | "configuration";

function AccessTab({
  repositoryId,
  canManage,
}: {
  repositoryId: string;
  canManage: boolean;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const assignmentsResource = useApiResource<RepositoryAssignment[]>(
    () => getRepositoryAssignments(repositoryId),
    [repositoryId],
    { enabled: canManage },
  );
  const accessResource = useApiResource<RepositoryAccessStatusResponse>(
    () => getRepositoryAccessStatus(repositoryId),
    [repositoryId],
    { enabled: canManage },
  );

  if (!canManage) {
    return (
      <ResourceBoundary
        state="forbidden"
        forbiddenMessage="Managing member access is available to group leads. Your assigned repositories and access status are on the My work page."
      />
    );
  }

  if (
    assignmentsResource.state === "loading" ||
    accessResource.state === "loading"
  ) {
    return <LoadingRows rows={3} />;
  }
  if (
    assignmentsResource.state === "error" ||
    assignmentsResource.state === "forbidden" ||
    assignmentsResource.state === "notfound"
  ) {
    return (
      <ResourceBoundary
        state={assignmentsResource.state}
        onRetry={assignmentsResource.reload}
      />
    );
  }

  const assignments = assignmentsResource.data ?? [];
  const accessStatus: RepositoryAccessStatus[] = accessResource.data?.items ?? [];

  return (
    <>
      <AssignmentPanel
        repositoryId={repositoryId}
        assignments={assignments}
        accessStatus={accessStatus}
        canManage={canManage}
        onAssignmentsChange={(updater) =>
          assignmentsResource.setData((current) => updater(current ?? []))
        }
        assignAction={
          <button
            type="button"
            className="primary-button"
            onClick={() => setAssignOpen(true)}
          >
            Assign member
          </button>
        }
      />
      <AssignDeveloperDialog
        open={assignOpen}
        repositoryId={repositoryId}
        onClose={() => setAssignOpen(false)}
        onAssigned={(assignment) => {
          assignmentsResource.setData((current) => [
            assignment,
            ...(current ?? []).filter((item) => item.id !== assignment.id),
          ]);
          accessResource.reload();
        }}
      />
    </>
  );
}

function RepositoryDetail({
  groupId,
  repositoryId,
}: {
  groupId: string;
  repositoryId: string;
}) {
  const groupResource = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );
  const repoResource = useApiResource<HierarchyRepository>(
    () => getRepository(repositoryId),
    [repositoryId],
  );
  const canManage = isGroupManagerRole(groupResource.data?.role);
  const [tab, setTab] = useState<RepoTab>("access");

  const repository = repoResource.data;

  if (repoResource.state !== "ready" || !repository) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Groups", href: "/groups" }, { label: "Repository" }]}
        />
        <ResourceBoundary
          state={repoResource.state}
          onRetry={repoResource.reload}
          notFoundTitle="Repository not found"
          notFoundMessage="This repository doesn't exist, or you don't have access to it."
        />
      </>
    );
  }

  const effectiveTab: RepoTab = canManage ? tab : "configuration";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Groups", href: "/groups" },
          {
            label: groupResource.data?.name ?? "Group",
            href: `/groups/${groupId}`,
          },
          { label: "Systems", href: `/groups/${groupId}/systems` },
          { label: repository.name },
        ]}
      />
      <PageHeader
        title={repository.name}
        subtitle={repository.repoFullName ?? undefined}
        actions={
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <RepositoryStatusBadge status={repository.status} />
            {repository.htmlUrl && (
              <a
                className="hier-btn-sm"
                href={repository.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on GitHub
              </a>
            )}
          </div>
        }
      />

      {canManage && (
        <nav className="hier-subnav" aria-label="Repository sections">
          <button
            type="button"
            className="hier-subnav-link"
            aria-current={effectiveTab === "access" ? "page" : undefined}
            onClick={() => setTab("access")}
          >
            Member access
          </button>
          <button
            type="button"
            className="hier-subnav-link"
            aria-current={effectiveTab === "configuration" ? "page" : undefined}
            onClick={() => setTab("configuration")}
          >
            Configuration
          </button>
        </nav>
      )}

      {effectiveTab === "access" ? (
        <AccessTab repositoryId={repository.id} canManage={canManage} />
      ) : (
        <ConfigurationPanel repositoryId={repository.id} />
      )}
    </>
  );
}

export default function RepositoryDetailPage() {
  const params = useParams<{ groupId: string; repositoryId: string }>();
  return (
    <HierarchyPageShell>
      {() => (
        <RepositoryDetail
          groupId={params.groupId}
          repositoryId={params.repositoryId}
        />
      )}
    </HierarchyPageShell>
  );
}
