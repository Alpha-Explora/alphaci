"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { useApiResource } from "@/features/groups";
import { useAuthSession } from "@/features/auth/session";
import {
  archiveGroup,
  deleteGroup,
  getGroupActivity,
  getGroupMembers,
  reopenGroup,
  transferGroup,
  updateGroup,
} from "@/features/groups";
import { ApiError } from "@/shared/api/request";
import type { ProvisionedProject } from "@/features/groups";
import {
  isGlobalCreatorRole,
  isGroupManagerRole,
  type GroupActivityItem,
  type GroupActivityQuery,
  type GroupActivityResponse,
  type GroupMember,
  type GroupSummary,
} from "@/features/groups";
import { ActivityFeed, ActivityFilters, AddMemberDialog, FormDialog, MemberTable } from "@/features/groups/workspace";
import {
  SideTabs,
  type SideTabGroup,
  type SideTabItem,
} from "@/features/groups/workspace";

type GroupSection =
  | "overview"
  | "members"
  | "projects"
  | "qa-checklists"
  | "activity"
  | "settings"
  | "create";

interface GroupWorkspacePanelProps {
  group: GroupSummary;
  projects: ProvisionedProject[];
  renderCreateProject: (onComplete: () => void) => React.ReactNode;
  /**
   * Where "Create repository" should go instead of opening the in-panel form.
   *
   * The teams page has no setup form of its own — its `renderCreateProject`
   * was a stub whose only content was a button pointing at the Projects
   * surface, so the section existed purely to be clicked through. Given a href
   * the header links straight there and that empty screen never renders.
   */
  createHref?: string;
  /** Called after this group is deleted so the parent can drop it from the list. */
  onDeleted?: (groupId: string) => void;
  /**
   * Called after the roster changes.
   *
   * The member COUNT is rendered in three places this component does not own —
   * the page header, the rail badge and the Overview stat — all fed from the
   * group record the parent fetched. Without this they kept showing the count
   * from page load while the table below showed the truth.
   */
  onMembershipChanged?: () => void;
  /**
   * The team's QA checklists section, already built by the caller — or
   * null/undefined when the capability is off, which hides the rail entry.
   * Passed in rather than built here so this panel stays ignorant of the
   * checklists domain and its capability flag.
   */
  qaChecklists?: ReactNode;
  /** Open on this section instead of Overview (deep links). */
  initialSection?: "qa-checklists";
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

function Members({
  group,
  addOpen,
  onCloseAdd,
  onMembershipChanged,
}: {
  group: GroupSummary;
  /** Owned by the panel, because the button that opens it lives in the header. */
  addOpen: boolean;
  onCloseAdd: () => void;
  onMembershipChanged?: () => void;
}) {
  const { session } = useAuthSession();
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
        onMembersChange={(updater) => {
          membersResource.setData((current) => updater(current ?? []));
          // Re-read the group so the header, the rail badge and the Overview
          // stat agree with the table.
          onMembershipChanged?.();
        }}
        // The panel's header row already says "Members" and carries the button.
        showHeader={false}
      />
      {canManage ? (
        <AddMemberDialog
          open={addOpen}
          groupId={group.id}
          onClose={onCloseAdd}
          // The new member is active immediately, so it goes straight into the
          // roster — there is no pending list for it to sit in first.
          onAdded={(member) => {
            membersResource.setData((current) => [member, ...(current ?? [])]);
            onMembershipChanged?.();
          }}
        />
      ) : null}
    </>
  );
}

