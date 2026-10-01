"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getGroups, type GroupSummary } from "@/features/groups";
import { useWorkspaceSelection } from "@/features/workspace/selection";

import {
  headerTeam,
  linkedProjectFolderId,
  readProjectsDeepLink,
} from "../model/current-projects-rules";

export type CurrentProjectsStatus = "loading" | "ready" | "error";

export const GROUPS_LOAD_ERROR = "Could not load teams.";

function statusOf(
  loadingProjects: boolean,
  groups: GroupSummary[] | null,
  loadFailed: boolean,
): CurrentProjectsStatus {
  if (loadingProjects || groups === null) return "loading";
  return loadFailed ? "error" : "ready";
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
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  const searchParams = useSearchParams();
  const { selectedWorkspaceId } = useWorkspaceSelection();
  // Read once on arrival: the link says which Project to open first.
  const [link] = useState(() => readProjectsDeepLink(searchParams));

  useEffect(() => {
    let active = true;
    getGroups()
      .then((items) => {
        if (!active) return;
        setGroups(items);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setGroups([]);
        setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [loadKey]);

  const team = useMemo(
    () => headerTeam(groups ?? [], selectedWorkspaceId),
    [groups, selectedWorkspaceId],
  );

  function retry() {
    setGroups(null);
    setLoadFailed(false);
    setLoadKey((key) => key + 1);
  }

  return {
    status: statusOf(loadingProjects, groups, loadFailed),
    /** The header's team, or null when the caller is in none. */
    team,
    /** The Project a `?project=` link opens on this team, or null. */
    linkedFolderId: team ? linkedProjectFolderId(link, team.id) : null,
    retry,
  };
}

export type CurrentProjectsViewModel = ReturnType<typeof useCurrentProjectsViewModel>;
