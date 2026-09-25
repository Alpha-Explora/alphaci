"use client";

import { useState } from "react";

import { checklistsRepository } from "../../data/checklists-repository";
import {
  checklistErrorMessage,
  sameProjectSet,
  toggleProjectId,
} from "../../model/checklist-rules";
import type { ChecklistsStatus, QaChecklist } from "../../model/checklist-types";

export interface ShareChecklistViewModel {
  /** "loading" while the new project set is being saved. */
  status: ChecklistsStatus;
  error: string | null;
  open: boolean;
  selectedIds: string[];
  dirty: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  toggle: (projectId: string) => void;
  setAll: (projectIds: string[]) => void;
  submit: () => Promise<void>;
}

const SHARE_ERROR = "Sharing could not be saved. Try again in a moment.";

/**
 * ViewModel for the Share dialog. The selection is seeded from the checklist
 * every time the dialog opens, so cancelling really does discard.
 */
export function useShareChecklistViewModel(options: {
  checklist: QaChecklist;
  onShared: (checklist: QaChecklist) => void;
}): ShareChecklistViewModel {
  const { checklist, onShared } = options;
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ChecklistsStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const saved = await checklistsRepository.share(checklist.id, selectedIds);
      setStatus("ready");
      setOpen(false);
      onShared(saved);
    } catch (cause) {
      setStatus("error");
      setError(checklistErrorMessage(cause, SHARE_ERROR));
    }
  }

  return {
    status,
    error,
    open,
    selectedIds,
    dirty: !sameProjectSet(selectedIds, checklist.sharedProjectIds),
    openDialog: () => {
      setSelectedIds([...checklist.sharedProjectIds]);
      setError(null);
      setStatus("ready");
      setOpen(true);
    },
    closeDialog: () => {
      if (status !== "loading") setOpen(false);
    },
    toggle: (projectId) => setSelectedIds((ids) => toggleProjectId(ids, projectId)),
    setAll: (projectIds) => setSelectedIds([...projectIds]),
    submit,
  };
}