function Projects({ projects, canCreate }: { projects: ProvisionedProject[]; canCreate: boolean }) {
  if (projects.length === 0) {
    return (
      <div className="env-empty-state">
        No repositories yet.{" "}
        {canCreate
          ? "Create one and ALPHACI will provision it on GitHub."
          : "You do not have access to any repositories in this team yet."}
      </div>
    );
  }

  return (
    <ul className="team-repo-list">
      {projects.map((project) => (
        <li key={project.id} className="team-repo">
          {/*
            THE WHOLE ROW is the link. It used to be a plain div with an "Open
            full page" button on the end, which made the obvious target — the
            repository's own name — dead, and spent a button on what the row
            already implied. The GitHub link stays a separate control because
            it goes somewhere else entirely.
          */}
          <Link
            className="team-repo__main"
            href={`/projects/${encodeURIComponent(project.id)}`}
          >
            <span className="team-repo__name">{project.repoFullName}</span>
            <span className="team-repo__service">{project.serviceName}</span>
          </Link>
          <span className="team-repo__meta">
            <span className={`project-status-badge ${statusVariant(project.status)}`}>
              {project.status}
            </span>
            {project.repoUrl ? (
              <a
                className="ghost-button team-repo__link"
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                // The row is a link; without this the outer navigation wins.
                onClick={(event) => event.stopPropagation()}
              >
                GitHub <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
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
            ? `This permanently deletes the team and its membership. Its ${projectCount} ${projectCount === 1 ? "repository stays" : "repositories stay"} on GitHub, but ${projectCount === 1 ? "the project belongs" : "the projects belong"} to no team afterwards and will not be listed here. Move ${projectCount === 1 ? "it" : "them"} to another team first. This cannot be undone.`
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

function memberDisplayName(member: GroupMember | undefined): string {
  return member?.name || member?.login || "";
}

function TeamDetailsSettings({
  name,
  description,
  saving,
  dirty,
  onChangeName,
  onChangeDescription,
  onSave,
}: Readonly<{
  name: string;
  description: string;
  saving: boolean;
  dirty: boolean;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSave: () => void;
}>) {
  return (
    <section className="team-settings__block">
      <h4>Details</h4>
      <label className="hier-field">
        <span className="hier-field-label">Name</span>
        <input
          className="premium-input"
          value={name}
          onChange={(event) => onChangeName(event.target.value)}
          disabled={saving}
        />
      </label>
      <label className="hier-field">
        <span className="hier-field-label">Description</span>
        <textarea
          className="premium-input"
          rows={2}
          value={description}
          onChange={(event) => onChangeDescription(event.target.value)}
          disabled={saving}
        />
      </label>
      <div className="team-settings__actions">
        <button
          type="button"
          className="primary-button group-section-action"
          disabled={saving || !dirty}
          onClick={onSave}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </section>
  );
}

function TeamLeadPicker({
  candidates,
  transferTo,
  onChangeTransferTo,
  onAskConfirm,
}: Readonly<{
  candidates: GroupMember[];
  transferTo: string;
  onChangeTransferTo: (value: string) => void;
  onAskConfirm: () => void;
}>) {
  return (
    <div className="team-settings__actions">
      <select
        className="ws-select"
        value={transferTo}
        onChange={(event) => onChangeTransferTo(event.target.value)}
      >
        <option value="">Choose a member…</option>
        {candidates.map((member) => (
          <option key={member.userId} value={member.userId}>
            {memberDisplayName(member)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ghost-button group-section-action"
        disabled={!transferTo}
        onClick={onAskConfirm}
      >
        Transfer lead
      </button>
    </div>
  );
}

function TeamLeadConfirm({
  label,
  busy,
  onConfirm,
  onCancel,
}: Readonly<{
  label: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  return (
    <div className="team-settings__actions">
      <span className="team-settings__lede">
        Hand the team to <strong>{label}</strong>?
      </span>
      <button
        type="button"
        className="confirm-btn-danger group-section-action"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? "Transferring…" : "Yes, transfer"}
      </button>
      <button
        type="button"
        className="ghost-button group-section-action"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

function TeamLeadSettings({
  candidates,
  transferTo,
  confirmTransfer,
  busy,
  onChangeTransferTo,
  onAskConfirm,
  onConfirm,
  onCancel,
}: Readonly<{
  candidates: GroupMember[];
  transferTo: string;
  confirmTransfer: boolean;
  busy: boolean;
  onChangeTransferTo: (value: string) => void;
  onAskConfirm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  let body: ReactNode = (
    <p className="team-settings__lede">
      There is nobody to transfer to yet. Add another member first.
    </p>
  );
  if (candidates.length > 0 && !confirmTransfer) {
    body = (
      <TeamLeadPicker
        candidates={candidates}
        transferTo={transferTo}
        onChangeTransferTo={onChangeTransferTo}
        onAskConfirm={onAskConfirm}
      />
    );
  } else if (candidates.length > 0) {
    body = (
      <TeamLeadConfirm
        label={memberDisplayName(
          candidates.find((member) => member.userId === transferTo),
        )}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  }
  return (
    <section className="team-settings__block">
      <h4>Lead</h4>
      <p className="team-settings__lede">
        A team keeps exactly one Lead. Transferring hands it to another member
        and makes you a Delegated lead — the only way to change who owns a
        team without deleting it.
      </p>
      {body}
    </section>
  );
}

function TeamArchiveSettings({
  archived,
  busy,
  onToggle,
}: Readonly<{
  archived: boolean;
  busy: boolean;
  onToggle: () => void;
}>) {
  return (
    <section className="team-settings__block">
      <h4>{archived ? "Reopen" : "Archive"}</h4>
      <p className="team-settings__lede">
        {archived
          ? "This team is archived. Reopening restores it everywhere."
          : "Archiving hides the team without deleting anything. Its repositories stay on GitHub and it can be reopened."}
      </p>
      <div className="team-settings__actions">
        <button
          type="button"
          className="ghost-button group-section-action"
          disabled={busy}
          onClick={onToggle}
        >
          {archived ? "Reopen team" : "Archive team"}
        </button>
      </div>
    </section>
  );
}

/**
 * Everything a Lead can change about the team itself.
 *
 * These all existed on the backend and were reachable only from the older
 * /groups/[groupId] pages, so the surface the header actually sends people to
 * offered exactly one team-level action — DELETE. The reversible operations
 * were the missing ones, which is the wrong way round.
 */
function Settings({
  group,
  projectCount,
  onDeleted,
  onChanged,
}: {
  group: GroupSummary;
  projectCount: number;
  onDeleted?: (groupId: string) => void;
  onChanged?: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const members = useApiResource<GroupMember[]>(
    () => getGroupMembers(group.id),
    [group.id],
  );

  // Ownership can only move to somebody already on the team, and never to the
  // person who already holds it.
  const candidates = (members.data ?? []).filter(
    (member) => member.memberStatus === "active" && member.role !== "admin",
  );

  const archived = group.status === "archived";
  const dirty =
    name.trim() !== group.name ||
    description.trim() !== (group.description ?? "");

  function report(cause: unknown, fallback: string) {
    const detail = (cause as { details?: { message?: string | string[] } })
      ?.details;
    const detailMessage = Array.isArray(detail?.message)
      ? detail?.message.join(", ")
      : detail?.message;
    setError(detailMessage ?? fallback);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("A team needs a name.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setMessage("Saved.");
      onChanged?.();
    } catch (cause) {
      report(cause, "The team could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (archived) {
        await reopenGroup(group.id);
        setMessage("Team reopened.");
      } else {
        await archiveGroup(group.id);
        setMessage("Team archived. Its repositories stay on GitHub.");
      }
      onChanged?.();
    } catch (cause) {
      report(cause, "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer() {
    if (!transferTo) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await transferGroup(group.id, { newManagerUserId: transferTo });
      setMessage("Lead transferred.");
      setConfirmTransfer(false);
      setTransferTo("");
      members.reload();
      onChanged?.();
    } catch (cause) {
      report(cause, "Ownership could not be transferred.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="team-settings">
      <TeamDetailsSettings
        name={name}
        description={description}
        saving={saving}
        dirty={dirty}
        onChangeName={setName}
        onChangeDescription={setDescription}
        onSave={() => void handleSave()}
      />
      <TeamLeadSettings
        candidates={candidates}
        transferTo={transferTo}
        confirmTransfer={confirmTransfer}
        busy={busy}
        onChangeTransferTo={setTransferTo}
        onAskConfirm={() => setConfirmTransfer(true)}
        onConfirm={() => void handleTransfer()}
        onCancel={() => setConfirmTransfer(false)}
      />
      <TeamArchiveSettings
        archived={archived}
        busy={busy}
        onToggle={() => void handleArchiveToggle()}
      />
      {message ? (
        <p className="team-settings__ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className="group-danger-zone">
        <div>
          <strong>Delete this team</strong>
          <p>
            Removes the team and its membership. Its repositories stay on
            GitHub, but the projects end up belonging to no team and stop being
            listed here — move them to another team first.
          </p>
        </div>
        <DeleteGroupControl
          group={group}
          projectCount={projectCount}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}

function teamSectionGroups(
  group: GroupSummary,
  projects: ProvisionedProject[],
  canManage: boolean,
  hasQaChecklists: boolean,
): SideTabGroup<Exclude<GroupSection, "create">>[] {
  const workItems: Array<SideTabItem<Exclude<GroupSection, "create">>> = [
    { id: "projects", label: "Repositories", badge: projects.length },
  ];
  if (hasQaChecklists) workItems.push({ id: "qa-checklists", label: "QA checklists" });
  const groups: SideTabGroup<Exclude<GroupSection, "create">>[] = [
    { heading: "Team", items: [{ id: "overview", label: "Overview" }] },
    {
      heading: "People",
      items: [{ id: "members", label: "Members", badge: group.memberCount }],
    },
    { heading: "Work", items: workItems },
    { heading: "Records", items: [{ id: "activity", label: "Activity & audit" }] },
  ];
  if (canManage) {
    groups.push({
      heading: "Configuration",
      items: [{ id: "settings", label: "Settings" }],
    });
  }
  return groups;
}

function GroupCreateScreen({
  groupName,
  renderCreateProject,
  onBack,
}: Readonly<{
  groupName: string;
  renderCreateProject: (onComplete: () => void) => ReactNode;
  onBack: () => void;
}>) {
  return (
    <>
      <div className="project-detail-header">
        <div><h3>Create repository in {groupName}</h3><p>The repository will be owned by this team.</p></div>
        <button type="button" className="ghost-button" onClick={onBack}>Back to repositories</button>
      </div>
      {renderCreateProject(onBack)}
    </>
  );
}

function GroupSectionCount({
  current,
  memberCount,
  projectCount,
}: Readonly<{
  current: Exclude<GroupSection, "create">;
  memberCount: number;
  projectCount: number;
}>) {
  if (current === "members") {
    return <span className="group-section-count">{memberCount}</span>;
  }
  if (current === "projects") {
    return <span className="group-section-count">{projectCount}</span>;
  }
  return null;
}

function GroupSectionAction({
  current,
  canManage,
  canCreate,
  createHref,
  onAddMember,
  onCreate,
}: Readonly<{
  current: Exclude<GroupSection, "create">;
  canManage: boolean;
  canCreate: boolean;
  createHref?: string;
  onAddMember: () => void;
  onCreate: () => void;
}>) {
  if (current === "members" && canManage) {
    return (
      <button
        type="button"
        className="primary-button group-section-action"
        onClick={onAddMember}
      >
        Add member
      </button>
    );
  }
  if (current !== "projects" || !canCreate) return null;
  if (createHref) {
    return (
      <Link className="primary-button group-section-action" href={createHref}>
        Create repository
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="primary-button group-section-action"
      onClick={onCreate}
    >
      Create repository
    </button>
  );
}

function GroupSectionBody({
  current,
  group,
  projects,
  canCreate,
  canManage,
  addMemberOpen,
  onCloseAdd,
  onMembershipChanged,
  onDeleted,
}: Readonly<{
  current: Exclude<GroupSection, "create">;
  group: GroupSummary;
  projects: ProvisionedProject[];
  canCreate: boolean;
  canManage: boolean;
  addMemberOpen: boolean;
  onCloseAdd: () => void;
  onMembershipChanged?: () => void;
  onDeleted?: (groupId: string) => void;
}>) {
  if (current === "overview") return <Overview group={group} projects={projects} />;
  if (current === "members") {
    return (
      <Members
        group={group}
        addOpen={addMemberOpen}
        onCloseAdd={onCloseAdd}
        onMembershipChanged={onMembershipChanged}
      />
    );
  }
  if (current === "projects") {
    return <Projects projects={projects} canCreate={canCreate} />;
  }
  if (current === "activity") return <Activity group={group} />;
  if (current === "settings" && canManage) {
    return (
      <Settings
        group={group}
        projectCount={projects.length}
        onDeleted={onDeleted}
        onChanged={onMembershipChanged}
      />
    );
  }
  return null;
}

const SECTION_TITLES: Record<Exclude<GroupSection, "create">, string> = {
  overview: "Overview",
  members: "Members",
  projects: "Repositories",
  "qa-checklists": "QA checklists",
  activity: "Activity & audit",
  settings: "Settings",
};

/**
 * The section to draw. QA checklists falls back to Overview while the section
 * is unavailable (capability off, or not loaded yet) so a deep link never
 * lands on an empty panel.
 */
function visibleSection(section: GroupSection, hasQaChecklists: boolean): GroupSection {
  return section === "qa-checklists" && !hasQaChecklists ? "overview" : section;
}

export function GroupWorkspacePanel({ group, projects, renderCreateProject, createHref, onDeleted, onMembershipChanged, qaChecklists, initialSection }: Readonly<GroupWorkspacePanelProps>) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const { session } = useAuthSession();
  const [selectedSection, setSection] = useState<GroupSection>(initialSection ?? "overview");
  const hasQaChecklists = Boolean(qaChecklists);
  const section = visibleSection(selectedSection, hasQaChecklists);
  const canCreate = isGlobalCreatorRole(session?.appRole);
  const canManage = isGroupManagerRole(group.role);

  if (section === "create") {
    return (
      <GroupCreateScreen
        groupName={group.name}
        renderCreateProject={renderCreateProject}
        onBack={() => setSection("projects")}
      />
    );
  }

  const current = section;

  return (
    <div className="group-workspace">
      <SideTabs
        groups={teamSectionGroups(group, projects, canManage, hasQaChecklists)}
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
        {current === "qa-checklists" ? (
          // The section draws its own head row: its action depends on a
          // permission only it loads.
          qaChecklists
        ) : (
          <>
            <div className="group-section-head">
              <h3 className="group-section-title">
                {SECTION_TITLES[current]}
                <GroupSectionCount
                  current={current}
                  memberCount={group.memberCount}
                  projectCount={projects.length}
                />
              </h3>
              <GroupSectionAction
                current={current}
                canManage={canManage}
                canCreate={canCreate}
                createHref={createHref}
                onAddMember={() => setAddMemberOpen(true)}
                onCreate={() => setSection("create")}
              />
            </div>
            <GroupSectionBody
              current={current}
              group={group}
              projects={projects}
              canCreate={canCreate}
              canManage={canManage}
              addMemberOpen={addMemberOpen}
              onCloseAdd={() => setAddMemberOpen(false)}
              onMembershipChanged={onMembershipChanged}
              onDeleted={onDeleted}
            />
          </>
        )}
      </div>
    </div>
  );
}
