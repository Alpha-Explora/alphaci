"use client";

import {
  GROUP_ROLE_LABELS,
  memberRoleLabel,
  type AssignmentStatus,
  type DeliveryProjectStatus,
  type GithubSyncState,
  type GroupMember,
  type GroupMemberStatus,
  type GroupRole,
  type GroupStatus,
  type RepositoryStatus,
  type SystemStatus,
} from "@/features/groups";

type Tone = "success" | "warning" | "danger" | "muted" | "brand";

function Badge({
  tone,
  label,
  dot = true,
  title,
}: {
  tone: Tone;
  label: string;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span className={`hier-badge hier-badge--${tone}`} title={title}>
      {dot && <span className="hier-badge-dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

/* ── Role (plan §2.1 display labels — never renders the raw enum) ──────────── */

// role === "admin" here is the top membership tier (label "Lead"); unrelated to
// the separate identity.platform_admins system.
export function RoleBadge({ role }: { role: GroupRole }) {
  const tone: Tone =
    role === "admin"
      ? "brand"
      : role === "delegated_lead"
        ? "brand"
        : role === "member"
          ? "muted"
          : "muted";
  return <Badge tone={tone} label={GROUP_ROLE_LABELS[role]} dot={false} />;
}

/* The labels a team's leading members carry: a Product owner or Admin by app
 * role, or the top membership tier ("Lead") on a row with no app role. */
const BRAND_ROLE_LABELS: ReadonlySet<string> = new Set(["Product owner", "Admin", "Lead"]);

/** Read-only role for a roster row: derived from the global app role. */
export function MemberRoleBadge({
  member,
}: {
  member: Pick<GroupMember, "role" | "appRole">;
}) {
  const label = memberRoleLabel(member);
  return <Badge tone={BRAND_ROLE_LABELS.has(label) ? "brand" : "muted"} label={label} dot={false} />;
}

/* ── Assignment access status (plan §2.2: pending|active|revoked|failed) ──── */

export function AccessStatusBadge({ status }: { status: AssignmentStatus }) {
  const map: Record<AssignmentStatus, { tone: Tone; label: string }> = {
    pending: { tone: "warning", label: "Pending" },
    active: { tone: "success", label: "Active" },
    revoked: { tone: "muted", label: "Revoked" },
    failed: { tone: "danger", label: "Failed" },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone} label={label} />;
}

/* ── GitHub sync state (plan §2.2) ────────────────────────────────────────── */

export function SyncStateBadge({ state }: { state: GithubSyncState }) {
  const map: Record<GithubSyncState, { tone: Tone; label: string }> = {
    pending: { tone: "muted", label: "Sync pending" },
    syncing: { tone: "warning", label: "Syncing" },
    verified: { tone: "success", label: "Verified" },
    failed: { tone: "danger", label: "Sync failed" },
    drift_detected: { tone: "warning", label: "Drift detected" },
  };
  const { tone, label } = map[state];
  return <Badge tone={tone} label={label} />;
}

/* ── Group / System / Delivery project status ─────────────────────────────── */

export function GroupStatusBadge({ status }: { status: GroupStatus }) {
  return status === "archived" ? (
    <Badge tone="muted" label="Archived" />
  ) : (
    <Badge tone="success" label="Active" />
  );
}

export function LifecycleStatusBadge({
  status,
}: {
  status: SystemStatus | DeliveryProjectStatus;
}) {
  return status === "archived" ? (
    <Badge tone="muted" label="Archived" />
  ) : (
    <Badge tone="success" label="Active" />
  );
}

/* ── Repository status (plan §2.2: pending|active|archived) ────────────────── */

export function RepositoryStatusBadge({
  status,
}: {
  status: RepositoryStatus;
}) {
  const map: Record<RepositoryStatus, { tone: Tone; label: string }> = {
    pending: { tone: "warning", label: "Provisioning" },
    active: { tone: "success", label: "Active" },
    archived: { tone: "muted", label: "Archived" },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone} label={label} />;
}

/* ── Member lifecycle status (plan §2.2: invited|active|removed) ───────────── */

export function MemberStatusBadge({ status }: { status: GroupMemberStatus }) {
  const map: Record<GroupMemberStatus, { tone: Tone; label: string }> = {
    invited: { tone: "warning", label: "Invited" },
    active: { tone: "success", label: "Active" },
    removed: { tone: "muted", label: "Removed" },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone} label={label} />;
}

