"use client";

import { useMemo, useRef, useState } from "react";

import { checklistsRepository } from "../../data/checklists-repository";
import {
  blankItemDraft,
  checklistErrorMessage,
  detailsChanged,
  draftFromChecklist,
  isDraftDirty,
  isStaleConflict,
  itemsChanged,
  moveItem as moveDraftItem,
  patchItemByKey,
  removeItemByKey,
  toDetailsInput,
  toItemInputs,
  validateChecklistDraft,
} from "../../model/checklist-rules";
import type {
  ChecklistDraft,
  ChecklistDraftValidation,
  ChecklistItemDraft,
  ChecklistsStatus,
  QaChecklist,
} from "../../model/checklist-types";

export interface ChecklistEditorViewModel {
  /** "loading" while a save is in flight; "error" after one failed. */
  status: ChecklistsStatus;
  error: string | null;
  /** True when the failure was a version conflict — the view offers a reload. */
  stale: boolean;
  isNew: boolean;
  draft: ChecklistDraft;
  /** Only populated after the first save attempt, so a blank form is not red. */
  validation: ChecklistDraftValidation;
  dirty: boolean;
  saving: boolean;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  addItem: () => void;
  updateItem: (key: string, patch: Partial<Omit<ChecklistItemDraft, "key">>) => void;
  moveItem: (index: number, delta: number) => void;
  removeItem: (key: string) => void;
  save: () => Promise<void>;
}

const SAVE_ERROR = "The checklist could not be saved. Try again in a moment.";
const QUIET_VALIDATION: ChecklistDraftValidation = {
  valid: true,
  nameError: null,
  itemErrors: {},
};

/**
 * Details and items are separate writes on the backend, each version-checked.
 * `onStep` records every write that lands, so a retry after a half-finished
 * save starts from the version the server now holds instead of 409-ing on the
 * one it replaced.
 */
async function saveExisting(
  base: QaChecklist,
  draft: ChecklistDraft,
  onStep: (next: QaChecklist) => void,
): Promise<QaChecklist> {
  let current = base;
  if (detailsChanged(draft, current)) {
    current = await checklistsRepository.update(current.id, {
      expectedVersion: current.version,
      ...toDetailsInput(draft),
    });
    onStep(current);
  }
  if (itemsChanged(draft, current)) {
    current = await checklistsRepository.replaceItems(
      current.id,
      current.version,
      toItemInputs(draft.items),
    );
    onStep(current);
  }
  return current;
}

function createChecklist(workspaceId: string, draft: ChecklistDraft): Promise<QaChecklist> {
  return checklistsRepository.create(workspaceId, {
    ...toDetailsInput(draft),
    items: toItemInputs(draft.items),
  });
}

/**
 * ViewModel for creating or editing one checklist. The draft is local until
 * Save; nothing is written while a lead reorders or retypes items.
 */
export function useChecklistEditorViewModel(options: {
  workspaceId: string;
  /** null to create a new checklist. */
  checklist: QaChecklist | null;
  onSaved: (checklist: QaChecklist) => void;
}): ChecklistEditorViewModel {
  const { workspaceId, checklist, onSaved } = options;
  const [draft, setDraft] = useState<ChecklistDraft>(() => draftFromChecklist(checklist));
  const [status, setStatus] = useState<ChecklistsStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // The last version the server confirmed. State, not a ref: `dirty` reads it
  // during render.
  const [base, setBase] = useState<QaChecklist | null>(checklist);
  const keyRef = useRef(0);

  const fullValidation = useMemo(() => validateChecklistDraft(draft), [draft]);

  function patchItems(update: (items: ChecklistItemDraft[]) => ChecklistItemDraft[]) {
    setDraft((current) => ({ ...current, items: update(current.items) }));
  }

  async function save() {
    setAttempted(true);
    if (!fullValidation.valid || status === "loading") return;
    setStatus("loading");
    setError(null);
    setStale(false);
    try {
      const saved = base
        ? await saveExisting(base, draft, setBase)
        : await createChecklist(workspaceId, draft);
      setStatus("ready");
      onSaved(saved);
    } catch (cause) {
      setStatus("error");
      setError(checklistErrorMessage(cause, SAVE_ERROR));
      setStale(isStaleConflict(cause));
    }
  }

  return {
    status,
    error,
    stale,
    isNew: checklist === null,
    draft,
    validation: attempted ? fullValidation : QUIET_VALIDATION,
    dirty: isDraftDirty(draft, base),
    saving: status === "loading",
    setName: (value) => setDraft((current) => ({ ...current, name: value })),
    setDescription: (value) => setDraft((current) => ({ ...current, description: value })),
    addItem: () => {
      keyRef.current += 1;
      const item = blankItemDraft(`new-${String(keyRef.current)}`);
      patchItems((items) => [...items, item]);
    },
    updateItem: (key, patch) => patchItems((items) => patchItemByKey(items, key, patch)),
    moveItem: (index, delta) => patchItems((items) => moveDraftItem(items, index, delta)),
    removeItem: (key) => patchItems((items) => removeItemByKey(items, key)),
    save,
  };
}
