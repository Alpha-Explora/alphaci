"use client";

import { useState } from "react";

import {
  archiveGroup,
  deleteGroup,
  getGroupMembers,
  reopenGroup,
  transferGroup,
  updateGroup,
  useApiResource,
  type GroupMember,
} from "@/features/groups";
import { ApiError } from "@/shared/api/request";

import type { Team } from "../../model/teams-types";

/** One action at a time: the buttons that would start a second are disabled. */
export type TeamSettingsStatus = "idle" | "saving" | "working" | "deleting";

export interface TeamSettingsViewModel {
  status: TeamSettingsStatus;
  name: string;
  description: string;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  /** The details differ from what is saved. */
  dirty: boolean;
  archived: boolean;
  /** Active members who could take the Lead (never the current Lead). */
  candidates: GroupMember[];
  transferTo: string;
  setTransferTo: (value: string) => void;
  confirmTransfer: boolean;
  askConfirmTransfer: () => void;
  cancelTransfer: () => void;
  /** Safe to render; never an API object. */
  message: string | null;
  error: string | null;
  save: () => Promise<void>;
  toggleArchive: () => Promise<void>;
  transfer: () => Promise<void>;
  deleteOpen: boolean;
  openDelete: () => void;
  closeDelete: () => void;
  deleteError: string | null;
  deleteTeam: () => Promise<void>;
}

function detailMessage(cause: unknown): string | undefined {
  const detail = (cause as { details?: { message?: string | string[] } })?.details;
  return Array.isArray(detail?.message) ? detail?.message.join(", ") : detail?.message;
}

function deleteErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 403) return "You're not allowed to delete this team.";
  if (cause instanceof ApiError && cause.status === 404) return "This team no longer exists.";
  return "The team could not be deleted. Please try again.";
}

/**
 * ViewModel for everything a Lead can change about the team itself: details,
 * the Lead, archive / reopen, and delete. It was the team rail's Settings
 * section, with its writes made from the view; it is the Settings page's Team
 * tab now, and the writes live here.
 */
export function useTeamSettingsViewModel(options: {
  team: Team;
  /** The team changed (renamed, archived, Lead moved): re-read it. */
  onChanged?: () => void;
  /** The team is gone: drop it from the header and the page. */
  onDeleted?: (teamId: string) => void;
}): TeamSettingsViewModel {
  const { team, onChanged, onDeleted } = options;
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [status, setStatus] = useState<TeamSettingsStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const members = useApiResource<GroupMember[]>(() => getGroupMembers(team.id), [team.id]);

  // Ownership can only move to somebody already on the team, and never to the
  // person who already holds it.
  const candidates = (members.data ?? []).filter(
    (member) => member.memberStatus === "active" && member.role !== "admin",
  );
  const archived = team.status === "archived";
  const dirty = name.trim() !== team.name || description.trim() !== (team.description ?? "");

  function begin(next: TeamSettingsStatus) {
    setStatus(next);
    setError(null);
    setMessage(null);
  }

  async function save() {
    if (!name.trim()) {
      setError("A team needs a name.");
      return;
    }
    begin("saving");
    try {
      await updateGroup(team.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setMessage("Saved.");
      onChanged?.();
    } catch (cause) {
      setError(detailMessage(cause) ?? "The team could not be updated.");
    } finally {
      setStatus("idle");
    }
  }

  async function toggleArchive() {
    begin("working");
    try {
      if (archived) {
        await reopenGroup(team.id);
        setMessage("Team reopened.");
      } else {
        await archiveGroup(team.id);
        setMessage("Team archived. Its repositories stay on GitHub.");
      }
      onChanged?.();
    } catch (cause) {
      setError(detailMessage(cause) ?? "That did not work.");
    } finally {
      setStatus("idle");
    }
  }

  async function transfer() {
    if (!transferTo) return;
    begin("working");
    try {
      await transferGroup(team.id, { newManagerUserId: transferTo });
      setMessage("Lead transferred.");
      setConfirmTransfer(false);
      setTransferTo("");
      members.reload();
      onChanged?.();
    } catch (cause) {
      setError(detailMessage(cause) ?? "Ownership could not be transferred.");
    } finally {
      setStatus("idle");
    }
  }

  async function deleteTeam() {
    setStatus("deleting");
    setDeleteError(null);
    try {
      await deleteGroup(team.id);
      setDeleteOpen(false);
      setStatus("idle");
      onDeleted?.(team.id);
    } catch (cause) {
      setDeleteError(deleteErrorMessage(cause));
      setStatus("idle");
    }
  }

  return {
    status,
    name,
    description,
    setName,
    setDescription,
    dirty,
    archived,
    candidates,
    transferTo,
    setTransferTo,
    confirmTransfer,
    askConfirmTransfer: () => setConfirmTransfer(true),
    cancelTransfer: () => setConfirmTransfer(false),
    message,
    error,
    save,
    toggleArchive,
    transfer,
    deleteOpen,
    openDelete: () => {
      setDeleteError(null);
      setDeleteOpen(true);
    },
    closeDelete: () => {
      if (status === "deleting") return;
      setDeleteOpen(false);
      setDeleteError(null);
    },
    deleteError,
    deleteTeam,
  };
}
