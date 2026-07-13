"use client";

import Link from "next/link";

import { getMyAssignedRepositories, getMyGroups } from "@/lib/api/client";
import type {
  MyAssignedRepositoriesResponse,
  MyGroupsResponse,
} from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { RoleBadge } from "@/components/hierarchy/badges";
import { MyAssignedWorkList } from "@/components/hierarchy/my-assigned-work-list";
import {
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
  StateView,
} from "@/components/hierarchy/primitives";

function MyWorkView() {
  const groupsResource = useApiResource<MyGroupsResponse>(
    () => getMyGroups(),
    [],
  );
  const reposResource = useApiResource<MyAssignedRepositoriesResponse>(
    () => getMyAssignedRepositories(),
    [],
  );

  const groups = groupsResource.data?.items ?? [];
  const repositories = reposResource.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="My work"
        subtitle="Your groups, the repositories you're assigned to, and your GitHub access status."
      />

      {/* ── My groups ──────────────────────────────────────────────── */}
      <section aria-label="My groups" style={{ marginBottom: "2rem" }}>
        <SectionHeader title="My groups" count={groups.length} />
        {groupsResource.state === "loading" ? (
          <LoadingRows rows={2} />
        ) : groupsResource.state === "ready" && groups.length > 0 ? (
          <div className="hier-card-grid">
            {groups.map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="hier-card">
                <div className="hier-card-top">
                  <h3 className="hier-card-name">{group.name}</h3>
                  <RoleBadge role={group.role} />
                </div>
                {group.description && (
                  <p className="hier-card-desc">{group.description}</p>
                )}
                <div className="hier-card-meta">
                  <span>
                    <strong>{group.systemCount}</strong>{" "}
                    {group.systemCount === 1 ? "system" : "systems"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : groupsResource.state === "error" ? (
          <ResourceBoundary state="error" onRetry={groupsResource.reload} />
        ) : (
          <StateView
            variant="empty"
            title="No groups yet"
            message="You're not a member of any group yet. A group lead can invite you."
          />
        )}
      </section>

      {/* ── My assigned repositories ───────────────────────────────── */}
      <section aria-label="My assigned repositories">
        <SectionHeader title="My assigned repositories" count={repositories.length} />
        {reposResource.state === "loading" ? (
          <LoadingRows rows={3} />
        ) : reposResource.state === "ready" && repositories.length > 0 ? (
          <MyAssignedWorkList repositories={repositories} />
        ) : reposResource.state === "error" ? (
          <ResourceBoundary state="error" onRetry={reposResource.reload} />
        ) : (
          <StateView
            variant="empty"
            title="No assigned repositories"
            message="You don't have any active or pending repository assignments right now. When a lead assigns you, it appears here once GitHub access is granted."
          />
        )}
      </section>
    </>
  );
}

export default function MyWorkPage() {
  return <HierarchyPageShell>{() => <MyWorkView />}</HierarchyPageShell>;
}
