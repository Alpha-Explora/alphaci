"use client";

import { useState } from "react";

import { requirementsRepository } from "../../data/requirements-repository";
import {
  blankItemDraft,
  createItemPayload,
  itemDraftFromRequirementItem,
  reorderedItemIds,
  requirementError,
  requirementItemDraftError,
  updateItemPayload,
  withItemOrder,
  type RequirementError,
} from "../../model/requirement-rules";
import type { Requirement, RequirementItem, RequirementItemDraft } from "../../model/requirement-types";

export type RequirementItemsStatus = "idle" | "saving";

export type ItemEditing = { mode: "add" } | { mode: "edit"; itemId: string };

export interface RequirementItemsViewModel {
  /** `saving` while one write (add, edit, delete, move) is in flight. */
  status: RequirementItemsStatus;
  /** The item the write is about; null for an add. */
  busyItemId: string | null;
  editing: ItemEditing | null;
  draft: RequirementItemDraft;
  updateDraft: (patch: Partial<RequirementItemDraft>) => void;
  /** Why the draft cannot be sent. Shown once Save was tried. */
  validationError: string | null;
  /** The last failed write; `itemId` null for an add. */
  error: (RequirementError & { itemId: string | null }) | null;
  /** The item waiting for "Delete" to be confirmed. */
  confirmDeleteId: string | null;
  startAdd: () => void;
  startEdit: (item: RequirementItem) => void;
  cancel: () => void;
  submit: () => Promise<void>;
  askDelete: (item: RequirementItem) => void;
  cancelDelete: () => void;
  confirmDelete: (item: RequirementItem) => Promise<void>;
  move: (item: RequirementItem, delta: -1 | 1) => Promise<void>;
  dismissError: () => void;
}

const SAVE_ERROR = "The change could not be saved. Try again in a moment.";

/**
 * ViewModel for one requirement's stories or items (Product owner, admin):
 * add, edit, delete and reorder — always by item id, so every item's
 * Progress survives an edit. Each write carries the row version read; a
 * reorder sends exactly the current set of ids.
 */
export function useRequirementItemsViewModel(options: {
  requirement: Requirement;
  /** How the item is called ("User story", "Item"), for the copy. */
  itemLabel: string;
  onItem: (item: RequirementItem) => void;
  onRemoved: (requirementId: string, itemId: string) => void;
  onRequirement: (requirement: Requirement) => void;
}): RequirementItemsViewModel {
  const { requirement, itemLabel, onItem, onRemoved, onRequirement } = options;
  const [editing, setEditing] = useState<ItemEditing | null>(null);
  const [draft, setDraft] = useState<RequirementItemDraft>(blankItemDraft);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState<{ itemId: string | null } | null>(null);
  const [error, setError] = useState<(RequirementError & { itemId: string | null }) | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function begin(next: ItemEditing, value: RequirementItemDraft) {
    setEditing(next);
    setDraft(value);
    setAttempted(false);
    setError(null);
    setConfirmDeleteId(null);
  }

  async function run(itemId: string | null, task: () => Promise<void>) {
    if (busy) return;
    setBusy({ itemId });
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError({ itemId, ...requirementError(cause, SAVE_ERROR) });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!editing || busy) return;
    setAttempted(true);
    if (requirementItemDraftError(draft, itemLabel)) return;
    if (editing.mode === "add") {
      await run(null, async () => {
        onItem(await requirementsRepository.addItem(requirement.id, createItemPayload(draft)));
        setEditing(null);
      });
      return;
    }
    const item = requirement.items.find((entry) => entry.id === editing.itemId);
    const body = item ? updateItemPayload(item, draft) : null;
    if (!item || !body) {
      setEditing(null);
      return;
    }
    await run(item.id, async () => {
      onItem(await requirementsRepository.updateItem(requirement.id, item.id, body));
      setEditing(null);
    });
  }

  async function confirmDelete(item: RequirementItem) {
    await run(item.id, async () => {
      await requirementsRepository.deleteItem(requirement.id, item.id);
      setConfirmDeleteId(null);
      onRemoved(requirement.id, item.id);
    });
  }

  async function move(item: RequirementItem, delta: -1 | 1) {
    const ids = reorderedItemIds(requirement.items, item.id, delta);
    if (!ids) return;
    await run(item.id, async () => {
      await requirementsRepository.reorderItems(requirement.id, ids);
      onRequirement(withItemOrder(requirement, ids));
    });
  }

  return {
    status: busy ? "saving" : "idle",
    busyItemId: busy?.itemId ?? null,
    editing,
    draft,
    updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
    validationError: attempted && editing ? requirementItemDraftError(draft, itemLabel) : null,
    error,
    confirmDeleteId,
    startAdd: () => begin({ mode: "add" }, blankItemDraft()),
    startEdit: (item) => begin({ mode: "edit", itemId: item.id }, itemDraftFromRequirementItem(item)),
    cancel: () => {
      if (!busy) setEditing(null);
    },
    submit,
    askDelete: (item) => {
      setConfirmDeleteId(item.id);
      setError(null);
    },
    cancelDelete: () => setConfirmDeleteId(null),
    confirmDelete,
    move,
    dismissError: () => setError(null),
  };
}
