"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { WorkspaceSummary, WorkspacesMeResponse } from "@/lib/api/contracts";

interface WorkspaceSelectionContextValue {
  selectedWorkspaceId: string | null;
  selectedWorkspace: WorkspaceSummary | null;
  workspaces: WorkspacesMeResponse | null;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  setWorkspaces: (workspaces: WorkspacesMeResponse | null) => void;
}

const STORAGE_KEY = "flowci.workspaceId";

const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextValue>({
  selectedWorkspaceId: null,
  selectedWorkspace: null,
  workspaces: null,
  setSelectedWorkspaceId: () => undefined,
  setWorkspaces: () => undefined,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [workspaces, setWorkspacesState] = useState<WorkspacesMeResponse | null>(null);

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
    }),
    [
      selectedWorkspace,
      selectedWorkspaceId,
      setSelectedWorkspaceId,
      setWorkspaces,
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
