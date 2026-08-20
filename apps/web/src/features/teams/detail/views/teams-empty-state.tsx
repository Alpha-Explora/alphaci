"use client";

/** Shown when the caller belongs to no team at all. */
export function TeamsEmptyState() {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "2.5rem 1.5rem",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      <p
        style={{
          color: "var(--text-primary)",
          margin: 0,
          fontSize: "0.95rem",
          fontWeight: 700,
        }}
      >
        You are not in a team yet.
      </p>
      <p
        style={{
          color: "var(--text-secondary)",
          margin: 0,
          fontSize: "0.85rem",
          maxWidth: "32rem",
        }}
      >
        Use <strong>+ Create workspace</strong> in the header to make one — a
        workspace is a team. If you expect to be in one already, a team lead has
        to add you.
      </p>
    </div>
  );
}
