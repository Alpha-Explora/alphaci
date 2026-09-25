"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checklistsRepository } from "../../data/checklists-repository";
import {
  checklistErrorMessage,
  isArchived,
  sortChecklists,
  upsertChecklist,
} from "../../model/checklist-rules";
import type {
  ChecklistsStatus,
  QaChecklist,
  QaChecklistListResponse,
} from "../../model/checklist-types";

/** Which screen of the section is showing. One at a time, like the rest of the team panel. */
export type ChecklistScreen =
  | { kind: "list" }
  | { kind: "view"; checklistId: string }
  | { kind: "edit"; checklistId: string }
  | { kind: "create" };

export interface WorkspaceChecklistsViewModel {
  status: ChecklistsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  checklists: QaChecklist[];
  canManage: boolean;
  /** Reference time for "Updated 3 days ago", fixed at mount so renders stay pure. */
  now: number;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  /** The screen to draw; falls back to the list when its checklist is gone. */
  screen: ChecklistScreen;
  /** The checklist the view/edit screen is about, when there is one. */
  selected: QaChecklist | null;
  openChecklist: (checklistId: string) => void;
  editChecklist: (checklistId: string) => void;
  startCreate: () => void;
  backToList: () => void;
  reload: () => void;
  /** A save came back: keep it in the list and show it. */
  applySaved: (checklist: QaChecklist) => void;
  /** Sharing changed: keep the list in step, stay where we are. */
  applyShared: (checklist: QaChecklist) => void;
  /** Archived: it leaves the active list, so go back to it. */
  applyArchived: (checklist: QaChecklist) => void;
}

interface LoadResult {
  key: string;
  data: QaChecklistListResponse | null;
  error: string | null;
}

const LOAD_ERROR = "QA checklists could not be loaded. Try again in a moment.";

function initialScreen(checklistId: string | null | undefined): ChecklistScreen {
  return checklistId ? { kind: "view", checklistId } : { kind: "list" };
}

function screenChecklistId(screen: ChecklistScreen): string | null {
  return screen.kind === "view" || screen.kind === "edit" ? screen.checklistId : null;
}

function loadStatus(result: LoadResult | null): ChecklistsStatus {
  if (!result) return "loading";
  return result.error ? "error" : "ready";
}

/**
 * Resolve the screen against what is loaded. A deep link to a checklist that is
 * archived (and hidden) or was never in this team lands on the list rather than
 * an empty detail pane.
 */
function resolveScreen(
  screen: ChecklistScreen,
  status: ChecklistsStatus,
  selected: QaChecklist | null,
  canManage: boolean,
): ChecklistScreen {
  if (screen.kind === "create") return canManage ? screen : { kind: "list" };
  if (screen.kind === "list" || status !== "ready") return screen;
  if (!selected) return { kind: "list" };
  if (screen.kind === "edit" && (!canManage || isArchived(selected))) {
    return { kind: "view", checklistId: selected.id };
  }
  return screen;
}

/**
 * ViewModel for a team's QA checklists: the list, the archived filter, and
 * which checklist is open. Editing, sharing and archiving each have their own
 * ViewModel with their own status; this one only owns the list load.
 */
export function useWorkspaceChecklistsViewModel(options: {
  workspaceId: string;
  enabled: boolean;
  initialChecklistId?: string | null;
}): WorkspaceChecklistsViewModel {
  const { workspaceId, enabled, initialChecklistId } = options;
  const [showArchived, setShowArchived] = useState(false);
  const [now] = useState(() => Date.now());
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  // Kept with the workspace it belongs to, so switching team resets it by
  // derivation instead of by an effect.
  const [screenState, setScreenState] = useState<{
    workspaceId: string;
    screen: ChecklistScreen;
  }>(() => ({ workspaceId, screen: initialScreen(initialChecklistId) }));
  const requestRef = useRef(0);

  const key = `${workspaceId}|${String(showArchived)}|${String(nonce)}`;

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    requestRef.current += 1;
    const requestId = requestRef.current;
    checklistsRepository
      .listForWorkspace(workspaceId, { includeArchived: showArchived })
      .then((data) => {
        if (requestId === requestRef.current) setResult({ key, data, error: null });
      })
      .catch((cause: unknown) => {
        if (requestId !== requestRef.current) return;
        setResult({ key, data: null, error: checklistErrorMessage(cause, LOAD_ERROR) });
      });
  }, [enabled, workspaceId, showArchived, key]);

  const current = result?.key === key ? result : null;
  const status = loadStatus(current);
  const canManage = current?.data?.canManage === true;
  const checklists = useMemo(
    () => sortChecklists(current?.data?.items ?? []),
    [current],
  );

  const rawScreen =
    screenState.workspaceId === workspaceId ? screenState.screen : { kind: "list" as const };
  const selectedId = screenChecklistId(rawScreen);
  const selected = checklists.find((item) => item.id === selectedId) ?? null;
  const screen = resolveScreen(rawScreen, status, selected, canManage);

  const setScreen = useCallback(
    (next: ChecklistScreen) => setScreenState({ workspaceId, screen: next }),
    [workspaceId],
  );

  const patchItems = useCallback(
    (update: (items: QaChecklist[]) => QaChecklist[]) => {
      setResult((previous) => {
        if (!previous?.data) return previous;
        return { ...previous, data: { ...previous.data, items: update(previous.data.items) } };
      });
    },
    [],
  );

  return {
    status,
    error: current?.error ?? null,
    checklists,
    canManage,
    now,
    showArchived,
    setShowArchived,
    screen,
    selected,
    openChecklist: (checklistId) => setScreen({ kind: "view", checklistId }),
    editChecklist: (checklistId) => setScreen({ kind: "edit", checklistId }),
    startCreate: () => setScreen({ kind: "create" }),
    backToList: () => setScreen({ kind: "list" }),
    reload: () => setNonce((value) => value + 1),
    applySaved: (checklist) => {
      patchItems((items) => upsertChecklist(items, checklist));
      setScreen({ kind: "view", checklistId: checklist.id });
    },
    applyShared: (checklist) => patchItems((items) => upsertChecklist(items, checklist)),
    applyArchived: (checklist) => {
      patchItems((items) =>
        showArchived
          ? upsertChecklist(items, checklist)
          : items.filter((item) => item.id !== checklist.id),
      );
      setScreen({ kind: "list" });
    },
  };
}
