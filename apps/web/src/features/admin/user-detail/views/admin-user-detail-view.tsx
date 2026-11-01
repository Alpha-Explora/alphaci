"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useAdminContext } from "@/features/admin/users";

import { ROLE_ORDER } from "../../model/admin-rules";
import { APP_ROLE_LABELS, type AppRole } from "../../model/admin-types";
import { useAdminUserDetailViewModel } from "../view-models/use-admin-user-detail-view-model";

type UserDetail = NonNullable<
  ReturnType<typeof useAdminUserDetailViewModel>["detail"]
>;

/** Public view for one user in the admin console. */
export function AdminUserDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  // Admins reach this page (AdminGate enforces it). Changing the ADMIN tier
  // (promote to Admin / demote an Admin) is the super-admin's power; a regular
  // Admin may only shuffle Lead/Member — mirrors the BE setAppRole guard.
  const { currentUserId, isSuperAdmin } = useAdminContext();
  const vm = useAdminUserDetailViewModel(id);

  // Aliases onto the view-model; the markup below is the route's, moved.
  const detail = vm.detail;
  const loading = vm.status === "loading";
  const error = vm.error;
  const roleBusy = vm.roleBusy;
  const roleMessage = vm.roleMessage;
  const handleSetRole = (next: AppRole) => void vm.setRole(next);
  const handleResetRole = () => void vm.resetRoleToGithub();

  if (loading) return <p style={{ color: "var(--text-secondary)" }}>Loading user…</p>;
  if (error || !detail) {
    return (
      <div className="error-inline glass-panel" role="alert" style={{ background: "rgba(248, 113, 113, 0.05)" }}>
        <span className="error-inline-icon" aria-hidden="true">!</span>
        <p className="error-inline-msg">{error ?? "User not found."}</p>
        <Link className="error-retry-btn" href="/admin">Back to users</Link>
      </div>
    );
  }

  return (
    <section aria-label="User detail" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Link href="/admin" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem" }}>← All users</Link>

      <UserHeader detail={detail} />
      <RoleControl
        detail={detail}
        currentUserId={currentUserId}
        isSuperAdmin={isSuperAdmin}
        roleBusy={roleBusy}
        roleMessage={roleMessage}
        onSetRole={handleSetRole}
        onResetRole={handleResetRole}
      />
      <DetailPanels detail={detail} />
    </section>
  );
}

