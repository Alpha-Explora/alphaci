/* Pure checklist rules: labels, draft editing, validation and error copy.
 * No React, no fetch — everything here is testable with plain values. */

import type {
  ChecklistDraft,
  ChecklistDraftValidation,
  ChecklistItemDraft,
  ChecklistTargetPersona,
  ChecklistVerificationType,
  QaChecklist,
  QaChecklistItem,
  QaChecklistItemInput,
} from "./checklist-types";

export const TARGET_PERSONA_OPTIONS: ReadonlyArray<{
  value: ChecklistTargetPersona;
  label: string;
}> = [
  { value: "all", label: "Everyone" },
  { value: "developer", label: "Developer" },
  { value: "qa", label: "QA Team" },
];

export const VERIFICATION_TYPE_OPTIONS: ReadonlyArray<{
  value: ChecklistVerificationType;
  label: string;
}> = [
  { value: "manual", label: "Manual check" },
  { value: "playwright", label: "Playwright E2E" },
  { value: "unit_test", label: "Unit test" },
  { value: "bruno", label: "Bruno API" },
];

const PERSONA_LABELS: Record<ChecklistTargetPersona, string> = {
  developer: "Developer",
  qa: "QA Team",
  all: "Everyone",
};

const VERIFICATION_LABELS: Record<ChecklistVerificationType, string> = {
  manual: "Manual check",
  playwright: "Playwright E2E",
  unit_test: "Unit test",
  bruno: "Bruno API",
};

const TEST_IDENTIFIER_PLACEHOLDERS: Record<ChecklistVerificationType, string> = {
  manual: "",
  playwright: "e2e/checkout.spec.ts › pays with a saved card",
  unit_test: "src/cart/cart-total.test.ts",
  bruno: "collections/orders/create-order.bru",
};

/**
 * The section id the old Teams rail used for this surface. Links minted with
 * it (`/teams?section=qa-checklists`) are forwarded to /checklists.
 */
export const QA_CHECKLISTS_SECTION = "qa-checklists";

export const CHECKLIST_NAME_MAX = 120;
export const CHECKLIST_ITEM_TITLE_MAX = 200;

export function targetPersonaLabel(persona: ChecklistTargetPersona): string {
  return PERSONA_LABELS[persona] ?? persona;
}

export function verificationTypeLabel(type: ChecklistVerificationType): string {
  return VERIFICATION_LABELS[type] ?? type;
}

/** Manual checks are ticked by a person; everything else names a test to run. */
export function needsTestIdentifier(type: ChecklistVerificationType): boolean {
  return type !== "manual";
}

export function testIdentifierPlaceholder(type: ChecklistVerificationType): string {
  return TEST_IDENTIFIER_PLACEHOLDERS[type] ?? "";
}

export function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function sharedCountLabel(count: number): string {
  if (count === 0) return "Not shared";
  return `Shared to ${count} ${count === 1 ? "project" : "projects"}`;
}

/** Items with an automated verification — shown so a lead sees the mix at a glance. */
export function automatedItemCount(items: ReadonlyArray<QaChecklistItem>): number {
  return items.filter((item) => needsTestIdentifier(item.verificationType)).length;
}

