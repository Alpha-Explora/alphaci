"use client";

import Link from "next/link";

import { HierarchyPageShell } from "@/features/groups/workspace";
import {
  Breadcrumb,
  GroupSubNav,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/features/groups/workspace";

import { projectStatusVariant, repoShortName } from "../../model/groups-rules";
import type { GroupSummary } from "../../model/groups-types";
import { useGroupRouteViewModel, useGroupViewModel } from "@/features/groups";
import { useGroupProjectsViewModel } from "../view-models/use-group-projects-view-model";

function ProjectsInner({ group }: Readonly<{ group: GroupSummary }>) {
  const vm = useGroupProjectsViewModel(group.id);

  // "Create project" opens the full Create Project form, pre-scoped to this
  // group so the provisioned project is owned by it.
  const createButton = vm.canManage ? (
    <Link
      className="primary-button"
      href={`/workflows?tab=setup&group=${group.id}`}
    >
      Create project
    </Link>
  ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/workflows" },
          { label: group.name, href: `/groups/${group.id}` },
          { label: "Projects" },
        ]}
      />
      <PageHeader
        title="Projects"
        subtitle="Projects owned by this group. Creating a project provisions its GitHub repository."
        actions={createButton}
      />
      <GroupSubNav groupId={group.id} active="systems" />

      {vm.status === "ready" ? (
        <>
          <SectionHeader title="Projects" count={vm.projects.length} />
          <div className="hier-card-grid">
            {vm.projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${encodeURIComponent(project.id)}`}
                className="hier-card"
              >
                <div className="hier-card-top">
                  <h3 className="hier-card-name">
                    {repoShortName(project.repoFullName)}
                  </h3>
                  <span
                    className={`project-status-badge ${projectStatusVariant(project.status)}`}
                  >
                    {project.status}
                  </span>
                </div>
                <p className="hier-card-desc">{project.repoFullName}</p>
                <div className="hier-card-meta">
                  <span>{project.serviceName}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : vm.status === "loading" ? (
        <LoadingRows rows={3} />
      ) : (
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          emptyTitle="No projects yet"
          emptyMessage={
            vm.canManage
              ? "Create a project to provision its GitHub repository."
              : "You don't have access to any projects in this group yet."
          }
          emptyAction={createButton}
        />
      )}
    </>
  );
}

function ProjectsResolver() {
  const { groupId } = useGroupRouteViewModel();
  const vm = useGroupViewModel(groupId);

  if (vm.status !== "ready" || !vm.group) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Projects", href: "/workflows" },
            { label: "Projects" },
          ]}
        />
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <ProjectsInner group={vm.group} />;
}

/** Public view for the group projects route. */
export function GroupProjectsView() {
  return <HierarchyPageShell>{() => <ProjectsResolver />}</HierarchyPageShell>;
}