function UserHeader({ detail }: Readonly<{ detail: UserDetail }>) {
  return (
    <header className="glass-panel" style={{ padding: "1.25rem 1.5rem", borderRadius: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>{detail.login}</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
            {detail.displayName ?? "—"}{detail.email ? ` · ${detail.email}` : ""}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.35rem 0 0", fontFamily: "ui-monospace, monospace" }}>{detail.id}</p>
        </div>
        {detail.subscription && (
          <span className="status-chip status-chip-brand" style={{ alignSelf: "start" }}>
            {detail.subscription.plan} · {detail.subscription.status}
          </span>
        )}
      </div>
    </header>
  );
}

function RoleControl({
  detail, currentUserId, isSuperAdmin, roleBusy, roleMessage, onSetRole, onResetRole,
}: Readonly<{
  detail: UserDetail;
  currentUserId: string | null;
  isSuperAdmin: boolean;
  roleBusy: boolean;
  roleMessage: string | null;
  onSetRole: (role: AppRole) => void;
  onResetRole: () => void;
}>) {
  return (
    <div className="glass-panel" style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Role</span>
      <RoleSelect detail={detail} currentUserId={currentUserId} isSuperAdmin={isSuperAdmin} roleBusy={roleBusy} onSetRole={onSetRole} />
      <RoleProvenance detail={detail} currentUserId={currentUserId} isSuperAdmin={isSuperAdmin} roleBusy={roleBusy} onResetRole={onResetRole} />
      <RoleMessages detail={detail} currentUserId={currentUserId} isSuperAdmin={isSuperAdmin} roleMessage={roleMessage} />
    </div>
  );
}

function RoleSelect({ detail, currentUserId, isSuperAdmin, roleBusy, onSetRole }: Readonly<{
  detail: UserDetail; currentUserId: string | null; isSuperAdmin: boolean; roleBusy: boolean;
  onSetRole: (role: AppRole) => void;
}>) {
  const disabled = roleBusy || detail.id === currentUserId || (!isSuperAdmin && detail.appRole === "admin");
  return (
    <select aria-label="Global role" value={detail.appRole} disabled={disabled}
      onChange={(event) => onSetRole(event.target.value as AppRole)}
      style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", borderRadius: "0.5rem", minWidth: "9rem" }}>
      {ROLE_ORDER.map((role) => (
        <option key={role} value={role} disabled={role === "admin" && !isSuperAdmin && detail.appRole !== "admin"}>
          {APP_ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

function RoleProvenance({ detail, currentUserId, isSuperAdmin, roleBusy, onResetRole }: Readonly<{
  detail: UserDetail; currentUserId: string | null; isSuperAdmin: boolean; roleBusy: boolean; onResetRole: () => void;
}>) {
  const manual = detail.appRoleSource === "manual";
  return (
    <>
      <span className={`status-chip ${manual ? "status-chip-amber" : "status-chip-muted"}`}
        title={manual ? "Set in the Console. GitHub team sync skips this user until it is reset." : "Follows the GitHub org teams (team-lead / developers). Re-derived on each sign-in."}>
        {manual ? "pinned manually" : "from GitHub teams"}
      </span>
      {manual && detail.id !== currentUserId && (
        <button type="button" className="ghost-button"
          disabled={roleBusy || (!isSuperAdmin && detail.appRole === "admin")}
          onClick={onResetRole}
          style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem", minHeight: "2rem" }}>
          Reset to GitHub
        </button>
      )}
    </>
  );
}

function RoleMessages({ detail, currentUserId, isSuperAdmin, roleMessage }: Readonly<{
  detail: UserDetail; currentUserId: string | null; isSuperAdmin: boolean; roleMessage: string | null;
}>) {
  return (
    <>
      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Admin = full access · Lead = create/manage groups & invite · Member = assigned repos only</span>
      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Setting a role here pins it — GitHub team changes stop applying to this user until you reset it.</span>
      {detail.id === currentUserId && <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>You can&apos;t change your own role.</span>}
      {!isSuperAdmin && detail.id !== currentUserId && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Only the super-admin can change Admin-level roles.</span>}
      {roleMessage && <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{roleMessage}</span>}
    </>
  );
}

function DetailPanels({ detail }: Readonly<{ detail: UserDetail }>) {
  return (
    <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
      <RecentErrorsPanel detail={detail} />
      <ProjectsPanel detail={detail} />
      <WorkflowsPanel detail={detail} />
      <ActivityPanel detail={detail} />
    </div>
  );
}

function RecentErrorsPanel({ detail }: Readonly<{ detail: UserDetail }>) {
  return <Panel title={`Recent errors (${detail.recentErrors.length})`}>{detail.recentErrors.length === 0 ? <Empty label="No recent failures." /> : detail.recentErrors.map((err) => (
    <div key={err.id} style={rowStyle}><span className="status-chip status-chip-danger">{err.stage}</span><span style={{ fontSize: "0.8rem" }}>{err.repo_full_name}</span><span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{err.branch} · {fmt(err.created_at)}</span></div>
  ))}</Panel>;
}

function ProjectsPanel({ detail }: Readonly<{ detail: UserDetail }>) {
  return <Panel title={`Projects (${detail.projects.length})`}>{detail.projects.length === 0 ? <Empty label="No projects." /> : detail.projects.map((project) => (
    <div key={project.id} style={rowStyle}><span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{project.repo_full_name}</span><span className={`status-chip ${project.status === "provisioned" ? "status-chip-success" : "status-chip-muted"}`}>{project.status}</span>{project.is_example && <span className="status-chip status-chip-muted">example</span>}</div>
  ))}</Panel>;
}

function WorkflowsPanel({ detail }: Readonly<{ detail: UserDetail }>) {
  return <Panel title={`Workflows (${detail.workflows.length})`}>{detail.workflows.length === 0 ? <Empty label="No workflows generated." /> : detail.workflows.map((workflow) => (
    <div key={workflow.id} style={rowStyle}><span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{workflow.service_name}</span><span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{workflow.stack} · {fmt(workflow.created_at)}</span></div>
  ))}</Panel>;
}

function ActivityPanel({ detail }: Readonly<{ detail: UserDetail }>) {
  return <Panel title={`Activity (${detail.recentActivity.length})`}>{detail.recentActivity.length === 0 ? <Empty label="No recent activity." /> : detail.recentActivity.map((activity) => (
    <div key={activity.id} style={rowStyle}><span style={{ fontSize: "0.78rem", fontFamily: "ui-monospace, monospace" }}>{activity.event_code}</span><span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{fmt(activity.created_at)}</span></div>
  ))}</Panel>;
}

function Panel({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="glass-panel" style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem" }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>{children}</div>
    </div>
  );
}

function Empty({ label }: Readonly<{ label: string }>) {
  return <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: 0 }}>{label}</p>;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
  paddingBottom: "0.4rem",
  borderBottom: "1px solid var(--border-soft)",
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
