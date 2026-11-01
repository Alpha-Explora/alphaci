"use client";

/* Preserve local-storage hydration and the initial workspace probe timing. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";

import { getVisibleTeams, getWorkspaces } from "../data/workspace-repository";
import { useWorkspaceSelection } from "../views/workspace-selection-context";
import {
  adminOtherTeams,
  type WorkspaceSummary,
  type WorkspacesMeResponse,
} from "../model/workspace-types";

export type WorkspaceSelectionStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceSelectionViewModel {
  workspaces: WorkspacesMeResponse | null;
  /** A platform admin's non-member teams; empty for everybody else. */
  otherTeams: WorkspaceSummary[];
  status: WorkspaceSelectionStatus;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
}

const NO_TEAMS: WorkspaceSummary[] = [];

/**
 * The other-teams list for a platform admin, or none. A failure here only
 * costs the extra heading, never the admin's own teams, so it resolves empty.
 */
async function loadOtherTeams(
  includeOtherTeams: boolean,
  members: Promise<WorkspacesMeResponse>,
): Promise<WorkspaceSummary[]> {
  if (!includeOtherTeams) return NO_TEAMS;
  try {
    const [mine, visible] = await Promise.all([members, getVisibleTeams()]);
    return adminOtherTeams(mine.items, visible);
  } catch {
    return NO_TEAMS;
  }
}

/**
 * Owns the workspace list request while the context owns selection persistence.
 *
 * For a platform admin it also reads every team (`/groups`) in parallel and
 * publishes both lists in ONE update, so a remembered selection of a team the
 * admin is not in survives validation instead of being reset to their first
 * own team while the second request is still in flight.
 */
export function useWorkspaceSelectionViewModel(options: {
  enabled: boolean;
  /** Platform admins only: also list the teams they are not a member of. */
  includeOtherTeams?: boolean;
}): WorkspaceSelectionViewModel {
  const { enabled, includeOtherTeams = false } = options;
  const { setWorkspaces, registerWorkspaceRefresh } = useWorkspaceSelection();
  const [workspaces, setWorkspacesState] = useState<WorkspacesMeResponse | null>(null);
  const [otherTeams, setOtherTeams] = useState<WorkspaceSummary[]>(NO_TEAMS);
  const [status, setStatus] = useState<WorkspaceSelectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadWorkspaces = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    setStatus("loading");
    setError(null);
    const members = getWorkspaces();
    const others = loadOtherTeams(includeOtherTeams, members);
    try {
      const [response, otherList] = await Promise.all([members, others]);
      if (id !== requestId.current) return;
      setWorkspacesState(response);
      setOtherTeams(otherList);
      setWorkspaces(response, otherList);
      setStatus("ready");
    } catch {
      if (id !== requestId.current) return;
      const unavailable: WorkspacesMeResponse = { enabled: false, items: [] };
      setWorkspacesState(unavailable);
      setOtherTeams(NO_TEAMS);
      setWorkspaces(null, NO_TEAMS);
      setStatus("error");
      setError("Workspaces are unavailable right now.");
    }
  }, [enabled, includeOtherTeams, setWorkspaces]);

  useEffect(() => {
    registerWorkspaceRefresh(() => {
      void loadWorkspaces();
    });
  }, [loadWorkspaces, registerWorkspaceRefresh]);

  useEffect(() => {
    if (!enabled) return;
    void loadWorkspaces();
  }, [enabled, loadWorkspaces]);

  return { workspaces, otherTeams, status, error, loadWorkspaces };
}