export function isArchived(checklist: Pick<QaChecklist, "archivedAt">): boolean {
  return checklist.archivedAt !== null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/** "Updated 3 days ago". `now` is a parameter so the rule stays pure. */
export function updatedLabel(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "Updated recently";
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return "Updated just now";
  if (elapsed < HOUR) return `Updated ${plural(Math.floor(elapsed / MINUTE), "minute")}`;
  if (elapsed < DAY) return `Updated ${plural(Math.floor(elapsed / HOUR), "hour")}`;
  if (elapsed < 30 * DAY) return `Updated ${plural(Math.floor(elapsed / DAY), "day")}`;
  return `Updated ${new Date(at).toISOString().slice(0, 10)}`;
}

/** Active checklists first, newest change first; archived ones sink to the end. */
export function sortChecklists(items: ReadonlyArray<QaChecklist>): QaChecklist[] {
  return [...items].sort((a, b) => {
    const archivedOrder = Number(isArchived(a)) - Number(isArchived(b));
    if (archivedOrder !== 0) return archivedOrder;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** Replace a checklist in a list by id, or add it at the front. */
export function upsertChecklist(
  items: ReadonlyArray<QaChecklist>,
  next: QaChecklist,
): QaChecklist[] {
  const exists = items.some((item) => item.id === next.id);
  if (!exists) return [next, ...items];
  return items.map((item) => (item.id === next.id ? next : item));
}

/* ── Draft editing ───────────────────────────────────────────────────────── */

export function blankItemDraft(key: string): ChecklistItemDraft {
  return {
    key,
    title: "",
    description: "",
    targetPersona: "all",
    verificationType: "manual",
    testIdentifier: "",
  };
}

function itemToDraft(item: QaChecklistItem): ChecklistItemDraft {
  return {
    key: item.id,
    title: item.title,
    description: item.description ?? "",
    targetPersona: item.targetPersona,
    verificationType: item.verificationType,
    testIdentifier: item.testIdentifier ?? "",
  };
}

/** A fresh draft for "new checklist", or a copy of an existing one to edit. */
export function draftFromChecklist(checklist: QaChecklist | null): ChecklistDraft {
  if (!checklist) return { name: "", description: "", items: [] };
  const ordered = [...checklist.items].sort((a, b) => a.position - b.position);
  return {
    name: checklist.name,
    description: checklist.description ?? "",
    items: ordered.map(itemToDraft),
  };
}

/** Move the item at `index` by `delta`. Out-of-range moves return the list unchanged. */
export function moveItem<T>(items: ReadonlyArray<T>, index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function removeItemByKey(
  items: ReadonlyArray<ChecklistItemDraft>,
  key: string,
): ChecklistItemDraft[] {
  return items.filter((item) => item.key !== key);
}

export function patchItemByKey(
  items: ReadonlyArray<ChecklistItemDraft>,
  key: string,
  patch: Partial<Omit<ChecklistItemDraft, "key">>,
): ChecklistItemDraft[] {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

function trimmedOrNull(value: string): string | null {
  return value.trim() || null;
}

/** Draft rows to the wire shape. A manual check never sends a test identifier. */
export function toItemInputs(
  items: ReadonlyArray<ChecklistItemDraft>,
): QaChecklistItemInput[] {
  return items.map((item) => ({
    title: item.title.trim(),
    description: trimmedOrNull(item.description),
    targetPersona: item.targetPersona,
    verificationType: item.verificationType,
    testIdentifier: needsTestIdentifier(item.verificationType)
      ? trimmedOrNull(item.testIdentifier)
      : null,
  }));
}

/** The name and description as the backend wants them: trimmed, empty → null. */
export function toDetailsInput(draft: ChecklistDraft): {
  name: string;
  description: string | null;
} {
  return { name: draft.name.trim(), description: trimmedOrNull(draft.description) };
}

function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the checklist a name.";
  if (trimmed.length > CHECKLIST_NAME_MAX) {
    return `Keep the name under ${CHECKLIST_NAME_MAX} characters.`;
  }
  return null;
}

function itemError(item: ChecklistItemDraft): string | null {
  const title = item.title.trim();
  if (!title) return "Every item needs a title.";
  if (title.length > CHECKLIST_ITEM_TITLE_MAX) {
    return `Keep item titles under ${CHECKLIST_ITEM_TITLE_MAX} characters.`;
  }
  return null;
}

export function validateChecklistDraft(draft: ChecklistDraft): ChecklistDraftValidation {
  const itemErrors: Record<string, string> = {};
  for (const item of draft.items) {
    const error = itemError(item);
    if (error) itemErrors[item.key] = error;
  }
  const name = nameError(draft.name);
  return {
    valid: name === null && Object.keys(itemErrors).length === 0,
    nameError: name,
    itemErrors,
  };
}

/** True when the name or description differs from the saved checklist. */
export function detailsChanged(draft: ChecklistDraft, checklist: QaChecklist): boolean {
  return (
    draft.name.trim() !== checklist.name ||
    trimmedOrNull(draft.description) !== (checklist.description ?? null)
  );
}

/** True when the ordered items differ from the saved checklist. */
export function itemsChanged(draft: ChecklistDraft, checklist: QaChecklist): boolean {
  const saved = toItemInputs(draftFromChecklist(checklist).items);
  return JSON.stringify(toItemInputs(draft.items)) !== JSON.stringify(saved);
}

export function isDraftDirty(draft: ChecklistDraft, checklist: QaChecklist | null): boolean {
  if (!checklist) {
    return draft.name.trim() !== "" || draft.description.trim() !== "" || draft.items.length > 0;
  }
  return detailsChanged(draft, checklist) || itemsChanged(draft, checklist);
}

export function toggleProjectId(ids: ReadonlyArray<string>, id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

export function sameProjectSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/* ── Links ───────────────────────────────────────────────────────────────── */

/**
 * Where a lead manages a checklist: the Checklists page, on the owning team,
 * opened on it. (It was `/teams?section=qa-checklists`; /teams still forwards
 * such links here.)
 */
export function checklistManageHref(workspaceId: string, checklistId?: string): string {
  const params = new URLSearchParams({ workspace: workspaceId });
  if (checklistId) params.set("checklist", checklistId);
  return `/checklists?${params.toString()}`;
}

/* ── Errors ──────────────────────────────────────────────────────────────── */

export const STALE_CHECKLIST_MESSAGE =
  "Someone else changed this checklist since you opened it. Reload to see their version, then make your change again.";

function errorStatus(cause: unknown): number | null {
  if (typeof cause !== "object" || cause === null) return null;
  const status = (cause as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function errorDetail(cause: unknown): string {
  const details = (cause as { details?: { message?: unknown } } | null)?.details;
  const message = details?.message;
  if (Array.isArray(message)) return message.join(" ").toLowerCase();
  return typeof message === "string" ? message.toLowerCase() : "";
}

function conflictMessage(detail: string): string {
  if (detail.includes("archived")) {
    return "This checklist is archived, so it can no longer be changed.";
  }
  if (detail.includes("name") || detail.includes("exists") || detail.includes("duplicate")) {
    return "This team already has a checklist with that name. Pick another name.";
  }
  return STALE_CHECKLIST_MESSAGE;
}

/** True for the one error the editor offers a reload for. */
export function isStaleConflict(cause: unknown): boolean {
  return errorStatus(cause) === 409 && conflictMessage(errorDetail(cause)) === STALE_CHECKLIST_MESSAGE;
}

/** Any thrown error to a sentence a person can act on. Never an API object. */
export function checklistErrorMessage(cause: unknown, fallback: string): string {
  const status = errorStatus(cause);
  if (status === 409) return conflictMessage(errorDetail(cause));
  if (status === 403) return "Only team leads can change QA checklists.";
  if (status === 404) {
    return "This checklist no longer exists, or you are no longer in this team.";
  }
  return fallback;
}
