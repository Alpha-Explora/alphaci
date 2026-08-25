"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspaceSelection } from "@/features/workspace/selection";

import { settingsRepository } from "../../data/settings-repository";
import type {
  SettingsSection,
  WorkspacesMeResponse,
} from "../../model/settings-types";

export interface SettingsViewModel {
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
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
}): SettingsViewModel {
  const { workspacesEnabled } = options;
  const { setWorkspaces: setWorkspaceContext } = useWorkspaceSelection();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("account");
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
        setWorkspaces(response);
        // The header picker reads from the same context, so one fetch feeds both.
        setWorkspaceContext(response);
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
  }, [activeSection, setWorkspaceContext, workspacesEnabled]);

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
