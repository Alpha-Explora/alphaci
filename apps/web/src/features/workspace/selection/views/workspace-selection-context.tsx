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
  /**
   * A platform admin's teams they are not a member of — selectable from the
   * header picker, merged with their own. Always empty for everybody else.
   */
  otherWorkspaces: WorkspaceSummary[];
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  /**
   * Publishes the header's lists. `otherWorkspaces` is optional: a caller that
   * only knows the member list leaves the admin's other teams as they were,
   * rather than dropping them (and with them a valid selection).
   */
  setWorkspaces: (
    workspaces: WorkspacesMeResponse | null,
    otherWorkspaces?: WorkspaceSummary[],
  ) => void;
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
const NO_OTHERS: WorkspaceSummary[] = [];

const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextValue>({
  selectedWorkspaceId: null,
  selectedWorkspace: null,
  workspaces: null,
  otherWorkspaces: NO_OTHERS,
  setSelectedWorkspaceId: () => undefined,
  setWorkspaces: () => undefined,
  refreshWorkspaces: () => undefined,
  registerWorkspaceRefresh: () => undefined,
});

export function WorkspaceProvider({
  children,
  initialWorkspaceId = null,
}: {
  children: ReactNode;
  /**
   * A team to open on instead of the remembered one — set by a deep link such
   * as a project's "Manage in team". Still checked against the caller's
   * workspaces when the header loads them, like any stored selection.
   */
  initialWorkspaceId?: string | null;
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return initialWorkspaceId;
    return initialWorkspaceId ?? window.localStorage.getItem(STORAGE_KEY);
  });
  const [workspaces, setWorkspacesState] = useState<WorkspacesMeResponse | null>(null);
  const [otherWorkspaces, setOtherWorkspaces] = useState<WorkspaceSummary[]>(NO_OTHERS);
  // Mirrors otherWorkspaces for setWorkspaces, which must validate the
  // selection against the lists it is about to publish, synchronously.
  const othersRef = useRef<WorkspaceSummary[]>(NO_OTHERS);
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
    (nextWorkspaces: WorkspacesMeResponse | null, nextOthers?: WorkspaceSummary[]) => {
      const others = nextOthers ?? othersRef.current;
      othersRef.current = others;
      setWorkspacesState(nextWorkspaces);
      setOtherWorkspaces(others);
      const selectable = [...(nextWorkspaces?.items ?? []), ...others];
      if (selectable.length === 0) {
        setSelectedWorkspaceId(null);
        return;
      }

      setSelectedWorkspaceIdState((current) => {
        const exists = current
          ? selectable.some((workspace) => workspace.id === current)
          : false;
        const nextId = exists ? current : selectable[0]?.id ?? null;
        if (nextId) {
          window.localStorage.setItem(STORAGE_KEY, nextId);
        }
        return nextId;
      });
    },
    [setSelectedWorkspaceId],
  );

  const selectedWorkspace = useMemo(() => {
    const selectable = [...(workspaces?.items ?? []), ...otherWorkspaces];
    return (
      selectable.find((workspace) => workspace.id === selectedWorkspaceId) ??
      selectable[0] ??
      null
    );
  }, [otherWorkspaces, selectedWorkspaceId, workspaces]);

  const value = useMemo(
    () => ({
      selectedWorkspaceId: selectedWorkspace?.id ?? selectedWorkspaceId,
      selectedWorkspace,
      workspaces,
      otherWorkspaces,
      setSelectedWorkspaceId,
      setWorkspaces,
      refreshWorkspaces,
      registerWorkspaceRefresh,
    }),
    [
      otherWorkspaces,
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
