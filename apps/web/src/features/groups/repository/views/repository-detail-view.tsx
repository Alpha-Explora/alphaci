"use client";

import { useGroupRepositoryRouteViewModel } from "@/features/groups";
import {
  AssignDeveloperDialog,
  AssignmentPanel,
  ConfigurationPanel,
  HierarchyPageShell,
  RepositoryStatusBadge,
} from "@/features/groups/workspace";
import {
  Breadcrumb,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
} from "@/features/groups/workspace";

import { useRepositoryAccessViewModel } from "../view-models/use-repository-access-view-model";
import {
  useRepositoryDetailViewModel,
  type RepoTab,
} from "../view-models/use-repository-detail-view-model";
import { groupDisplayName } from "../../model/groups-rules";
import type { ResourceState } from "@/features/groups";
import type { HierarchyRepository } from "@/features/groups";

function RepositoryDetailNotReady({
  state,
  onRetry,
}: Readonly<{ state: ResourceState; onRetry: () => void }>) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: "Repository" },
        ]}
      />
      <ResourceBoundary
        state={state}
        onRetry={onRetry}
        notFoundTitle="Repository not found"
        notFoundMessage="This repository doesn't exist, or you don't have access to it."
      />
    </>
  );
}

function RepositoryHeaderActions({
  repository,
}: Readonly<{ repository: HierarchyRepository }>) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.6rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <RepositoryStatusBadge status={repository.status} />
      {repository.htmlUrl ? (
        <a
          className="hier-btn-sm"
          href={repository.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on GitHub
        </a>
      ) : null}
    </div>
  );
}

function RepositorySections({
  groupId,
  repositoryId,
  canManage,
  githubSyncLive,
  tab,
  onTab,
}: Readonly<{
  groupId: string;
  repositoryId: string;
  canManage: boolean;
  githubSyncLive: boolean;
  tab: RepoTab;
  onTab: (tab: RepoTab) => void;
}>) {
  return (
    <>
      {canManage ? (
        <nav className="hier-subnav" aria-label="Repository sections">
          <button
            type="button"
            className="hier-subnav-link"
            aria-current={tab === "access" ? "page" : undefined}
            onClick={() => onTab("access")}
          >
            Member access
          </button>
          <button
            type="button"
            className="hier-subnav-link"
            aria-current={tab === "configuration" ? "page" : undefined}
            onClick={() => onTab("configuration")}
          >
            Configuration
          </button>
        </nav>
      ) : null}
      {tab === "access" ? (
        <AccessTab
          groupId={groupId}
          repositoryId={repositoryId}
          canManage={canManage}
          githubSyncLive={githubSyncLive}
        />
      ) : (
        <ConfigurationPanel repositoryId={repositoryId} />
      )}
    </>
  );
}

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
  const vm = useRepositoryAccessViewModel(repositoryId, canManage);

  if (!canManage) {
    return (
      <ResourceBoundary
        state="forbidden"
        forbiddenMessage="Managing member access is available to group leads. Your assigned repositories and access status are on the My work page."
      />
    );
  }

  if (vm.status === "loading") {
    return <LoadingRows rows={3} />;
  }
  if (
    vm.status === "error" ||
    vm.status === "forbidden" ||
    vm.status === "notfound"
  ) {
    return <ResourceBoundary state={vm.status} onRetry={vm.reload} />;
  }

  return (
    <>
      <AssignmentPanel
        repositoryId={repositoryId}
        assignments={vm.assignments}
        accessStatus={vm.accessStatus}
        canManage={canManage}
        onAssignmentsChange={vm.applyAssignments}
        assignAction={
          githubSyncLive ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => vm.setAssignOpen(true)}
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
        open={vm.assignOpen}
        groupId={groupId}
        repositoryId={repositoryId}
        onClose={() => vm.setAssignOpen(false)}
        onAssigned={vm.onAssigned}
      />
    </>
  );
}

function RepositoryDetail({
  groupId,
  repositoryId,
}: Readonly<{ groupId: string; repositoryId: string }>) {
  const vm = useRepositoryDetailViewModel(groupId, repositoryId);

  if (vm.status !== "ready" || !vm.repository) {
    return <RepositoryDetailNotReady state={vm.status} onRetry={vm.reload} />;
  }

  const repository = vm.repository;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          {
            label: groupDisplayName(vm.group),
            href: `/groups/${groupId}`,
          },
          { label: "Projects", href: `/groups/${groupId}/systems` },
          { label: repository.name },
        ]}
      />
      <PageHeader
        title={repository.name}
        subtitle={repository.repoFullName ?? undefined}
        actions={<RepositoryHeaderActions repository={repository} />}
      />
      <RepositorySections
        groupId={groupId}
        repositoryId={repository.id}
        canManage={vm.canManage}
        githubSyncLive={vm.githubSyncLive}
        tab={vm.tab}
        onTab={vm.setTab}
      />
    </>
  );
}

/** Public view for the repository detail route. */
export function RepositoryDetailView() {
  const { groupId, repositoryId } = useGroupRepositoryRouteViewModel();
  return (
    <HierarchyPageShell>
      {() => (
        <RepositoryDetail
          groupId={groupId}
          repositoryId={repositoryId}
        />
      )}
    </HierarchyPageShell>
  );
}
