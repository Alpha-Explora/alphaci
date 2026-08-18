"use client";

import Link from "next/link";

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

/**
 * The team picker, in the header.
 *
 * Groups ARE workspaces (`orgs.workspaces` with `kind='team'`), so switching
 * workspace IS switching team — this is the only control that changes what the
 * rest of the app is scoped to.
 *
 * It renders as a <select> even with a single entry. Falling back to plain text
 * there was worse than it sounds: a lead with one team saw a label, learned the
 * app had no team switcher, and never looked again after joining a second.
 * A control that appears only once you already have the problem is a control
 * nobody discovers.
 */
export function WorkspaceSwitcher({
  workspaces,
}: Readonly<{
  workspaces: WorkspacesMeResponse | null;
}>) {
  const { selectedWorkspace, selectedWorkspaceId, setSelectedWorkspaceId } =
    useWorkspaceSelection();
  const items = workspaces?.items ?? [];
  const current =
    items.find((workspace) => workspace.id === selectedWorkspaceId) ??
    selectedWorkspace ??
    items[0] ??
    null;

  if (workspaces?.enabled === false || items.length === 0) {
    return null;
  }

  return (
    <div className="team-switcher">
      <label className="team-switcher-field">
        <span className="sr-only">Active team</span>
        <select
          aria-label="Active team"
          value={current?.id ?? ""}
          onChange={(event) => setSelectedWorkspaceId(event.target.value || null)}
          className="team-switcher-select"
        >
          {items.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      <span className="team-switcher-role">
        {current ? roleAwareWorkspaceLabel(current) : "Loading"}
      </span>
      {/* The rail no longer has a Teams entry, so this is the only route to
          team management. Without it /teams would be unreachable. */}
      <Link href="/teams" className="team-switcher-manage">
        Manage
      </Link>
    </div>
  );
}
