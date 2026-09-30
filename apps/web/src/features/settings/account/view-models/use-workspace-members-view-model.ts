"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkspaceMemberSummary } from "@/shared/api/contracts";

import { settingsRepository } from "../../data/settings-repository";

export interface WorkspaceMembersViewModel {
  status: "loading" | "ready" | "error";
  members: WorkspaceMemberSummary[];
  /** Safe to render. Never an API detail. */
  error: string | null;
}

interface Loaded {
  workspaceId: string;
  members: WorkspaceMemberSummary[] | null;
  error: string | null;
}

/**
 * ViewModel for one workspace's member list on the Settings page. Read-only:
 * adding, re-roling and removing members happens on /teams, and the backend is
 * retiring the /workspaces/:id/members write routes this page used to call.
 *
 * Results are kept with the workspace they belong to, so the status is
 * derived rather than reset by an effect, and a request counter stops a slow
 * first response overwriting a fast second one.
 */
export function useWorkspaceMembersViewModel(workspaceId: string): WorkspaceMembersViewModel {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    const id = request.current;
    settingsRepository
      .workspaceMembers(workspaceId)
      .then((members) => {
        if (id === request.current) setLoaded({ workspaceId, members, error: null });
      })
      .catch(() => {
        if (id === request.current) {
          setLoaded({
            workspaceId,
            members: null,
            error: "Workspace members are unavailable right now.",
          });
        }
      });
  }, [workspaceId]);

  const current = loaded && loaded.workspaceId === workspaceId ? loaded : null;
  if (!current) return { status: "loading", members: [], error: null };
  if (current.error) return { status: "error", members: [], error: current.error };
  return { status: "ready", members: current.members ?? [], error: null };
}
