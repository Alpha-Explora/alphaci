"use client";

import Link from "next/link";

export function AdminHeader() {
  return (
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
        <Link
          href="/admin"
          style={{ fontWeight: 800, fontSize: "1.05rem", textDecoration: "none", color: "var(--text-primary)" }}
        >
          Admin Console
        </Link>
        <nav style={{ display: "flex", gap: "1rem", fontSize: "0.85rem" }}>
          <Link href="/admin" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Users</Link>
          <Link href="/admin/feedback" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Feedback</Link>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link href="/home" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem" }}>
          ← Back to app
        </Link>
      </div>
    </header>
  );
}
