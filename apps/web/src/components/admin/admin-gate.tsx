"use client";

import Link from "next/link";
import { createContext, useContext } from "react";

import { useAuthSession } from "@/hooks/use-auth-session";
import type { PlatformRole } from "@/lib/api/contracts";

interface AdminContextValue {
  role: PlatformRole;
  isSuperAdmin: boolean;
  currentUserId: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error("useAdminContext must be used within <AdminGate>");
  }
  return ctx;
}

/**
 * Client-side gate for the /admin surface. This is a UX guard only — the real
 * authorization is enforced server-side by the BE PlatformAdminGuard. It blocks
 * the admin UI from rendering for non-admins and exposes the caller's role to
 * child pages (so super-admin-only actions can be conditionally shown).
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { status, session } = useAuthSession();

  if (status === "loading") {
    return (
      <main className="dash-shell" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>Verifying admin access…</p>
      </main>
    );
  }

  if (status !== "signed-in" || !session?.authenticated || !session.platformRole) {
    return (
      <main className="dash-shell" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div className="glass-panel" style={{ textAlign: "center", padding: "3rem 2rem", maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>Admin access required</h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            This area is restricted to platform administrators.
          </p>
          <Link className="primary-button" href="/home" style={{ padding: "0.6rem 1.4rem" }}>
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const platformRole = session.platformRole;

  return (
    <AdminContext.Provider
      value={{
        role: platformRole,
        isSuperAdmin: platformRole === "super_admin",
        currentUserId: session.user.id,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}
