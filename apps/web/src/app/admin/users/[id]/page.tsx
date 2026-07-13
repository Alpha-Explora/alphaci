"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAdminContext } from "@/components/admin/admin-gate";
import {
  ApiError,
  getAdminUser,
  setUserAppRole,
  APP_ROLE_LABELS,
  type AdminUserDetail,
  type AppRole,
} from "@/lib/api/client";

const ROLE_ORDER: AppRole[] = ["admin", "lead", "member"];

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  // Any platform admin reaching this page (AdminGate already enforces that) may
  // assign hierarchy roles — matching the BE, which gates PATCH app-role on the
  // class-level PlatformAdminGuard rather than super-admin.
  const { currentUserId } = useAdminContext();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getAdminUser(id));
    } catch {
      setError("Could not load this user.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSetRole(next: AppRole) {
    setRoleBusy(true);
    setRoleMessage(null);
    try {
      await setUserAppRole(id, next);
      await load();
      setRoleMessage(`Role set to ${APP_ROLE_LABELS[next]}.`);
    } catch (cause) {
      setRoleMessage(`Failed to update role: ${describeRoleError(cause)}`);
    } finally {
      setRoleBusy(false);
    }
  }

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

      <div className="glass-panel" style={{ padding: "1rem 1.25rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Role</span>
          <select
            aria-label="Global role"
            value={detail.appRole}
            disabled={roleBusy || detail.id === currentUserId}
            onChange={(event) => void handleSetRole(event.target.value as AppRole)}
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", borderRadius: "0.5rem", minWidth: "9rem" }}
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {APP_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Admin = full access · Lead = create/manage groups & invite · Member = assigned repos only
          </span>
          {detail.id === currentUserId && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>You can&apos;t change your own role.</span>
          )}
          {roleMessage && <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{roleMessage}</span>}
        </div>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
        <Panel title={`Recent errors (${detail.recentErrors.length})`}>
          {detail.recentErrors.length === 0 ? (
            <Empty label="No recent failures." />
          ) : (
            detail.recentErrors.map((err) => (
              <div key={err.id} style={rowStyle}>
                <span className="status-chip status-chip-danger">{err.stage}</span>
                <span style={{ fontSize: "0.8rem" }}>{err.repo_full_name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{err.branch} · {fmt(err.created_at)}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel title={`Projects (${detail.projects.length})`}>
          {detail.projects.length === 0 ? (
            <Empty label="No projects." />
          ) : (
            detail.projects.map((p) => (
              <div key={p.id} style={rowStyle}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{p.repo_full_name}</span>
                <span className={`status-chip ${p.status === "provisioned" ? "status-chip-success" : "status-chip-muted"}`}>{p.status}</span>
                {p.is_example && <span className="status-chip status-chip-muted">example</span>}
              </div>
            ))
          )}
        </Panel>

        <Panel title={`Workflows (${detail.workflows.length})`}>
          {detail.workflows.length === 0 ? (
            <Empty label="No workflows generated." />
          ) : (
            detail.workflows.map((w) => (
              <div key={w.id} style={rowStyle}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{w.service_name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{w.stack} · {fmt(w.created_at)}</span>
              </div>
            ))
          )}
        </Panel>

        <Panel title={`Activity (${detail.recentActivity.length})`}>
          {detail.recentActivity.length === 0 ? (
            <Empty label="No recent activity." />
          ) : (
            detail.recentActivity.map((a) => (
              <div key={a.id} style={rowStyle}>
                <span style={{ fontSize: "0.78rem", fontFamily: "ui-monospace, monospace" }}>{a.event_code}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{fmt(a.created_at)}</span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </section>
  );
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

/**
 * Turns a failed role-update into a message the admin can act on. NestJS returns
 * `{ statusCode, message, error }`; a 403 means the actor lacks platform-admin
 * rights, a 400 is a business-rule rejection (e.g. self-lockout) whose `message`
 * is worth showing verbatim. Anything else falls back to the HTTP status.
 */
function describeRoleError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 403) return "you need platform-admin access.";
    const detail = cause.details as { message?: string | string[] } | undefined;
    const message = Array.isArray(detail?.message)
      ? detail?.message.join(", ")
      : detail?.message;
    return message ?? `request failed (${cause.status}).`;
  }
  return "unexpected error. Please try again.";
}
