"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { getGroup, getProjects } from "@/lib/api/client";
import type { GroupSummary } from "@/lib/api/hierarchy-contracts";
import { isGlobalCreatorRole } from "@/lib/api/hierarchy-contracts";
import type { ProvisionedProject } from "@/lib/api/contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  Breadcrumb,
  GroupSubNav,
  HierarchyPageShell,
  LoadingRows,
  PageHeader,
  ResourceBoundary,
  SectionHeader,
} from "@/components/hierarchy/primitives";

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function SystemsInner({ group }: { group: GroupSummary }) {
  const { session } = useAuthSession();
  // Create capability follows the GLOBAL role (Lead/Admin), not the per-group
  // membership tier — mirrors the backend gate. Members can't create projects.
  const canManage = isGlobalCreatorRole(session?.appRole);
  // The group's projects are provisioned projects owned by its workspace. The
  // backend already scopes this to what the viewer may see (managers/admins see
  // all; a plain member sees only the repositories they're assigned to).
  const { data, state, reload } = useApiResource<ProvisionedProject[]>(
    async () => (await getProjects(undefined, { workspaceId: group.id })).items,
    [group.id],
    { emptyWhen: (projects) => projects.length === 0 },
  );

  const projects = data ?? [];
  // "Create project" opens the full Create Project form, pre-scoped to this
  // group so the provisioned project is owned by it.
  const createButton = canManage ? (
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
          { label: "Groups", href: "/groups" },
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

      {state === "ready" ? (
        <>
          <SectionHeader title="Projects" count={projects.length} />
          <div className="hier-card-grid">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${encodeURIComponent(project.id)}`}
                className="hier-card"
              >
                <div className="hier-card-top">
                  <h3 className="hier-card-name">
                    {project.repoFullName.split("/")[1] ?? project.repoFullName}
                  </h3>
                  <span className={`project-status-badge ${statusVariant(project.status)}`}>
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
      ) : state === "loading" ? (
        <LoadingRows rows={3} />
      ) : (
        <ResourceBoundary
          state={state}
          onRetry={reload}
          emptyTitle="No projects yet"
          emptyMessage={
            canManage
              ? "Create a project to provision its GitHub repository."
              : "You don't have access to any projects in this group yet."
          }
          emptyAction={createButton}
        />
      )}
    </>
  );
}

function SystemsView() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const { data, state, reload } = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );

  if (state !== "ready" || !data) {
    return (
      <>
        <Breadcrumb items={[{ label: "Groups", href: "/groups" }, { label: "Projects" }]} />
        <ResourceBoundary
          state={state}
          onRetry={reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return <SystemsInner group={data} />;
}

export default function GroupSystemsPage() {
  return <HierarchyPageShell>{() => <SystemsView />}</HierarchyPageShell>;
}
