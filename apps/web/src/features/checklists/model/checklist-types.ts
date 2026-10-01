/* Shared QA checklist types. Pure: no React, no fetch, no Next.
 *
 * The wire shapes mirror the backend contract exactly. A checklist belongs to a
 * workspace (which IS a team) and is shared to projects inside it; later slices
 * attach per-branch QA runs to these same items, which is why an item carries
 * its own verification type and test identifier rather than the checklist. */

export type ChecklistTargetPersona = "developer" | "qa" | "all";

export type ChecklistVerificationType =
  | "manual"
  | "playwright"
  | "unit_test"
  | "bruno";

export interface QaChecklistItem {
  id: string;
  position: number;
  title: string;
  description: string | null;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
}

/** An item as written. Its position is its index in the submitted array. */
export interface QaChecklistItemInput {
  title: string;
  description?: string | null;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier?: string | null;
}

export interface QaChecklist {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  version: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: QaChecklistItem[];
  sharedProjectIds: string[];
  /**
   * Newer backends only. A checklist with a `deliveryProjectId` is a System
   * requirement of that Project: it is edited from the Project, and the team
   * page shows it read-only (writes are refused with
   * REQUIREMENT_MOVED_TO_PROJECT). Read it through `checklistOwningProjectId`.
   */
  kind?: unknown;
  deliveryProjectId?: unknown;
  legacyChecklistId?: unknown;
}

export interface QaChecklistListResponse {
  items: QaChecklist[];
  /** Server-decided: true for team leads and admins. The UI never guesses. */
  canManage: boolean;
}

export interface CreateQaChecklistInput {
  name: string;
  description?: string | null;
  items?: QaChecklistItemInput[];
}

export interface UpdateQaChecklistInput {
  expectedVersion: number;
  name?: string;
  description?: string | null;
}

/** A project a checklist can be shared to — only what the picker renders. */
export interface ChecklistShareTarget {
  id: string;
  name: string;
  detail?: string | null;
}

export type ChecklistsStatus = "loading" | "ready" | "error";

/**
 * One editable row. Strings rather than nulls so inputs stay controlled; the
 * `key` is local and stable across reorders, so React keeps focus on the row
 * that moved instead of the index it moved to.
 */
export interface ChecklistItemDraft {
  key: string;
  title: string;
  description: string;
  targetPersona: ChecklistTargetPersona;
  verificationType: ChecklistVerificationType;
  testIdentifier: string;
}

export interface ChecklistDraft {
  name: string;
  description: string;
  items: ChecklistItemDraft[];
}

export interface ChecklistDraftValidation {
  valid: boolean;
  nameError: string | null;
  /** Keyed by ChecklistItemDraft.key. */
  itemErrors: Record<string, string>;
}
