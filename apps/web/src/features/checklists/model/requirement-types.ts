/* Project requirement types. Pure: no React, no fetch, no Next.
 *
 * A Project (the hierarchy "delivery project") owns its requirements, and
 * they apply to every repository filed under it. Two kinds:
 *   - `functional`: a Feature, whose items are User stories;
 *   - `system`: a flat System requirement (every older team checklist is one).
 * Each item carries a Progress track (To do / In progress / Done) that
 * Developers move, separate from the Verification QA records on a Project
 * QA run.
 *
 * The `…Wire` shapes mirror the backend contract (docs/design/
 * project-requirements.md, sections 2.1 to 2.3). Nothing above the data layer
 * reads them: the normalisers in requirement-rules.ts turn them into the
 * shapes below, so a missing field degrades to "unknown" or "read-only",
 * never to a crash or to a permission the server did not give. */

import type { ChecklistVerificationType } from "./checklist-types";
import type { QaActor } from "./qa-run-types";

export type RequirementKind = "functional" | "system";

export type RequirementProgress = "todo" | "in_progress" | "done";

export interface ProgressCounts {
  todo: number;
  in_progress: number;
  done: number;
}

/* ── Wire shapes ────────────────────────────────────────────────────────── */

export interface RequirementItemWire {
  id: string;
  position: number;
  title: string;
  acceptanceCriteria: string | null;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  progress: RequirementProgress;
  progressBy: QaActor | null;
  progressAt: string | null;
  rowVersion: number;
  canSetProgress: boolean;
}

export interface RequirementWire {
  id: string;
  kind: RequirementKind;
  deliveryProjectId: string | null;
  workspaceId: string;
  name: string;
  description: string | null;
  version: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  legacyChecklistId: string | null;
  items: RequirementItemWire[];
  progressCounts: ProgressCounts;
}

/** GET /delivery-projects/:dpId/requirements */
export interface ProjectRequirementsResponseWire {
  deliveryProject: { id: string; name: string; groupId: string };
  requirements: RequirementWire[];
  permissions: { canManage: boolean; canSetProgress: boolean };
}

/** PATCH /requirements/:id/items/:itemId/progress */
export interface SetProgressResponseWire {
  item: RequirementItemWire;
  readyForQaNotified: boolean;
}

/* ── What the views read (normalised) ───────────────────────────────────── */

export interface RequirementItem {
  id: string;
  requirementId: string;
  position: number;
  title: string;
  acceptanceCriteria: string | null;
  verificationType: ChecklistVerificationType;
  testIdentifier: string | null;
  progress: RequirementProgress;
  progressBy: QaActor | null;
  progressAt: string | null;
  /** Null when the server sent none: the item is then read-only. */
  rowVersion: number | null;
  /** The server's per-item answer, or null when it sent none. */
  canSetProgress: boolean | null;
}

export interface Requirement {
  id: string;
  kind: RequirementKind;
  deliveryProjectId: string | null;
  workspaceId: string | null;
  name: string;
  description: string | null;
  /** Null when the server sent none: the requirement is then not editable. */
  version: number | null;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  legacyChecklistId: string | null;
  /** In position order. */
  items: RequirementItem[];
  progressCounts: ProgressCounts;
}

export interface RequirementPermissionFlags {
  /** The server's flag, or null when it sent none (then the app role decides). */
  canManage: boolean | null;
  canSetProgress: boolean | null;
}

export interface ProjectRequirements {
  deliveryProject: { id: string; name: string; groupId: string | null } | null;
  requirements: Requirement[];
  permissions: RequirementPermissionFlags;
}

export interface SetProgressResult {
  item: RequirementItem;
  readyForQaNotified: boolean;
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface RequirementItemInput {
  title: string;
  acceptanceCriteria?: string | null;
  verificationType?: ChecklistVerificationType;
  testIdentifier?: string | null;
}

export interface CreateRequirementInput {
  kind: RequirementKind;
  name: string;
  description?: string | null;
  items?: RequirementItemInput[];
}

/** One requirement of a batch create: the single create's body, minus the kind. */
export type BatchRequirementInput = Omit<CreateRequirementInput, "kind">;

/** POST /delivery-projects/:dpId/requirements/batch — 1 to 20, all of one kind, all or nothing. */
export interface CreateRequirementBatchInput {
  kind: RequirementKind;
  requirements: BatchRequirementInput[];
}

export interface UpdateRequirementInput {
  expectedVersion: number;
  name?: string;
  description?: string | null;
}

export interface UpdateRequirementItemInput {
  expectedRowVersion: number;
  title?: string;
  acceptanceCriteria?: string | null;
  verificationType?: ChecklistVerificationType;
  testIdentifier?: string | null;
}

export interface SetProgressInput {
  progress: RequirementProgress;
  expectedRowVersion: number;
  note?: string;
}

/* ── Drafts ─────────────────────────────────────────────────────────────── */

/**
 * The requirement dialog. `stories` is the list of first stories or items,
 * one row each (blank rows are skipped on send); only used on create.
 */
export interface RequirementDraft {
  name: string;
  description: string;
  stories: string[];
}

/**
 * One card of the New Feature (or New System requirement) dialog: a whole
 * requirement with its first stories. `key` identifies the card while the
 * dialog is open (cards are added and removed, so the index is not stable).
 */
export interface RequirementCardDraft extends RequirementDraft {
  key: string;
}

/** One story or item being written. Strings so the inputs stay controlled. */
export interface RequirementItemDraft {
  title: string;
  acceptanceCriteria: string;
  verificationType: ChecklistVerificationType;
  testIdentifier: string;
}

export type RequirementsStatus = "loading" | "ready" | "error" | "unavailable";
