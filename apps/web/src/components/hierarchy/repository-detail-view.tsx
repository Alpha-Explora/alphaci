"use client";

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
import { useCapabilities } from "@/hooks/use-capabilities";
import { RepositoryStatusBadge } from "@/components/hierarchy/badges";
import { AssignDeveloperDialog } from "@/components/hierarchy/assign-developer-dialog";
import { AssignmentPanel } from "@/components/hierarchy/assignment-panel";
import { ConfigurationPanel } from "@/components/hierarchy/configuration-panel";
import {
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

type RepoTab = "access" | "configuration";

function AccessTab({
  groupId,
  repositoryId,
  canManage,
  githubSyncLive,
}: Readonly<{
  groupId: string;
  repositoryId: string;
  canManage: boolean;
  githubSyncLive: boolean;
}>) {
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
        forbiddenMessage="Managing member access is available to group leads."
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
  const accessStatus: RepositoryAccessStatus[] =
    accessResource.data?.items ?? [];

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
          githubSyncLive ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setAssignOpen(true)}
            >
              Assign member
            </button>
          ) : (
            <span className="error-text">
              Enable live GitHub synchronization before assigning access.
            </span>
          )
        }
      />
      <AssignDeveloperDialog
        open={assignOpen}
        groupId={groupId}
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

/**
 * The repository "contents" — member access + configuration — rendered without
 * an outer page shell so it can be embedded both on the standalone repository
 * route AND inside a system's full page (a system maps 1:1 to a repository).
 * `breadcrumb` is supplied by the caller since the trail differs per context.
 */
export function RepositoryDetailView({
  groupId,
  repositoryId,
  breadcrumb,
}: Readonly<{
  groupId: string;
  repositoryId: string;
  breadcrumb?: React.ReactNode;
}>) {
  const groupResource = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );
  const repoResource = useApiResource<HierarchyRepository>(
    () => getRepository(repositoryId),
    [repositoryId],
  );
  const canManage = isGroupManagerRole(groupResource.data?.role);
  const { hierarchyGithubSyncMode } = useCapabilities();
  const [tab, setTab] = useState<RepoTab>("access");

  const repository = repoResource.data;

  if (repoResource.state !== "ready" || !repository) {
    return (
      <>
        {breadcrumb}
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
      {breadcrumb}
      <PageHeader
        title={repository.name}
        subtitle={repository.repoFullName ?? undefined}
        actions={
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
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
        <AccessTab
          groupId={groupId}
          repositoryId={repository.id}
          canManage={canManage}
          githubSyncLive={hierarchyGithubSyncMode === "live"}
        />
      ) : (
        <ConfigurationPanel repositoryId={repository.id} />
      )}
    </>
  );
}
