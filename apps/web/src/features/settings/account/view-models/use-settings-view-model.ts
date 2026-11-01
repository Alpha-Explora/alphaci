"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspaceSelection } from "@/features/workspace/selection";

import { settingsRepository } from "../../data/settings-repository";
import {
  canSeeTeamSettingsTab,
  settingsNavSections,
  visibleSettingsSection,
} from "../../model/settings-rules";
import type {
  SettingsSection,
  WorkspacesMeResponse,
} from "../../model/settings-types";

export interface SettingsViewModel {
  /** The section on screen (Team falls back to Account while it is hidden). */
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  /** The rail's sections, in order — Team only for its Lead/admin. */
  sections: SettingsSection[];
  /** The header team's name, for the Team tab's heading. */
  teamName: string | null;
  workspaces: WorkspacesMeResponse | null;
  /**
   * The workspaces load — the only async work this surface owns. "idle" while
   * a section that does not need them is open, or the capability is off.
   */
  status: "idle" | "loading" | "ready" | "error";
  /** Safe to render. Never an API detail. */
  workspacesError: string | null;
  /** True while the account deletion request is in flight. */
  isDeleting: boolean;
  deleteMessage: string | null;
  /** Cleared when the confirm panel is opened or dismissed. */
  clearDeleteMessage: () => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  deleteConfirmInput: string;
  setDeleteConfirmInput: (value: string) => void;
  /** Resolves true when the account is gone and the caller should navigate. */
  deleteAccount: () => Promise<boolean>;
}

/**
 * ViewModel for the settings surface.
 *
 * Workspaces load lazily: only the account section shows them, and only when
 * the capability is on, so switching to Appearance never triggers the fetch.
 */
export function useSettingsViewModel(options: {
  /** From useCapabilities — the workspaces surface can be switched off. */
  workspacesEnabled: boolean;
  /** The section a `?tab=` link asked for, read once on arrival. */
  initialSection?: SettingsSection;
  /** The caller's app role, for the Team tab's lead/admin gate. */
  appRole?: string | null;
}): SettingsViewModel {
  const { workspacesEnabled, initialSection = "account", appRole } = options;
  // The header owns which team is selected; the Team tab is for that team.
  const { selectedWorkspace } = useWorkspaceSelection();
  const canManageTeam = canSeeTeamSettingsTab(selectedWorkspace?.role, appRole);

  const [selectedSection, setActiveSection] =
    useState<SettingsSection>(initialSection);
  const activeSection = visibleSettingsSection(selectedSection, canManageTeam);
  const [workspaces, setWorkspaces] = useState<WorkspacesMeResponse | null>(
    null,
  );
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [status, setStatus] =
    useState<SettingsViewModel["status"]>("idle");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const req = useRef(0);

  useEffect(() => {
    if (activeSection !== "account" || !workspacesEnabled) return;

    req.current += 1;
    const id = req.current;
    let active = true;

    settingsRepository
      .workspaces()
      .then((response) => {
        if (!active || id !== req.current) return;
        // Not published to the header's context: the header loads its own
        // lists (a platform admin's other teams included), and publishing this
        // member-only list could validate away an admin's other-team selection.
        setWorkspaces(response);
        setWorkspacesError(null);
        setStatus("ready");
      })
      .catch(() => {
        if (!active || id !== req.current) return;
        setWorkspacesError("Workspaces are unavailable right now.");
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [activeSection, workspacesEnabled]);

  async function deleteAccount(): Promise<boolean> {
    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      await settingsRepository.deleteAccount();
      // Deliberately stays true: the account is gone and the caller is
      // navigating away, so re-enabling the button would only invite a
      // second request against a deleted account.
      return true;
    } catch {
      setDeleteMessage("Failed to delete account. Please try again.");
      setIsDeleting(false);
      return false;
    }
  }

  return {
    activeSection,
    setActiveSection: (section) => {
      if (section === "account" && workspacesEnabled) setStatus("loading");
      setActiveSection(section);
    },
    sections: settingsNavSections(canManageTeam),
    teamName: selectedWorkspace?.name ?? null,
    workspaces,
    status,
    workspacesError,
    isDeleting,
    deleteMessage,
    clearDeleteMessage: () => setDeleteMessage(null),
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteAccount,
  };
}
