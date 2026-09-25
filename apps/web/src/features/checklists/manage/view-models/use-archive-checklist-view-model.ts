"use client";

import { useState } from "react";

import { checklistsRepository } from "../../data/checklists-repository";
import { checklistErrorMessage } from "../../model/checklist-rules";
import type { ChecklistsStatus, QaChecklist } from "../../model/checklist-types";

export interface ArchiveChecklistViewModel {
  /** "loading" while the archive request is in flight. */
  status: ChecklistsStatus;
  error: string | null;
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  confirm: () => Promise<void>;
}

const ARCHIVE_ERROR = "The checklist could not be archived. Try again in a moment.";

/** ViewModel for the archive confirmation. Archiving is the only removal there is. */
export function useArchiveChecklistViewModel(options: {
  checklist: QaChecklist;
  onArchived: (checklist: QaChecklist) => void;
}): ArchiveChecklistViewModel {
  const { checklist, onArchived } = options;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ChecklistsStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const archived = await checklistsRepository.archive(checklist.id);
      setStatus("ready");
      setOpen(false);
      onArchived(archived);
    } catch (cause) {
      setStatus("error");
      setError(checklistErrorMessage(cause, ARCHIVE_ERROR));
    }
  }

  return {
    status,
    error,
    open,
    openDialog: () => {
      setError(null);
      setStatus("ready");
      setOpen(true);
    },
    closeDialog: () => {
      if (status !== "loading") setOpen(false);
    },
    confirm,
  };
}
