"use client";

import type { WorkspacesMeResponse } from "@/lib/api/contracts";
import { useWorkspaceSelection } from "./workspace-context";

function roleAwareWorkspaceLabel(workspace: {
  kind: "personal" | "team";
  role: "admin" | "delegated_lead" | "member" | "viewer";
}): string {
  if (workspace.kind === "personal") return "Personal owner";
  if (workspace.role === "admin") return "Team lead";
  if (workspace.role === "delegated_lead") return "Delegated team lead";
  if (workspace.role === "viewer") return "View-only team access";
  return "Team member";
}

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: WorkspacesMeResponse | null;
}) {
  const { selectedWorkspace, selectedWorkspaceId, setSelectedWorkspaceId } =
    useWorkspaceSelection();
  const items = workspaces?.items ?? [];
  const current =
    items.find((workspace) => workspace.id === selectedWorkspaceId) ??
    selectedWorkspace ??
    items[0] ??
    null;

  if (workspaces?.enabled === false) {
    return null;
  }

  if (items.length > 1) {
    return (
      <label className="workspace-switcher">
        <span className="workspace-switcher-label">Workspace</span>
        <select
          aria-label="Current workspace"
          value={current?.id ?? ""}
          onChange={(event) => setSelectedWorkspaceId(event.target.value || null)}
        >
          {items.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} — {roleAwareWorkspaceLabel(workspace)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="workspace-switcher" aria-label="Current workspace">
      <span className="workspace-switcher-label">Workspace</span>
      <span className="workspace-switcher-name">{current?.name ?? "Workspace"}</span>
      <span className="workspace-switcher-role">
        {current ? roleAwareWorkspaceLabel(current) : "Loading workspace"}
      </span>
    </div>
  );
}
