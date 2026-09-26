"use client";

import { useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { developerItemRun, myItemKey } from "../../model/qa-my-items-rules";
import {
  allowedItemStatuses,
  itemDraftError,
  itemDraftFrom,
  itemUpdatePayload,
  qaActionError,
  statusNeedsSeverity,
} from "../../model/qa-run-rules";
import type {
  QaActionError,
  QaDeveloperItem,
  QaItemDraft,
  QaRun,
  QaRunItemStatus,
  UpdateQaRunItemInput,
} from "../../model/qa-run-types";

export interface DeveloperItemEditorViewModel {
  /** `saving` while one item's write is in flight. */
  status: "idle" | "saving";
  /** The item being written (`runId:itemId`), so only its row shows "Saving…". */
  savingKey: string | null;
  /** The item whose details form is open, with what is typed into it. */
  openKey: string | null;
  draft: QaItemDraft | null;
  /** Why the open draft cannot be saved yet. Shown once Save was tried. */
  draftError: string | null;
  /** The last failed write, on the item it failed on. */
  error: (QaActionError & { key: string }) | null;
  /** What the status control offers for this item. Never "Returned to dev". */
  allowedStatuses: (entry: QaDeveloperItem) => QaRunItemStatus[];
  chooseStatus: (entry: QaDeveloperItem, status: QaRunItemStatus) => void;
  openDetails: (entry: QaDeveloperItem) => void;
  closeDetails: () => void;
  updateDraft: (patch: Partial<QaItemDraft>) => void;
  saveDraft: (entry: QaDeveloperItem) => Promise<void>;
  dismissError: () => void;
}

const SAVE_ERROR = "The change could not be saved. Try again in a moment.";

function allowedFor(entry: QaDeveloperItem): QaRunItemStatus[] {
  return allowedItemStatuses(entry.item, developerItemRun(entry));
}

/**
 * ViewModel for recording a developer item's result from the Overview — the
 * same rules QA Studio uses for an item: a status that needs no explanation
 * is saved as soon as it is picked; Failed opens the details form, because
 * the server refuses it without a severity. Every write carries the row
 * version read, so a 409 comes back flagged stale and the card offers a
 * reload. The server decides who may change what (`item.canUpdate`).
 */
export function useDeveloperItemEditorViewModel(options: {
  projectId: string;
  onRun: (run: QaRun) => void;
}): DeveloperItemEditorViewModel {
  const { projectId, onRun } = options;
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<QaItemDraft | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<(QaActionError & { key: string }) | null>(null);

  function open(entry: QaDeveloperItem, status: QaRunItemStatus = entry.item.status) {
    setOpenKey(myItemKey(entry));
    setDraft(itemDraftFrom(entry.item, status));
    setAttempted(false);
    setError(null);
  }

  function closeDetails() {
    setOpenKey(null);
    setDraft(null);
    setAttempted(false);
  }

  async function send(entry: QaDeveloperItem, body: UpdateQaRunItemInput) {
    const key = myItemKey(entry);
    setSavingKey(key);
    setError(null);
    try {
      onRun(await qaRunsRepository.updateItem(projectId, entry.runId, entry.item.id, body));
      if (openKey === key) closeDetails();
    } catch (cause) {
      setError({ key, ...qaActionError(cause, SAVE_ERROR) });
    } finally {
      setSavingKey(null);
    }
  }

  function chooseStatus(entry: QaDeveloperItem, status: QaRunItemStatus) {
    // Never send a status this viewer cannot set, whatever the control offered.
    if (savingKey || status === entry.item.status || !allowedFor(entry).includes(status)) return;
    if (statusNeedsSeverity(status)) {
      open(entry, status);
      return;
    }
    void send(entry, { expectedRowVersion: entry.item.rowVersion, status });
  }

  async function saveDraft(entry: QaDeveloperItem) {
    if (!draft || savingKey) return;
    const statusOk = draft.status === entry.item.status || allowedFor(entry).includes(draft.status);
    if (!statusOk || !entry.item.canUpdate) return;
    setAttempted(true);
    if (itemDraftError(draft)) return;
    const body = itemUpdatePayload(entry.item, draft);
    if (!body) {
      closeDetails();
      return;
    }
    await send(entry, body);
  }

  return {
    status: savingKey ? "saving" : "idle",
    savingKey,
    openKey,
    draft,
    draftError: attempted && draft ? itemDraftError(draft) : null,
    error,
    allowedStatuses: allowedFor,
    chooseStatus,
    openDetails: (entry) => open(entry),
    closeDetails,
    updateDraft: (patch) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    saveDraft,
    dismissError: () => setError(null),
  };
}
