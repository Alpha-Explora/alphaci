"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useApiResource } from "@/hooks/use-hierarchy";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  deleteGroup,
  getGroupActivity,
  getGroupMembers,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/request";
import type { ProvisionedProject } from "@/lib/api/contracts";
import {
  isGlobalCreatorRole,
  isGroupManagerRole,
  type GroupActivityItem,
  type GroupActivityQuery,
  type GroupActivityResponse,
  type GroupMember,
  type GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { ActivityFeed, ActivityFilters } from "@/components/hierarchy/activity-feed";
import { FormDialog } from "@/components/hierarchy/primitives";
import { AddMemberDialog } from "@/components/hierarchy/add-member-dialog";
import { MemberTable } from "@/components/hierarchy/member-table";
import {
  SideTabs,
  type SideTabGroup,
} from "@/components/hierarchy/side-tabs";

type GroupSection =
  | "overview"
  | "members"
  | "projects"
  | "activity"
  | "settings"
  | "create";

interface GroupWorkspacePanelProps {
  group: GroupSummary;
  projects: ProvisionedProject[];
  renderCreateProject: (onComplete: () => void) => React.ReactNode;
  /** Called after this group is deleted so the parent can drop it from the list. */
  onDeleted?: (groupId: string) => void;
}

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function Overview({
  group,
  projects,
}: {
  group: GroupSummary;
  projects: ProvisionedProject[];
}) {
  return (
    <>
      <div className="hier-stat-row" style={{ margin: "0 0 1.1rem" }}>
        <div className="hier-stat"><span className="hier-stat-num">{group.memberCount}</span><span className="hier-stat-label">Members</span></div>
        <div className="hier-stat"><span className="hier-stat-num">{projects.length}</span><span className="hier-stat-label">Repositories</span></div>
        <div className="hier-stat"><span className="hier-stat-num" style={{ textTransform: "capitalize", fontSize: "1.1rem" }}>{group.status}</span><span className="hier-stat-label">Status</span></div>
      </div>
      {group.description ? (
        <p className="group-section-lede">{group.description}</p>
      ) : (
        <p className="group-section-lede">
          This team owns its own members and repositories. Use the sections on
          the left to manage them.
        </p>
      )}
    </>
  );
}

function Members({ group }: { group: GroupSummary }) {
  const { session } = useAuthSession();
  const [addOpen, setAddOpen] = useState(false);
  const canManage = isGroupManagerRole(group.role);
  const membersResource = useApiResource<GroupMember[]>(() => getGroupMembers(group.id), [group.id]);

  if (membersResource.state === "loading") return <p className="project-list-empty">Loading members…</p>;
  if (membersResource.state !== "ready" && membersResource.state !== "empty") return <p className="project-list-empty">Members could not be loaded. <button type="button" className="inline-link" onClick={membersResource.reload}>Retry</button></p>;

  return (
    <>
      <MemberTable
        groupId={group.id}
        members={membersResource.data ?? []}
        canManage={canManage}
        currentUserId={session?.user.id ?? ""}
        onMembersChange={(updater) => membersResource.setData((current) => updater(current ?? []))}
        addAction={canManage ? <button type="button" className="primary-button" onClick={() => setAddOpen(true)}>Add member</button> : undefined}
      />
      {canManage ? (
        <AddMemberDialog
          open={addOpen}
          groupId={group.id}
          onClose={() => setAddOpen(false)}
          // The new member is active immediately, so it goes straight into the
          // roster — there is no pending list for it to sit in first.
          onAdded={(member) => membersResource.setData((current) => [member, ...(current ?? [])])}
        />
      ) : null}
    </>
  );
}

function Projects({ projects, canCreate, onCreate }: { projects: ProvisionedProject[]; canCreate: boolean; onCreate: () => void }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem" }}>
        <p className="project-list-empty" style={{ margin: 0 }}>{projects.length} {projects.length === 1 ? "project" : "projects"}</p>
        {canCreate ? <button type="button" className="primary-button" onClick={onCreate}>Create project</button> : null}
      </div>
      {projects.length === 0 ? (
        <div className="env-empty-state">No projects yet. {canCreate ? "Create a project to provision its GitHub repository." : "You do not have access to any projects in this group yet."}</div>
      ) : (
        <div className="env-metadata-list">
          {projects.map((project) => (
            <div key={project.id} className="env-metadata-row provisioned" style={{ alignItems: "center", gap: "0.75rem" }}>
              <span style={{ minWidth: 0 }}><strong style={{ wordBreak: "break-all" }}>{project.repoFullName}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{project.serviceName}</span></span>
              <span style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className={`project-status-badge ${statusVariant(project.status)}`}>{project.status}</span>
                {project.repoUrl ? <a className="ghost-button target-action-btn" href={project.repoUrl} target="_blank" rel="noreferrer">Repo <span aria-hidden="true">↗</span></a> : null}
                <Link className="ghost-button target-action-btn" href={`/projects/${encodeURIComponent(project.id)}`}>Open full page <span aria-hidden="true">↗</span></Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Activity({ group }: { group: GroupSummary }) {
  const [filters, setFilters] = useState<GroupActivityQuery>({});
  const [extraItems, setExtraItems] = useState<GroupActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const filtersKey = JSON.stringify(filters);
  const resource = useApiResource<GroupActivityResponse>(
    () => getGroupActivity(group.id, filters),
    [group.id, filtersKey],
    { emptyWhen: (response) => response.items.length === 0 },
  );

  useEffect(() => {
    setExtraItems([]);
    setCursor(resource.data?.nextCursor ?? null);
  }, [resource.data]);

  const items = useMemo(() => [...(resource.data?.items ?? []), ...extraItems], [resource.data, extraItems]);
  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const next = await getGroupActivity(group.id, { ...filters, cursor });
      setExtraItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <ActivityFilters value={filters} onChange={setFilters} />
      {resource.state === "loading" ? <p className="project-list-empty">Loading activity…</p> : resource.state === "ready" ? <><ActivityFeed items={items} />{cursor ? <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}><button type="button" className="ghost-button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button></div> : null}</> : <p className="env-empty-state">{resource.state === "empty" ? "No activity yet." : "Activity could not be loaded."}</p>}
    </>
  );
}

function DeleteGroupControl({
  group,
  projectCount,
  onDeleted,
}: {
  group: GroupSummary;
  projectCount: number;
  onDeleted?: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteGroup(group.id);
      setOpen(false);
      onDeleted?.(group.id);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) {
        setError("You're not allowed to delete this group.");
      } else if (cause instanceof ApiError && cause.status === 404) {
        setError("This group no longer exists.");
      } else {
        setError("The group could not be deleted. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="hier-btn-danger"
        onClick={() => setOpen(true)}
      >
        Delete group
      </button>
      <FormDialog
        open={open}
        onClose={() => {
          if (!deleting) {
            setOpen(false);
            setError(null);
          }
        }}
        title={`Delete "${group.name}"?`}
        description={
          projectCount > 0
            ? `This permanently deletes the group and its membership. Its ${projectCount} ${projectCount === 1 ? "repository stays" : "repositories stay"} on GitHub and move to your individual repositories. This cannot be undone.`
            : "This permanently deletes the group, its membership, and its systems. This cannot be undone."
        }
        submitLabel="Delete group"
        submitting={deleting}
        error={error}
        onSubmit={() => void handleDelete()}
      >
        <p className="project-list-empty" style={{ margin: 0 }}>
          Members will lose access to this group immediately.
        </p>
      </FormDialog>
    </>
  );
}

export function GroupWorkspacePanel({ group, projects, renderCreateProject, onDeleted }: Readonly<GroupWorkspacePanelProps>) {
  const { session } = useAuthSession();
  const [section, setSection] = useState<GroupSection>("overview");
  const canCreate = isGlobalCreatorRole(session?.appRole);
  const canManage = isGroupManagerRole(group.role);

  if (section === "create") {
    return (
      <>
        <div className="project-detail-header">
          <div><h3>Create repository in {group.name}</h3><p>The repository will be owned by this team.</p></div>
          <button type="button" className="ghost-button" onClick={() => setSection("projects")}>Back to repositories</button>
        </div>
        {renderCreateProject(() => setSection("projects"))}
      </>
    );
  }

  // Headings rather than a flat list: they turn five entries into a map of what
  // a team HAS, and that reading survives the list growing.
  const groups: SideTabGroup<Exclude<GroupSection, "create">>[] = [
    { heading: "Team", items: [{ id: "overview", label: "Overview" }] },
    {
      heading: "People",
      items: [{ id: "members", label: "Members", badge: group.memberCount }],
    },
    {
      heading: "Work",
      items: [
        { id: "projects", label: "Repositories", badge: projects.length },
      ],
    },
    { heading: "Records", items: [{ id: "activity", label: "Activity & audit" }] },
    ...(canManage
      ? [
          {
            heading: "Configuration",
            items: [{ id: "settings" as const, label: "Settings" }],
          },
        ]
      : []),
  ];

  const titles: Record<Exclude<GroupSection, "create">, string> = {
    overview: "Overview",
    members: "Members",
    projects: "Repositories",
    activity: "Activity & audit",
    settings: "Settings",
  };

  const current = section;

  return (
    <div className="group-workspace">
      <SideTabs
        groups={groups}
        value={current}
        onChange={setSection}
        label="Team sections"
        idPrefix="group"
      />

      <div
        className="group-workspace-panel"
        role="tabpanel"
        id={`group-panel-${current}`}
        aria-labelledby={`group-tab-${current}`}
        tabIndex={0}
      >
        <h3 className="group-section-title">{titles[current]}</h3>

        {current === "overview" ? <Overview group={group} projects={projects} /> : null}
        {current === "members" ? <Members group={group} /> : null}
        {current === "projects" ? (
          <Projects projects={projects} canCreate={canCreate} onCreate={() => setSection("create")} />
        ) : null}
        {current === "activity" ? <Activity group={group} /> : null}
        {current === "settings" && canManage ? (
          <div className="group-danger-zone">
            <div>
              <strong>Delete this team</strong>
              <p>
                Removes the team and its membership. Its repositories stay on
                GitHub and move to your individual repositories.
              </p>
            </div>
            <DeleteGroupControl
              group={group}
              projectCount={projects.length}
              onDeleted={onDeleted}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
