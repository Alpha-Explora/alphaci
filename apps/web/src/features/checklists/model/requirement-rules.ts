/* Pure Project requirement rules: reading the wire, who may do what, labels,
 * drafts and error copy. No React, no fetch.
 *
 * Who may do what is an allow-list per action (never "anyone but…"), and the
 * server's own flags win: a role rule here only stands in when the server
 * sent no flag, and it can never grant more than the backend's rule
 * (docs/design/project-requirements.md, section 4.1). */

import type { AppRole } from "@/shared/api/contracts";

import {
  needsTestIdentifier,
  VERIFICATION_TYPE_OPTIONS,
} from "./checklist-rules";
import type { ChecklistVerificationType } from "./checklist-types";
import { isStaleCode, qaCodeMessage } from "./qa-error-messages";
import type { QaActor } from "./qa-run-types";
import type {
  CreateRequirementInput,
  ProgressCounts,
  ProjectRequirements,
  Requirement,
  RequirementDraft,
  RequirementItem,
  RequirementItemDraft,
  RequirementItemInput,
  RequirementKind,
  RequirementProgress,
  SetProgressResult,
  UpdateRequirementInput,
  UpdateRequirementItemInput,
} from "./requirement-types";
import { normalizeTestCategories } from "./test-case-rules";
import { errorStatus, oneOf, record, records, text, type Loose } from "./wire-readers";

type Role = AppRole | null | undefined;

export const REQUIREMENT_KINDS: ReadonlyArray<RequirementKind> = ["functional", "system"];

/**
 * The sections a Project's Requirements tab shows, in order. System
 * requirements are hidden for now; add "system" back to show them again.
 * Only the section is hidden: existing System requirements still reach QA
 * runs and My QA items, so they can still be progressed and verified.
 */
export const SHOWN_REQUIREMENT_KINDS: ReadonlyArray<RequirementKind> = ["functional"];
export const PROGRESS_VALUES: ReadonlyArray<RequirementProgress> = ["todo", "in_progress", "done"];
/** The backend's limits (CreateRequirementDto, RequirementItemDto). */
export const REQUIREMENT_NAME_MAX = 200;
export const REQUIREMENT_ITEM_TITLE_MAX = 300;
export const ACCEPTANCE_CRITERIA_MAX = 4000;

const VERIFICATION_TYPES: ReadonlyArray<ChecklistVerificationType> = VERIFICATION_TYPE_OPTIONS.map(
  (option) => option.value,
);

/* ── Who may do what (allow-lists) ──────────────────────────────────────── */

const REQUIREMENT_MANAGERS: ReadonlyArray<AppRole> = ["lead", "admin"];
const PROGRESS_SETTERS: ReadonlyArray<AppRole> = ["member", "lead", "admin"];
const VERIFIERS: ReadonlyArray<AppRole> = ["qa", "lead", "admin"];
const RUN_REOPENERS: ReadonlyArray<AppRole> = ["lead", "admin"];

function named(list: ReadonlyArray<AppRole>, role: Role): boolean {
  return role !== null && role !== undefined && list.includes(role);
}

/** Create, edit, archive and reorder requirements: Product owner or admin. */
export function canManageRequirements(role: Role): boolean {
  return named(REQUIREMENT_MANAGERS, role);
}

/** Move an item's Progress: Developer, Product owner or admin. Never QA. */
export function canSetProgress(role: Role): boolean {
  return named(PROGRESS_SETTERS, role);
}

/** Record Verification, start a Project run, sign it off: QA Team, Product owner or admin. */
export function canSetVerification(role: Role): boolean {
  return named(VERIFIERS, role);
}

/** Reopen a signed-off Project run: Product owner or admin. */
export function canReopenProjectRun(role: Role): boolean {
  return named(RUN_REOPENERS, role);
}

/** The server's exact boolean when it sent one, else the app-role rule. Never "yes" by default. */
export function resolveFlag(serverFlag: unknown, fallback: boolean): boolean {
  return typeof serverFlag === "boolean" ? serverFlag : fallback;
}

export interface RequirementPermissions {
  canManage: boolean;
  canSetProgress: boolean;
}

export function resolveRequirementPermissions(
  data: Pick<ProjectRequirements, "permissions"> | null,
  role: Role,
): RequirementPermissions {
  return {
    canManage: resolveFlag(data?.permissions.canManage, canManageRequirements(role)),
    canSetProgress: resolveFlag(data?.permissions.canSetProgress, canSetProgress(role)),
  };
}

