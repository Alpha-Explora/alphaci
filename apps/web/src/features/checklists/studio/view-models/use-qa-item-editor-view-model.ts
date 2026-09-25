"use client";

import { useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import {
  allowedItemStatuses,
  canEditItem,
  itemDraftError,
  itemDraftFrom,
  itemUpdatePayload,
  qaActionError,
  statusNeedsSeverity,
} from "../../model/qa-run-rules";
import type {
  QaActionError,
  QaItemDraft,
  QaRun,
  QaRunItem,
  QaRunItemStatus,
  UpdateQaRunItemInput,
} from "../../model/qa-run-types";

export type QaItemEditorStatus = "idle" | "saving";

export interface QaItemEditorViewModel {
  /** `saving` while one item's write is in flight. */
  status: QaItemEditorStatus;
  /** The item being written, so only its row shows "Saving…". */
  savingItemId: string | null;
  /** The item whose details are open, with what is typed into it. */
  openItemId: string | null;
  draft: QaItemDraft | null;
  /** Why the open draft cannot be saved yet. Shown once Save was tried. */
  draftError: string | null;
  /** The last failed write, on the item it failed on. */
  error: (QaActionError & { itemId: string }) | null;
  /** Pick a status from the item's control. */
  chooseStatus: (item: QaRunItem, status: QaRunItemStatus) => void;
  openDetails: (item: QaRunItem) => void;
  closeDetails: () => void;
  updateDraft: (patch: Partial<QaItemDraft>) => void;
  saveDraft: (item: QaRunItem) => Promise<void>;
  dismissError: () => void;
}

const SAVE_ERROR = "The change could not be saved. Try again in a moment.";

/** An unchanged status is always saveable with the item; a new one must be allowed. */
function canSaveStatus(item: QaRunItem, run: QaRun, status: QaRunItemStatus): boolean {
  if (!canEditItem(item, run)) return false;
  return status === item.status || allowedItemStatuses(item, run).includes(status);
}

/**
 * ViewModel for changing items on a run.
 *
 * A status that needs no explanation (Passed, In progress…) is saved the
 * moment it is picked, because that is most of a tester's clicks. Failed and
 * Returned to dev open the item's details instead: the server refuses them
 * without a severity, so the UI asks for one before anything is sent. Every
 * write carries the rowVersion read; a 409 comes back flagged stale so the
 * view can offer "Reload run".
 */
export function useQaItemEditorViewModel(options: {
  projectId: string;
  run: QaRun;
  onRun: (run: QaRun) => void;
}): QaItemEditorViewModel {
  const { projectId, run, onRun } = options;
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QaItemDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<(QaActionError & { itemId: string }) | null>(null);

  function open(item: QaRunItem, status: QaRunItemStatus = item.status) {
    setOpenItemId(item.id);
    setDraft(itemDraftFrom(item, status));
    setAttempted(false);
    setError(null);
  }

  function closeDetails() {
    setOpenItemId(null);
    setDraft(null);
    setAttempted(false);
  }

  async function send(item: QaRunItem, body: UpdateQaRunItemInput) {
    setSavingItemId(item.id);
    setError(null);
    try {
      const next = await qaRunsRepository.updateItem(projectId, run.id, item.id, body);
      onRun(next);
      if (openItemId === item.id) closeDetails();
    } catch (cause) {
      setError({ itemId: item.id, ...qaActionError(cause, SAVE_ERROR) });
    } finally {
      setSavingItemId(null);
    }
  }

  function chooseStatus(item: QaRunItem, status: QaRunItemStatus) {
    // Never send a status this viewer cannot set, whatever the control offered.
    if (savingItemId || !allowedItemStatuses(item, run).includes(status)) return;
    if (status === item.status) return;
    if (statusNeedsSeverity(status)) {
      open(item, status);
      return;
    }
    void send(item, { expectedRowVersion: item.rowVersion, status });
  }

  async function saveDraft(item: QaRunItem) {
    if (!draft || savingItemId || !canSaveStatus(item, run, draft.status)) return;
    setAttempted(true);
    if (itemDraftError(draft)) return;
    const body = itemUpdatePayload(item, draft);
    if (!body) {
      closeDetails();
      return;
    }
    await send(item, body);
  }

  return {
    status: savingItemId ? "saving" : "idle",
    savingItemId,
    openItemId,
    draft,
    draftError: attempted && draft ? itemDraftError(draft) : null,
    error,
    chooseStatus,
    openDetails: (item) => open(item),
    closeDetails,
    updateDraft: (patch) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    saveDraft,
    dismissError: () => setError(null),
  };
}
