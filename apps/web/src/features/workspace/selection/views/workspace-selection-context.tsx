"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import type { WorkspaceSummary, WorkspacesMeResponse } from "../model/workspace-types";

interface WorkspaceSelectionContextValue {
  selectedWorkspaceId: string | null;
  selectedWorkspace: WorkspaceSummary | null;
  workspaces: WorkspacesMeResponse | null;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  setWorkspaces: (workspaces: WorkspacesMeResponse | null) => void;
  /**
   * Re-reads the workspace list.
   *
   * Registered by the header, which owns the fetch. Anything that creates or
   * deletes a team calls this — without it a deleted team stayed in the picker
   * until a full reload, and selecting it left the header naming one team
   * while the page showed another.
   */
  refreshWorkspaces: () => void;
  registerWorkspaceRefresh: (refresh: () => void) => void;
}

const STORAGE_KEY = "flowci.workspaceId";

const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextValue>({
  selectedWorkspaceId: null,
  selectedWorkspace: null,
  workspaces: null,
  setSelectedWorkspaceId: () => undefined,
  setWorkspaces: () => undefined,
  refreshWorkspaces: () => undefined,
  registerWorkspaceRefresh: () => undefined,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [workspaces, setWorkspacesState] = useState<WorkspacesMeResponse | null>(null);
  /*
   * A ref, not state: the header registers its fetch on mount, and storing it
   * in state would re-render every consumer of this context for a value none
   * of them read.
   */
  const refreshRef = useRef<() => void>(() => undefined);

  const registerWorkspaceRefresh = useCallback((refresh: () => void) => {
    refreshRef.current = refresh;
  }, []);

  const refreshWorkspaces = useCallback(() => {
    refreshRef.current();
  }, []);

  const setSelectedWorkspaceId = useCallback((workspaceId: string | null) => {
    setSelectedWorkspaceIdState(workspaceId);
    if (workspaceId) {
      window.localStorage.setItem(STORAGE_KEY, workspaceId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setWorkspaces = useCallback(
    (nextWorkspaces: WorkspacesMeResponse | null) => {
      setWorkspacesState(nextWorkspaces);
      if (!nextWorkspaces?.items.length) {
        setSelectedWorkspaceId(null);
        return;
      }

      setSelectedWorkspaceIdState((current) => {
        const exists = current
          ? nextWorkspaces.items.some((workspace) => workspace.id === current)
          : false;
        const nextId = exists ? current : nextWorkspaces.items[0]?.id ?? null;
        if (nextId) {
          window.localStorage.setItem(STORAGE_KEY, nextId);
        }
        return nextId;
      });
    },
    [setSelectedWorkspaceId],
  );

  const selectedWorkspace = useMemo(
    () =>
      workspaces?.items.find((workspace) => workspace.id === selectedWorkspaceId) ??
      workspaces?.items[0] ??
      null,
    [selectedWorkspaceId, workspaces],
  );

  const value = useMemo(
    () => ({
      selectedWorkspaceId: selectedWorkspace?.id ?? selectedWorkspaceId,
      selectedWorkspace,
      workspaces,
      setSelectedWorkspaceId,
      setWorkspaces,
      refreshWorkspaces,
      registerWorkspaceRefresh,
    }),
    [
      selectedWorkspace,
      selectedWorkspaceId,
      setSelectedWorkspaceId,
      setWorkspaces,
      refreshWorkspaces,
      registerWorkspaceRefresh,
      workspaces,
    ],
  );

  return (
    <WorkspaceSelectionContext.Provider value={value}>
      {children}
    </WorkspaceSelectionContext.Provider>
  );
}

export function useWorkspaceSelection() {
  return useContext(WorkspaceSelectionContext);
}
