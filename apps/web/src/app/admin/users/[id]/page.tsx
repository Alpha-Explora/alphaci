"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAdminContext } from "@/components/admin/admin-gate";
import {
  ApiError,
  getAdminUser,
  resetUserAppRoleToGithub,
  setUserAppRole,
  APP_ROLE_LABELS,
  type AdminUserDetail,
  type AppRole,
} from "@/lib/api/client";

const ROLE_ORDER: AppRole[] = ["admin", "lead", "member"];

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  // Admins reach this page (AdminGate enforces it). Changing the ADMIN tier
  // (promote to Admin / demote an Admin) is the super-admin's power; a regular
  // Admin may only shuffle Lead/Member — mirrors the BE setAppRole guard.
  const { currentUserId, isSuperAdmin } = useAdminContext();

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

  /**
   * Unpins the user so GitHub team membership drives their role again. The role
   * itself does not change here — the backend has no GitHub token on this
   * request — so the message says what will actually happen rather than
   * implying an immediate change.
   */
  async function handleResetRole() {
    setRoleBusy(true);
    setRoleMessage(null);
    try {
      await resetUserAppRoleToGithub(id);
      await load();
      setRoleMessage(
        "Now following GitHub teams. The role updates on their next sign-in, or immediately if their team membership changes.",
      );
    } catch (cause) {
      setRoleMessage(`Failed to reset role: ${describeRoleError(cause)}`);
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
            disabled={
              roleBusy ||
              detail.id === currentUserId ||
              // Only the super-admin can touch the Admin tier — for everyone
              // else the control is read-only when the target is already an
              // Admin (can't demote) since Lead/Member changes are the only
              // ones they're allowed and those don't apply to an Admin.
              (!isSuperAdmin && detail.appRole === "admin")
            }
            onChange={(event) => void handleSetRole(event.target.value as AppRole)}
            style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem", borderRadius: "0.5rem", minWidth: "9rem" }}
          >
            {ROLE_ORDER.map((r) => (
              <option
                key={r}
                value={r}
                // A regular Admin cannot promote anyone to Admin.
                disabled={r === "admin" && !isSuperAdmin && detail.appRole !== "admin"}
              >
                {APP_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {/* Provenance — answers "why is this user a Lead?" without having to
              read the audit log. A 'manual' pin is the reason automatic GitHub
              team sync appears to be doing nothing for this user, so it is
              surfaced right next to the control that caused it. */}
          {detail.appRoleSource === "manual" ? (
            <span
              className="status-chip status-chip-amber"
              title="Set in the Console. GitHub team sync skips this user until it is reset."
            >
              pinned manually
            </span>
          ) : (
            <span
              className="status-chip status-chip-muted"
              title="Follows the GitHub org teams (team-lead / developers). Re-derived on each sign-in."
            >
              from GitHub teams
            </span>
          )}

          {detail.appRoleSource === "manual" && detail.id !== currentUserId && (
            <button
              type="button"
              className="ghost-button"
              disabled={roleBusy || (!isSuperAdmin && detail.appRole === "admin")}
              onClick={() => void handleResetRole()}
              style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem", minHeight: "2rem" }}
            >
              Reset to GitHub
            </button>
          )}

          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Admin = full access · Lead = create/manage groups & invite · Member = assigned repos only
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Setting a role here pins it — GitHub team changes stop applying to
            this user until you reset it.
          </span>
          {detail.id === currentUserId && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>You can&apos;t change your own role.</span>
          )}
          {!isSuperAdmin && detail.id !== currentUserId && (
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Only the super-admin can change Admin-level roles.</span>
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
