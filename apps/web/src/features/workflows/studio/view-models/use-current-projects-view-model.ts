"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getGroups, type GroupSummary } from "@/features/groups";
import { useWorkspaceSelection } from "@/features/workspace/selection";

import {
  headerTeam,
  linkedProjectFolderId,
  nextNewProjectTeam,
  readProjectsDeepLink,
} from "../model/current-projects-rules";

export type CurrentProjectsStatus = "loading" | "ready" | "error";

export const GROUPS_LOAD_ERROR = "Could not load teams.";

interface GroupsResult {
  workspaceId: string | null;
  groups: GroupSummary[];
  failed: boolean;
}

function statusOf(
  loadingProjects: boolean,
  result: GroupsResult | null,
): CurrentProjectsStatus {
  if (loadingProjects || result === null) return "loading";
  return result.failed ? "error" : "ready";
}

/**
 * ViewModel for the projects view of /workflows: the team on the page and the
 * Project a link asks it to open.
 *
 * The team is ALWAYS the header's selection — the page has no picker of its
 * own to disagree with it. A `?group=` link reaches the header instead: the
 * studio seeds WorkspaceProvider with it on arrival. The teams come from
 * `getGroups()` (for a platform admin, every team — the header lists the ones
 * they are not in, merged into the header picker), which is what supplies the
 * team record the explorer needs.
 */
export function useCurrentProjectsViewModel(options: { loadingProjects: boolean }) {
  const { loadingProjects } = options;
  const [result, setResult] = useState<GroupsResult | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const requestId = useRef(0);

  const searchParams = useSearchParams();
  const { selectedWorkspaceId } = useWorkspaceSelection();
  // Read once on arrival: the link says which Project to open first.
  const [link] = useState(() => readProjectsDeepLink(searchParams));

  useEffect(() => {
    const requests = requestId;
    const id = ++requests.current;
    getGroups()
      .then((items) => {
        if (id !== requests.current) return;
        setResult({ workspaceId: selectedWorkspaceId, groups: items, failed: false });
      })
      .catch(() => {
        if (id !== requests.current) return;
        setResult({ workspaceId: selectedWorkspaceId, groups: [], failed: true });
      });
    return () => {
      requests.current++;
    };
  }, [loadKey, selectedWorkspaceId]);

  const currentResult = result?.workspaceId === selectedWorkspaceId ? result : null;
  const groups = currentResult?.groups ?? null;

  const team = useMemo(
    () => headerTeam(groups ?? [], selectedWorkspaceId),
    [groups, selectedWorkspaceId],
  );

  // `?new=project` opens the New Project dialog once, on the first team the
  // page shows. Derived while rendering (state from a changing input).
  const [newProjectTeam, setNewProjectTeam] = useState<string | null | undefined>(() =>
    link.opensNewProject ? undefined : null,
  );
  const nextTeam = nextNewProjectTeam(newProjectTeam, team?.id ?? null);
  if (nextTeam !== newProjectTeam) setNewProjectTeam(nextTeam);

  function retry() {
    setResult(null);
    setLoadKey((key) => key + 1);
  }

  return {
    status: statusOf(loadingProjects, currentResult),
    /** The header's team, or null when the caller is in none. */
    team,
    /** The Project a `?project=` link opens on this team, or null. */
    linkedFolderId: team ? linkedProjectFolderId(link, team.id) : null,
    /** Open the New Project dialog on arrival (a `?new=project` link), on this team. */
    opensNewProject: team !== null && nextTeam === team.id,
    retry,
  };
}

export type CurrentProjectsViewModel = ReturnType<typeof useCurrentProjectsViewModel>;
