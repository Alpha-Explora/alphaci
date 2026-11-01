"use client";

import { useState } from "react";

import { CreateGroupDialog } from "@/features/groups/create";

/**
 * Shown when the caller belongs to no team at all.
 *
 * A Lead or Admin gets the button here, not a sentence pointing at the header.
 * This is the screen they land on with nothing to their name, so the one action
 * that resolves the state belongs on it — telling someone where else to click
 * is a worse answer than letting them click.
 *
 * A Developer keeps the explanatory copy, because for them the resolution
 * genuinely is somebody else adding them.
 */
export function TeamsEmptyState({
  canCreate = false,
  onCreated,
}: Readonly<{
  canCreate?: boolean;
  /** Lets the page reload itself once the workspace exists. */
  onCreated?: (workspaceId: string) => void;
}>) {
  const [createOpen, setCreateOpen] = useState(false);

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
        {canCreate
          ? "A workspace is a team. Create one to start adding people and projects to it."
          : "A team lead has to add you to one. Once they do, their projects appear here."}
      </p>

      {canCreate ? (
        <>
          <button
            type="button"
            className="primary-button"
            data-testid="teams-create-workspace-button"
            style={{ marginTop: "0.5rem" }}
            onClick={() => setCreateOpen(true)}
          >
            + Create workspace
          </button>
          <CreateGroupDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={(group) => onCreated?.(group.id)}
          />
        </>
      ) : null}
    </div>
  );
}
