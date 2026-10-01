"use client";

import { useState } from "react";

import { requirementsRepository } from "../../data/requirements-repository";
import { requirementError, type RequirementError } from "../../model/requirement-rules";
import type { RequirementItem, RequirementProgress } from "../../model/requirement-types";

export type ItemProgressStatus = "idle" | "saving";

export interface ItemProgressViewModel {
  /** `saving` while one item's Progress write is in flight. */
  status: ItemProgressStatus;
  savingItemId: string | null;
  /** The last failed write, on the item it failed on. */
  error: (RequirementError & { itemId: string }) | null;
  /** The item whose Done just told QA it is ready (the server said it notified). */
  notifiedItemId: string | null;
  setProgress: (item: RequirementItem, progress: RequirementProgress) => Promise<void>;
  dismissError: () => void;
}

const SAVE_ERROR = "Progress could not be saved. Try again in a moment.";

/**
 * ViewModel for moving an item's Progress (To do, In progress, Done) — the
 * one thing a Developer changes on a requirement. Any move is allowed, so a
 * Developer can reopen their own mistake. The write carries the row version
 * read; a stale one comes back flagged so the view can offer a reload.
 * Marking Done tells QA the item is ready; `notifiedItemId` says when the
 * server confirmed it did.
 */
export function useItemProgressViewModel(options: {
  onSaved: (item: RequirementItem) => void;
}): ItemProgressViewModel {
  const { onSaved } = options;
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<(RequirementError & { itemId: string }) | null>(null);
  const [notifiedItemId, setNotifiedItemId] = useState<string | null>(null);

  async function setProgress(item: RequirementItem, progress: RequirementProgress) {
    if (savingItemId || progress === item.progress || item.rowVersion === null) return;
    setSavingItemId(item.id);
    setError(null);
    setNotifiedItemId(null);
    try {
      const result = await requirementsRepository.setProgress(item, {
        progress,
        expectedRowVersion: item.rowVersion,
      });
      onSaved(result.item);
      if (result.readyForQaNotified) setNotifiedItemId(item.id);
    } catch (cause) {
      setError({ itemId: item.id, ...requirementError(cause, SAVE_ERROR) });
    } finally {
      setSavingItemId(null);
    }
  }

  return {
    status: savingItemId ? "saving" : "idle",
    savingItemId,
    error,
    notifiedItemId,
    setProgress,
    dismissError: () => setError(null),
  };
}
