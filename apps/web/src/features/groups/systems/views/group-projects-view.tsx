'use client';

import Link from 'next/link';

import { HierarchyPageShell } from '@/features/groups/workspace';
import {
  Breadcrumb,
  GroupSubNav,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from '@/features/groups/workspace';

import type { GroupSummary } from '../../model/groups-types';
import { useGroupRouteViewModel, useGroupViewModel } from '@/features/groups';
import { useGroupProjectsViewModel } from '../view-models/use-group-projects-view-model';

function ProjectsInner({ group }: Readonly<{ group: GroupSummary }>) {
  const vm = useGroupProjectsViewModel(group.id);

  // "Create project" opens the New Project dialog on this group's Projects
  // page: a Product owner creates the Project, a Developer fills it.
  const createButton =
    vm.canManage && group.status === 'active' ? (
      <Link className="primary-button" href={vm.createProjectHref}>
        Create project
      </Link>
    ) : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', href: '/workflows' },
          { label: group.name, href: `/groups/${group.id}` },
          { label: 'Projects' },
        ]}
      />
      <PageHeader
        title="Projects"
        subtitle="Projects owned by this group. A Product owner creates a Project; Developers add its repositories."
        actions={createButton}
      />
      <GroupSubNav group={group} active="systems" />

      {vm.status === 'ready' ? (
        <>
          <SectionHeader title="Projects" count={vm.projects.length} />
          <div className="hier-card-grid">
            {vm.projects.map((project) => (
              <Link
                key={project.deliveryProjectId}
                href={`/groups/${encodeURIComponent(group.id)}/delivery-projects/${encodeURIComponent(project.deliveryProjectId)}`}
                className="hier-card"
              >
                <div className="hier-card-top">
                  <h3 className="hier-card-name">{project.name}</h3>
                </div>
                <div className="hier-card-meta">
                  <span>
                    {project.repositories.length}{' '}
                    {project.repositories.length === 1
                      ? 'repository'
                      : 'repositories'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {vm.unfiled.length > 0 && (
            <>
              <SectionHeader
                title="Unfiled repositories"
                count={vm.unfiled.length}
              />
              <div className="hier-card-grid">
                {vm.unfiled.map((repository) => (
                  <Link
                    key={repository.id}
                    href={`/projects/${encodeURIComponent(repository.id)}`}
                    className="hier-card"
                  >
                    <h3 className="hier-card-name">{repository.name}</h3>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      ) : vm.status === 'loading' ? (
        <LoadingRows rows={3} />
      ) : (
        <ResourceBoundary
          state={vm.status}
          onRetry={vm.reload}
          emptyTitle="No projects yet"
          emptyMessage={
            vm.canManage
              ? 'Create a Project, then Developers add its repositories.'
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

  if (vm.status !== 'ready' || !vm.group) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Projects', href: '/workflows' },
            { label: 'Projects' },
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
