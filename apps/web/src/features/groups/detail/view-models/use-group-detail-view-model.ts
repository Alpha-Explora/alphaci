"use client";

import { useState } from "react";

import { useApiResource } from "@/features/groups";

import { groupsRepository } from "../../data/groups-repository";
import { isGroupManagerRole } from "../../model/groups-rules";
import type { GroupSummary, UpdateGroupRequest } from "../../model/groups-types";

export interface GroupDetailViewModel {
  group: GroupSummary | null;
  status: ReturnType<typeof useApiResource<GroupSummary>>["state"];
  reload: () => void;
  /** Whether the caller may edit this group. */
  canManage: boolean;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  /** True while an archive or reopen is in flight. */
  busy: boolean;
  toggleArchive: () => Promise<void>;
  /** Resolves to null on success, or a message safe to show in the dialog. */
  saveGroup: (payload: UpdateGroupRequest) => Promise<string | null>;
}

/** ViewModel for a group's overview surface. */
export function useGroupDetailViewModel(groupId: string): GroupDetailViewModel {
  const { data, state, reload, setData } = useApiResource<GroupSummary>(
    () => groupsRepository.group(groupId),
    [groupId],
  );
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    if (!data) return;
    setBusy(true);
    try {
      const updated =
        data.status === "archived"
          ? await groupsRepository.reopenGroup(data.id)
          : await groupsRepository.archiveGroup(data.id);
      setData(() => updated);
    } catch {
      // Non-fatal and deliberately silent: reload re-syncs the truth rather
      // than leaving the badge showing a state the server did not accept.
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveGroup(payload: UpdateGroupRequest): Promise<string | null> {
    if (!data) return "The group could not be updated.";
    try {
      const updated = await groupsRepository.updateGroup(data.id, payload);
      setData(() => updated);
      return null;
    } catch {
      return "The group could not be updated.";
    }
  }

  return {
    group: data,
    status: state,
    reload,
    canManage: isGroupManagerRole(data?.role),
    editOpen,
    setEditOpen,
    busy,
    toggleArchive,
    saveGroup,
  };
}
