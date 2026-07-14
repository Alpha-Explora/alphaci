"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useApiResource } from "@/hooks/use-hierarchy";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  getGroupActivity,
  getGroupInvitations,
  getGroupMembers,
} from "@/lib/api/client";
import type { ProvisionedProject } from "@/lib/api/contracts";
import {
  isGlobalCreatorRole,
  isGroupManagerRole,
  type GroupActivityItem,
  type GroupActivityQuery,
  type GroupActivityResponse,
  type GroupInvitation,
  type GroupMember,
  type GroupSummary,
} from "@/lib/api/hierarchy-contracts";
import { ActivityFeed, ActivityFilters } from "@/components/hierarchy/activity-feed";
import { InviteMemberDialog } from "@/components/hierarchy/invite-member-dialog";
import { MemberTable } from "@/components/hierarchy/member-table";

type GroupSection = "overview" | "projects" | "create";

interface GroupWorkspacePanelProps {
  group: GroupSummary;
  projects: ProvisionedProject[];
  renderCreateProject: (onComplete: () => void) => React.ReactNode;
}

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

function SectionTabs({ section, onChange }: { section: GroupSection; onChange: (section: GroupSection) => void }) {
  const tabs: { id: Exclude<GroupSection, "create">; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "projects", label: "Projects" },
  ];

  return (
    <div className="hier-subnav" role="tablist" aria-label="Selected group sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`hier-subnav-link${section === tab.id ? " active" : ""}`}
          role="tab"
          aria-selected={section === tab.id}
          aria-current={section === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Overview({ group, projects }: { group: GroupSummary; projects: ProvisionedProject[] }) {
  return (
    <>
      <div className="hier-stat-row" style={{ margin: "0.5rem 0 1.1rem" }}>
        <div className="hier-stat"><span className="hier-stat-num">{group.memberCount}</span><span className="hier-stat-label">Members</span></div>
        <div className="hier-stat"><span className="hier-stat-num">{projects.length}</span><span className="hier-stat-label">Projects</span></div>
        <div className="hier-stat"><span className="hier-stat-num" style={{ textTransform: "capitalize", fontSize: "1.1rem" }}>{group.status}</span><span className="hier-stat-label">Status</span></div>
      </div>
      <div className="group-overview-content">
        <section className="group-overview-section">
          <div className="group-overview-section__header">
            <div><h3>Members & invitations</h3><p>Manage membership, roles, and invitations without leaving the overview.</p></div>
          </div>
          <Members group={group} />
        </section>
        <section className="group-overview-section">
          <div className="group-overview-section__header">
            <div><h3>Activity & audit</h3><p>Review membership changes, access updates, and GitHub synchronization results.</p></div>
          </div>
          <Activity group={group} />
        </section>
      </div>
    </>
  );
}

function Members({ group }: { group: GroupSummary }) {
  const { session } = useAuthSession();
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManage = isGroupManagerRole(group.role);
  const membersResource = useApiResource<GroupMember[]>(() => getGroupMembers(group.id), [group.id]);
  const invitationsResource = useApiResource<GroupInvitation[]>(
    () => getGroupInvitations(group.id),
    [group.id],
    { enabled: canManage },
  );

  if (membersResource.state === "loading") return <p className="project-list-empty">Loading members…</p>;
  if (membersResource.state !== "ready" && membersResource.state !== "empty") return <p className="project-list-empty">Members could not be loaded. <button type="button" className="inline-link" onClick={membersResource.reload}>Retry</button></p>;

  return (
    <>
      <MemberTable
        groupId={group.id}
        members={membersResource.data ?? []}
        invitations={invitationsResource.data ?? []}
        canManage={canManage}
        currentUserId={session?.user.id ?? ""}
        onMembersChange={(updater) => membersResource.setData((current) => updater(current ?? []))}
        onInvitationsChange={(updater) => invitationsResource.setData((current) => updater(current ?? []))}
        inviteAction={canManage ? <button type="button" className="primary-button" onClick={() => setInviteOpen(true)}>Invite member</button> : undefined}
      />
      {canManage ? <InviteMemberDialog open={inviteOpen} groupId={group.id} onClose={() => setInviteOpen(false)} onInvited={(invitation) => invitationsResource.setData((current) => [invitation, ...(current ?? [])])} /> : null}
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

export function GroupWorkspacePanel({ group, projects, renderCreateProject }: Readonly<GroupWorkspacePanelProps>) {
  const { session } = useAuthSession();
  const [section, setSection] = useState<GroupSection>("overview");
  const canCreate = isGlobalCreatorRole(session?.appRole);

  if (section === "create") {
    return (
      <>
        <div className="project-detail-header">
          <div><h3>Create project in {group.name}</h3><p>The repository will be owned by this group.</p></div>
          <button type="button" className="ghost-button" onClick={() => setSection("projects")}>Back to projects</button>
        </div>
        {renderCreateProject(() => setSection("projects"))}
      </>
    );
  }

  return (
    <>
      <SectionTabs section={section} onChange={setSection} />
      {section === "overview" ? <Overview group={group} projects={projects} /> : null}
      {section === "projects" ? <Projects projects={projects} canCreate={canCreate} onCreate={() => setSection("create")} /> : null}
    </>
  );
}
