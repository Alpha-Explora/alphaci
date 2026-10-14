"use client";

import { useState } from "react";

import { useApiResource } from "@/features/groups";
import { useAuthSession } from "@/features/auth/session";
import { useCapabilities } from "@/features/capabilities/current";

import { groupsRepository } from "../../data/groups-repository";
import { isGroupManagerRole } from "../../model/groups-rules";
import { canWriteRepositoryConfiguration } from "../../model/role-gate-rules";
import type {
  GroupSummary,
  HierarchyRepository,
} from "../../model/groups-types";

export type RepoTab = "access" | "configuration";

export interface RepositoryDetailViewModel {
  /** Only needed for the breadcrumb label and the manage check. */
  group: GroupSummary | null;
  repository: HierarchyRepository | null;
  /** The repository's own load state: it gates the whole surface. */
  status: ReturnType<typeof useApiResource<HierarchyRepository>>["state"];
  reload: () => void;
  canManage: boolean;
  /** Developer or admin: the only roles that may write configuration. */
  canWriteConfiguration: boolean;
  /** Members without manage rights only ever see configuration. */
  tab: RepoTab;
  setTab: (tab: RepoTab) => void;
  /** Assignment writes need live GitHub sync to be meaningful. */
  githubSyncLive: boolean;
}

/** ViewModel for one repository inside a group. */
export function useRepositoryDetailViewModel(
  groupId: string,
  repositoryId: string,
): RepositoryDetailViewModel {
  const groupResource = useApiResource<GroupSummary>(
    () => groupsRepository.group(groupId),
    [groupId],
  );
  const repoResource = useApiResource<HierarchyRepository>(
    () => groupsRepository.repository(repositoryId),
    [repositoryId],
  );
  const { hierarchyGithubSyncMode } = useCapabilities();
  const { session } = useAuthSession();
  const [tab, setTab] = useState<RepoTab>("access");

  const canManage = isGroupManagerRole(groupResource.data?.role);

  return {
    group: groupResource.data,
    repository: repoResource.data,
    status: repoResource.state,
    reload: repoResource.reload,
    canManage,
    canWriteConfiguration: canWriteRepositoryConfiguration(session?.appRole),
    tab: canManage ? tab : "configuration",
    setTab,
    githubSyncLive: hierarchyGithubSyncMode === "live",
  };
}
