"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getWorkspaces } from "../data/workspace-repository";
import { useWorkspaceSelection } from "../views/workspace-selection-context";
import type { WorkspacesMeResponse } from "../model/workspace-types";

export type WorkspaceSelectionStatus = "idle" | "loading" | "ready" | "error";

export interface WorkspaceSelectionViewModel {
  workspaces: WorkspacesMeResponse | null;
  status: WorkspaceSelectionStatus;
  error: string | null;
  loadWorkspaces: () => Promise<void>;
}

/** Owns the workspace list request while the context owns selection persistence. */
export function useWorkspaceSelectionViewModel(options: {
  enabled: boolean;
}): WorkspaceSelectionViewModel {
  const { enabled } = options;
  const { setWorkspaces, registerWorkspaceRefresh } = useWorkspaceSelection();
  const [workspaces, setWorkspacesState] = useState<WorkspacesMeResponse | null>(null);
  const [status, setStatus] = useState<WorkspaceSelectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadWorkspaces = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    setStatus("loading");
    setError(null);
    try {
      const response = await getWorkspaces();
      if (id !== requestId.current) return;
      setWorkspacesState(response);
      setWorkspaces(response);
      setStatus("ready");
    } catch {
      if (id !== requestId.current) return;
      const unavailable: WorkspacesMeResponse = { enabled: false, items: [] };
      setWorkspacesState(unavailable);
      setWorkspaces(null);
      setStatus("error");
      setError("Workspaces are unavailable right now.");
    }
  }, [enabled, setWorkspaces]);

  useEffect(() => {
    registerWorkspaceRefresh(() => {
      void loadWorkspaces();
    });
  }, [loadWorkspaces, registerWorkspaceRefresh]);

  useEffect(() => {
    if (!enabled) return;
    void loadWorkspaces();
  }, [enabled, loadWorkspaces]);

  return { workspaces, status, error, loadWorkspaces };
}
