"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import {
  archiveGroup,
  getGroup,
  reopenGroup,
  updateGroup,
} from "@/lib/api/client";
import type { GroupSummary } from "@/lib/api/hierarchy-contracts";
import { isGroupManagerRole } from "@/lib/api/hierarchy-contracts";
import { useApiResource } from "@/hooks/use-hierarchy";
import {
  GroupStatusBadge,
  RoleBadge,
} from "@/components/hierarchy/badges";
import {
  Breadcrumb,
  FormDialog,
  GroupSubNav,
  HierarchyPageShell,
  PageHeader,
  ResourceBoundary,
} from "@/components/hierarchy/primitives";

function EditGroupDialog({
  open,
  group,
  onClose,
  onSaved,
}: {
  open: boolean;
  group: GroupSummary;
  onClose: () => void;
  onSaved: (group: GroupSummary) => void;
}) {
  const [name, setName] = useState(group.name);
  const [businessUnit, setBusinessUnit] = useState(group.businessUnit ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateGroup(group.id, {
        name: name.trim(),
        businessUnit: businessUnit.trim() || undefined,
        description: description.trim() || undefined,
      });
      onSaved(updated);
      onClose();
    } catch {
      setError("The group could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Edit group"
      submitLabel="Save changes"
      submitting={submitting}
      error={error}
      canSubmit={name.trim().length > 0}
      onSubmit={handleSubmit}
    >
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="edit-group-name">
          Group name
        </label>
        <input
          id="edit-group-name"
          className="hier-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="edit-group-bu">
          Business unit <span className="hier-field-hint">(optional)</span>
        </label>
        <input
          id="edit-group-bu"
          className="hier-input"
          value={businessUnit}
          onChange={(event) => setBusinessUnit(event.target.value)}
          maxLength={120}
        />
      </div>
      <div className="hier-field">
        <label className="hier-field-label" htmlFor="edit-group-desc">
          Description <span className="hier-field-hint">(optional)</span>
        </label>
        <textarea
          id="edit-group-desc"
          className="hier-textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
      </div>
    </FormDialog>
  );
}

function NavCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="hier-card">
      <div className="hier-card-top">
        <h3 className="hier-card-name">{title}</h3>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
      <p className="hier-card-desc">{description}</p>
    </Link>
  );
}

function GroupOverview({ groupId }: { groupId: string }) {
  const { data, state, reload, setData } = useApiResource<GroupSummary>(
    () => getGroup(groupId),
    [groupId],
  );
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const group = data;
  const canManage = isGroupManagerRole(group?.role);

  async function handleArchiveToggle() {
    if (!group) return;
    setBusy(true);
    try {
      const updated =
        group.status === "archived"
          ? await reopenGroup(group.id)
          : await archiveGroup(group.id);
      setData(() => updated);
    } catch {
      // Non-fatal — surface nothing destructive; reload to re-sync truth.
      reload();
    } finally {
      setBusy(false);
    }
  }

  if (state !== "ready" || !group) {
    return (
      <>
        <Breadcrumb items={[{ label: "Projects", href: "/workflows" }, { label: "Group" }]} />
        <ResourceBoundary
          state={state}
          onRetry={reload}
          notFoundTitle="Group not found"
          notFoundMessage="This group doesn't exist, or you're not a member of it."
        />
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Projects", href: "/workflows" }, { label: group.name }]} />
      <PageHeader
        title={group.name}
        subtitle={group.description ?? group.businessUnit ?? undefined}
        actions={
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <GroupStatusBadge status={group.status} />
            <RoleBadge role={group.role} />
            {canManage && (
              <button type="button" className="hier-btn-sm" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            )}
            {/* Archive is top-tier ('admin', label "Lead") / platform-admin per plan
                §2.4; this wire value is unrelated to identity.platform_admins. */}
            {group.role === "admin" && (
              <button
                type="button"
                className="hier-btn-sm"
                onClick={() => void handleArchiveToggle()}
                disabled={busy}
              >
                {group.status === "archived" ? "Reopen" : "Archive"}
              </button>
            )}
          </div>
        }
      />

      <GroupSubNav groupId={group.id} active="overview" />

      <div className="hier-stat-row" style={{ marginBottom: "1.25rem" }}>
        <div className="hier-stat">
          <span className="hier-stat-num">{group.memberCount}</span>
          <span className="hier-stat-label">Members</span>
        </div>
        <div className="hier-stat">
          <span className="hier-stat-num">{group.systemCount}</span>
          <span className="hier-stat-label">Projects</span>
        </div>
        <div className="hier-stat">
          <span className="hier-stat-num" style={{ textTransform: "capitalize", fontSize: "1.1rem" }}>
            {group.status}
          </span>
          <span className="hier-stat-label">Status</span>
        </div>
      </div>

      <div className="hier-card-grid" style={{ marginBottom: "1.25rem" }}>
        <NavCard
          href={`/groups/${group.id}/members`}
          title="Members"
          description="Manage who belongs to this group and their roles. Members are added directly — there is no invitation to accept."
        />
        <NavCard
          href={`/groups/${group.id}/systems`}
          title="Projects"
          description="Projects owned by this group. Each project provisions a GitHub repository."
        />
        <NavCard
          href={`/groups/${group.id}/activity`}
          title="Activity & audit"
          description="Membership changes, assignment grants/revokes, and GitHub synchronization results."
        />
      </div>

      <div className="hier-comingsoon" role="note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Group communication (announcements &amp; channels) is coming soon.
      </div>

      {canManage && (
        <EditGroupDialog
          open={editOpen}
          group={group}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setData(() => updated)}
        />
      )}
    </>
  );
}

export default function GroupOverviewPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  return (
    <HierarchyPageShell>{() => <GroupOverview groupId={groupId} />}</HierarchyPageShell>
  );
}
