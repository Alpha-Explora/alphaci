"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getGroups, type GroupSummary } from "@/features/groups";
import type { ProvisionedProject } from "@/shared/api/contracts";
import { useWorkspaceSelection } from "@/features/workspace/selection";

import { parseCreateTargetParams } from "../model/create-target-rules";
import { chooseInitialGroupId, searchWithGroup } from "../model/group-picker-rules";

export type CurrentProjectsStatus = "loading" | "ready" | "error";

/** One team on the page, with the repositories it owns. */
export interface CurrentProjectsGroup {
  id: string;
  name: string;
  description: string | null;
  repositoryCount: number;
  projects: ProvisionedProject[];
  group: GroupSummary;
}

export const GROUPS_LOAD_ERROR = "Could not load groups.";

function toEntries(
  groups: GroupSummary[] | null,
  projects: ProvisionedProject[],
): CurrentProjectsGroup[] {
  return (groups ?? []).map((group) => {
    const owned = projects.filter((project) => project.workspaceId === group.id);
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      repositoryCount: owned.length,
      projects: owned,
      group,
    };
  });
}

function statusOf(
  loadingProjects: boolean,
  groups: GroupSummary[] | null,
  loadFailed: boolean,
): CurrentProjectsStatus {
  if (loadingProjects || groups === null) return "loading";
  return loadFailed ? "error" : "ready";
}

/**
 * ViewModel for the projects view of /workflows: the groups list, which group
 * is selected, and mirroring that choice into `?group=`.
 *
 * The groups come from `getGroups()`, which for an admin is EVERY team. The
 * header workspace picker lists only the teams the caller is a member of, so
 * this page reads the header's selection to pick a starting group and never
 * writes back to it — syncing would point the header at a team the caller is
 * not in.
 */
export function useCurrentProjectsViewModel(options: {
  projects: ProvisionedProject[];
  loadingProjects: boolean;
}) {
  const { projects, loadingProjects } = options;
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedWorkspaceId } = useWorkspaceSelection();
  const requestedGroupId = parseCreateTargetParams(searchParams).groupId;

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

  const entries = useMemo(() => toEntries(groups, projects), [groups, projects]);
  const groupIds = entries.map((entry) => entry.id);
  const selectedId =
    pickedId && groupIds.includes(pickedId)
      ? pickedId
      : chooseInitialGroupId({
          requestedGroupId,
          headerWorkspaceId: selectedWorkspaceId,
          groupIds,
        });
  const selectedGroup = entries.find((entry) => entry.id === selectedId) ?? null;

  function selectGroup(groupId: string) {
    setPickedId(groupId);
    const search = searchWithGroup(searchParams.toString(), groupId);
    router.replace(`${pathname}?${search}`, { scroll: false });
  }

  function removeGroup(groupId: string) {
    setGroups((current) => current?.filter((group) => group.id !== groupId) ?? current);
    setPickedId((current) => (current === groupId ? null : current));
  }

  function retry() {
    setGroups(null);
    setLoadFailed(false);
    setLoadKey((key) => key + 1);
  }

  return {
    status: statusOf(loadingProjects, groups, loadFailed),
    groups: entries,
    selectedGroup,
    selectGroup,
    removeGroup,
    retry,
  };
}

export type CurrentProjectsViewModel = ReturnType<typeof useCurrentProjectsViewModel>;