export function isRequirementArchived(requirement: Pick<Requirement, "archivedAt">): boolean {
  return requirement.archivedAt !== null;
}

/**
 * Whether this viewer may move this item's Progress: the list's answer, AND
 * the item's own answer when the server sent one, on a live requirement, with
 * a row version to send back.
 */
export function itemProgressEditable(
  item: Pick<RequirementItem, "canSetProgress" | "rowVersion">,
  canSetProgressHere: boolean,
  archived = false,
): boolean {
  if (archived || item.rowVersion === null || !canSetProgressHere) return false;
  return item.canSetProgress !== false;
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

const PROGRESS_LABELS: Record<RequirementProgress, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export function progressLabel(progress: RequirementProgress): string {
  return PROGRESS_LABELS[progress] ?? progress;
}

export type ProgressTone = "neutral" | "brand" | "success";

const PROGRESS_TONES: Record<RequirementProgress, ProgressTone> = {
  todo: "neutral",
  in_progress: "brand",
  done: "success",
};

export function progressTone(progress: RequirementProgress): ProgressTone {
  return PROGRESS_TONES[progress] ?? "neutral";
}

export interface KindCopy {
  section: string;
  lede: string;
  singular: string;
  plural: string;
  item: string;
  items: string;
  create: string;
  addItem: string;
  empty: string;
}

const KIND_COPY: Record<RequirementKind, KindCopy> = {
  functional: {
    section: "Functional Requirements (Features)",
    lede: "What the product must do. Each Feature is told as User stories, with the acceptance criteria QA verifies.",
    singular: "Feature",
    plural: "Features",
    item: "User story",
    items: "User stories",
    create: "New Feature",
    addItem: "Add user story",
    empty: "No Features yet.",
  },
  system: {
    section: "System requirements",
    lede: "Checks every repository in this Project must pass: security, performance, release hygiene. Earlier team checklists live here.",
    singular: "System requirement",
    plural: "System requirements",
    item: "Item",
    items: "Items",
    create: "New system requirement",
    addItem: "Add item",
    empty: "No System requirements yet.",
  },
};

export function kindCopy(kind: RequirementKind): KindCopy {
  return KIND_COPY[kind];
}

/** "3 of 5 done". */
export function progressSummaryLabel(counts: ProgressCounts): string {
  const total = counts.todo + counts.in_progress + counts.done;
  if (total === 0) return "No items yet";
  return `${counts.done} of ${total} done`;
}

/** Done's share of every item, 0–100, for the meter. */
export function donePercent(counts: ProgressCounts): number {
  const total = counts.todo + counts.in_progress + counts.done;
  return total === 0 ? 0 : Math.round((counts.done / total) * 100);
}

/* ── Reading the wire ───────────────────────────────────────────────────── */

function actorFrom(value: unknown): QaActor | null {
  const raw = record(value);
  const id = text(raw?.id);
  const login = text(raw?.login);
  return id && login ? { id, login } : null;
}

function wholeOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function count(value: unknown): number {
  return wholeOrNull(value) ?? 0;
}

export function countProgress(items: ReadonlyArray<Pick<RequirementItem, "progress">>): ProgressCounts {
  const counts: ProgressCounts = { todo: 0, in_progress: 0, done: 0 };
  for (const item of items) counts[item.progress] += 1;
  return counts;
}

function itemDefinitionFrom(raw: Loose) {
  return {
    position: typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : 0,
    acceptanceCriteria: text(raw.acceptanceCriteria),
    verificationType: oneOf(raw.verificationType, VERIFICATION_TYPES) ?? "manual",
    testIdentifier: text(raw.testIdentifier),
  };
}

/** One item, or null when it has no id or title (a broken row is dropped). */
export function normalizeRequirementItem(value: unknown, requirementId: string): RequirementItem | null {
  const raw = record(value);
  const id = text(raw?.id);
  const title = text(raw?.title);
  if (!raw || !id || !title) return null;
  return {
    id,
    requirementId,
    title,
    ...itemDefinitionFrom(raw),
    progress: oneOf(raw.progress, PROGRESS_VALUES) ?? "todo",
    progressBy: actorFrom(raw.progressBy),
    progressAt: text(raw.progressAt),
    rowVersion: wholeOrNull(raw.rowVersion),
    canSetProgress: typeof raw.canSetProgress === "boolean" ? raw.canSetProgress : null,
    testCategories: normalizeTestCategories(raw.testCategories),
  };
}

function itemsFrom(value: unknown, requirementId: string): RequirementItem[] {
  return records(value)
    .map((raw) => normalizeRequirementItem(raw, requirementId))
    .filter((item): item is RequirementItem => item !== null)
    .sort((a, b) => a.position - b.position);
}

function countsFrom(value: unknown, items: RequirementItem[]): ProgressCounts {
  const raw = record(value);
  if (!raw) return countProgress(items);
  return { todo: count(raw.todo), in_progress: count(raw.in_progress), done: count(raw.done) };
}

function datesFrom(raw: Loose) {
  return {
    archivedAt: text(raw.archivedAt),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
  };
}

/** One requirement, or null without an id. An unknown kind reads as `system`. */
export function normalizeRequirement(value: unknown): Requirement | null {
  const raw = record(value);
  const id = text(raw?.id);
  if (!raw || !id) return null;
  const items = itemsFrom(raw.items, id);
  return {
    id,
    kind: oneOf(raw.kind, REQUIREMENT_KINDS) ?? "system",
    deliveryProjectId: text(raw.deliveryProjectId),
    workspaceId: text(raw.workspaceId),
    name: text(raw.name) ?? "Untitled requirement",
    description: text(raw.description),
    version: wholeOrNull(raw.version),
    ...datesFrom(raw),
    legacyChecklistId: text(raw.legacyChecklistId),
    items,
    progressCounts: countsFrom(raw.progressCounts, items),
  };
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function deliveryProjectFrom(value: unknown): ProjectRequirements["deliveryProject"] {
  const raw = record(value);
  const id = text(raw?.id);
  if (!id) return null;
  return { id, name: text(raw?.name) ?? "Project", groupId: text(raw?.groupId) };
}

/** The Project's requirements. Absent lists are empty; absent flags are "unknown". */
export function normalizeProjectRequirements(value: unknown): ProjectRequirements {
  const raw = record(value) ?? {};
  const permissions = record(raw.permissions);
  return {
    deliveryProject: deliveryProjectFrom(raw.deliveryProject),
    requirements: records(raw.requirements)
      .map(normalizeRequirement)
      .filter((entry): entry is Requirement => entry !== null),
    permissions: { canManage: flag(permissions?.canManage), canSetProgress: flag(permissions?.canSetProgress) },
  };
}

/** The Progress reply; a reply without an item keeps the caller's own copy. */
export function normalizeProgressResult(value: unknown, previous: RequirementItem): SetProgressResult {
  const raw = record(value);
  const item = normalizeRequirementItem(raw?.item, previous.requirementId);
  return { item: item ?? previous, readyForQaNotified: raw?.readyForQaNotified === true };
}

/**
 * GET /workspaces/:ws/qa-requirements/overview, reduced to what a Project card
 * shows: how many live requirements each Project has. A Project the server
 * lists with none counts 0; a broken group is skipped.
 */
export function requirementCountsByProject(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of records(record(value)?.groups)) {
    const id = text(record(group.deliveryProject)?.id);
    if (!id) continue;
    counts[id] = records(group.requirements).filter((entry) => !text(entry.archivedAt)).length;
  }
  return counts;
}

/** "2 requirements" / "1 requirement" / "No requirements". */
export function requirementCountLabel(count: number): string {
  if (count === 0) return "No requirements";
  return `${count} ${count === 1 ? "requirement" : "requirements"}`;
}

/* ── Arranging ──────────────────────────────────────────────────────────── */

function byCreation(a: Requirement, b: Requirement): number {
  const at = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  return at !== 0 ? at : a.name.localeCompare(b.name);
}

/** Live requirements of one kind, oldest first (the order a Project run snapshots). */
export function requirementsOfKind(
  requirements: ReadonlyArray<Requirement>,
  kind: RequirementKind,
): Requirement[] {
  return requirements
    .filter((requirement) => requirement.kind === kind && !isRequirementArchived(requirement))
    .sort(byCreation);
}

/** Put a saved requirement into the list: replaced in place, or added. */
export function upsertRequirement(list: ReadonlyArray<Requirement>, saved: Requirement): Requirement[] {
  const found = list.some((entry) => entry.id === saved.id);
  return found ? list.map((entry) => (entry.id === saved.id ? saved : entry)) : [...list, saved];
}

function withItems(requirement: Requirement, items: RequirementItem[]): Requirement {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return { ...requirement, items: sorted, progressCounts: countProgress(sorted) };
}

/** Put a saved item into its requirement (replaced, or appended), recounting Progress. */
export function upsertRequirementItem(
  list: ReadonlyArray<Requirement>,
  requirementId: string,
  saved: RequirementItem,
): Requirement[] {
  return list.map((requirement) => {
    if (requirement.id !== requirementId) return requirement;
    const found = requirement.items.some((item) => item.id === saved.id);
    const items = found
      ? requirement.items.map((item) => (item.id === saved.id ? saved : item))
      : [...requirement.items, saved];
    return withItems(requirement, items);
  });
}

export function removeRequirementItem(
  list: ReadonlyArray<Requirement>,
  requirementId: string,
  itemId: string,
): Requirement[] {
  return list.map((requirement) =>
    requirement.id === requirementId
      ? withItems(requirement, requirement.items.filter((item) => item.id !== itemId))
      : requirement,
  );
}

/**
 * The full id list after moving one item by `delta` (−1 up, +1 down), or null
 * when it cannot move (already at that end, or not in the list).
 */
export function reorderedItemIds(
  items: ReadonlyArray<Pick<RequirementItem, "id">>,
  itemId: string,
  delta: -1 | 1,
): string[] | null {
  const from = items.findIndex((item) => item.id === itemId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return null;
  const ids = items.map((item) => item.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** The requirement with its items in `itemIds` order, positions rewritten 0..n−1. */
export function withItemOrder(requirement: Requirement, itemIds: ReadonlyArray<string>): Requirement {
  const byId = new Map(requirement.items.map((item) => [item.id, item]));
  const items = itemIds
    .map((id) => byId.get(id))
    .filter((item): item is RequirementItem => item !== undefined)
    .map((item, position) => ({ ...item, position }));
  return { ...requirement, items, progressCounts: countProgress(items) };
}

/* ── Requirement drafts ─────────────────────────────────────────────────── */

function trimmedOrNull(value: string): string | null {
  return value.trim() || null;
}

export function blankRequirementDraft(): RequirementDraft {
  return { name: "", description: "", stories: [""] };
}

export function requirementDraftFrom(requirement: Requirement): RequirementDraft {
  return { name: requirement.name, description: requirement.description ?? "", stories: [""] };
}

/* ── Story rows ─────────────────────────────────────────────────────────────
 * The dialog lists its first stories (or items) one input each. The list is
 * never empty, so there is always a row to type into. */

/** The rows that say something, trimmed, as items. Blank rows are skipped. */
export function storiesFromRows(rows: ReadonlyArray<string>): RequirementItemInput[] {
  return rows
    .map((row) => row.trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

/** Row `index` set to `value`. */
export function editStoryRow(rows: ReadonlyArray<string>, index: number, value: string): string[] {
  return rows.map((row, at) => (at === index ? value : row));
}

/** A blank row inserted after `afterIndex` (the end by default). */
export function addStoryRow(rows: ReadonlyArray<string>, afterIndex = rows.length - 1): string[] {
  const at = Math.min(Math.max(afterIndex + 1, 0), rows.length);
  return [...rows.slice(0, at), "", ...rows.slice(at)];
}

/** Row `index` removed; the last row left is cleared instead of removed. */
export function removeStoryRow(rows: ReadonlyArray<string>, index: number): string[] {
  const rest = rows.filter((_, at) => at !== index);
  return rest.length > 0 ? rest : [""];
}

/**
 * A pasted block of several lines becomes one row per line: it fills row
 * `index` when that row is blank, else lands right after it. Blank lines are
 * dropped. Null for a single line, which the input takes as typed text.
 */
export function pasteIntoStoryRows(
  rows: ReadonlyArray<string>,
  index: number,
  pasted: string,
): string[] | null {
  const lines = pasted
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const replace = (rows[index] ?? "").trim() === "";
  const at = replace ? index : index + 1;
  return [...rows.slice(0, at), ...lines, ...rows.slice(index + 1)];
}

/** Why the draft cannot be sent yet, or null. */
export function requirementDraftError(draft: RequirementDraft, kind: RequirementKind): string | null {
  const name = draft.name.trim();
  const singular = kindCopy(kind).singular;
  if (!name) return `Give the ${singular} a name.`;
  if (name.length > REQUIREMENT_NAME_MAX) return `Keep the name under ${REQUIREMENT_NAME_MAX} characters.`;
  const long = storiesFromRows(draft.stories).find((story) => story.title.length > REQUIREMENT_ITEM_TITLE_MAX);
  if (long) return `Keep each ${kindCopy(kind).item.toLowerCase()} under ${REQUIREMENT_ITEM_TITLE_MAX} characters.`;
  return null;
}

export function createRequirementPayload(kind: RequirementKind, draft: RequirementDraft): CreateRequirementInput {
  const body: CreateRequirementInput = { kind, name: draft.name.trim() };
  const description = trimmedOrNull(draft.description);
  if (description) body.description = description;
  const items = storiesFromRows(draft.stories);
  if (items.length > 0) body.items = items;
  return body;
}

/** The PATCH body: the version read plus only what changed; null when nothing did. */
export function updateRequirementPayload(
  requirement: Pick<Requirement, "name" | "description" | "version">,
  draft: RequirementDraft,
): UpdateRequirementInput | null {
  if (requirement.version === null) return null;
  const body: UpdateRequirementInput = { expectedVersion: requirement.version };
  const name = draft.name.trim();
  const description = trimmedOrNull(draft.description);
  if (name !== requirement.name) body.name = name;
  if (description !== (requirement.description ?? null)) body.description = description;
  return Object.keys(body).length > 1 ? body : null;
}

/* ── Item drafts ────────────────────────────────────────────────────────── */

export function blankItemDraft(): RequirementItemDraft {
  return { title: "", acceptanceCriteria: "", verificationType: "manual", testIdentifier: "" };
}

export function itemDraftFromRequirementItem(item: RequirementItem): RequirementItemDraft {
  return {
    title: item.title,
    acceptanceCriteria: item.acceptanceCriteria ?? "",
    verificationType: item.verificationType,
    testIdentifier: item.testIdentifier ?? "",
  };
}

export function requirementItemDraftError(draft: RequirementItemDraft, itemLabel: string): string | null {
  const title = draft.title.trim();
  if (!title) return `Give the ${itemLabel.toLowerCase()} a title.`;
  if (title.length > REQUIREMENT_ITEM_TITLE_MAX) {
    return `Keep the title under ${REQUIREMENT_ITEM_TITLE_MAX} characters.`;
  }
  if (draft.acceptanceCriteria.trim().length > ACCEPTANCE_CRITERIA_MAX) {
    return `Keep the acceptance criteria under ${ACCEPTANCE_CRITERIA_MAX} characters.`;
  }
  return null;
}

/** A manual check never sends a test identifier. */
function testIdentifierOf(draft: RequirementItemDraft): string | null {
  return needsTestIdentifier(draft.verificationType) ? trimmedOrNull(draft.testIdentifier) : null;
}

export function createItemPayload(draft: RequirementItemDraft): RequirementItemInput {
  return {
    title: draft.title.trim(),
    acceptanceCriteria: trimmedOrNull(draft.acceptanceCriteria),
    verificationType: draft.verificationType,
    testIdentifier: testIdentifierOf(draft),
  };
}

/** The PATCH body for an item: the row version read plus what changed; null when nothing did. */
export function updateItemPayload(
  item: RequirementItem,
  draft: RequirementItemDraft,
): UpdateRequirementItemInput | null {
  if (item.rowVersion === null) return null;
  const next = createItemPayload(draft);
  const body: UpdateRequirementItemInput = { expectedRowVersion: item.rowVersion };
  if (next.title !== item.title) body.title = next.title;
  if (next.acceptanceCriteria !== item.acceptanceCriteria) body.acceptanceCriteria = next.acceptanceCriteria ?? null;
  if (next.verificationType !== item.verificationType) body.verificationType = next.verificationType;
  if ((next.testIdentifier ?? null) !== item.testIdentifier) body.testIdentifier = next.testIdentifier ?? null;
  return Object.keys(body).length > 1 ? body : null;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export interface RequirementError {
  message: string;
  /** True when a reload fixes it: someone else wrote first. */
  stale: boolean;
}

function statusFallback(status: number | null, fallback: string): string {
  if (status === 403) return "Your role cannot make this change.";
  if (status === 404) return "This Project or requirement no longer exists, or you are not in its team.";
  return fallback;
}

/** Any thrown error to a sentence a person can act on. Never an API object. */
export function requirementError(cause: unknown, fallback: string): RequirementError {
  const coded = qaCodeMessage(cause);
  if (coded) return { message: coded, stale: isStaleCode(cause) };
  return { message: statusFallback(errorStatus(cause), fallback), stale: false };
}
