import Link from "next/link";

import { AdminGate } from "@/components/admin/admin-gate";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminGate>
      <div className="admin-shell" style={{ minHeight: "100vh" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem var(--layout-gutter, 1.5rem)",
            borderBottom: "1px solid var(--border-soft)",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <Link href="/admin" style={{ fontWeight: 800, fontSize: "1.05rem", textDecoration: "none", color: "var(--text-primary)" }}>
              Admin Console
            </Link>
            <nav style={{ display: "flex", gap: "1rem", fontSize: "0.85rem" }}>
              <Link href="/admin" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Users</Link>
              <Link href="/admin/feedback" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Feedback</Link>
            </nav>
          </div>
          <Link href="/home" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem" }}>
            ← Back to app
          </Link>
        </header>
        <div style={{ padding: "1.5rem var(--layout-gutter, 1.5rem)" }}>{children}</div>
      </div>
    </AdminGate>
  );
}
