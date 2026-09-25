"use client";

import { useState } from "react";

import { useProjectChecklistsViewModel } from "../../project";
import type { ChecklistsStatus, QaChecklist } from "../../model/checklist-types";

export interface StudioChecklistsViewModel {
  status: ChecklistsStatus;
  error: string | null;
  checklists: QaChecklist[];
  /** The checklist under test: the chosen one, else the first shared one. */
  selected: QaChecklist | null;
  select: (checklistId: string) => void;
  reload: () => void;
}

/**
 * ViewModel for the studio's checklist picker: the checklists shared to this
 * project (the same list the Checklists tab shows), and which one is being
 * verified. A choice that disappears — unshared or archived — falls back to
 * the first one still shared rather than to nothing.
 */
export function useStudioChecklistsViewModel(options: {
  projectId: string;
  enabled: boolean;
}): StudioChecklistsViewModel {
  const list = useProjectChecklistsViewModel(options);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    list.checklists.find((checklist) => checklist.id === selectedId) ??
    list.checklists[0] ??
    null;

  return {
    status: list.status,
    error: list.error,
    checklists: list.checklists,
    selected,
    select: setSelectedId,
    reload: list.reload,
  };
}
