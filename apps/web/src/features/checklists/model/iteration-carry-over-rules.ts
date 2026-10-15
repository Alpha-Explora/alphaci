/* Carry-over: what the "Start iteration N+1" dialog offers to bring along
 * from the delivered iteration (Iterations phase 3, decision D2). Pure: no
 * React, no fetch, no Next.
 *
 * The server decides what is unfinished (`suggested`) and refuses any id
 * that is not an item of the last delivered iteration; this only reads the
 * list, keeps the viewer's selection, and words each item's state. Delivered
 * rows are never moved: carrying copies an item into the new iteration. */

import type {
  CarryOver,
  CarryOverItem,
  CarryOverLastStatus,
  CarryOverProgress,
  CarryOverRequirement,
} from "./iteration-types";
import { itemStatusLabel } from "./qa-run-rules";
import { kindCopy, progressLabel } from "./requirement-rules";
import { oneOf, positiveInt, record, records, text, type Loose } from "./wire-readers";

const PROGRESSES: ReadonlyArray<CarryOverProgress> = ["todo", "in_progress", "done"];
const LAST_STATUSES: ReadonlyArray<CarryOverLastStatus> = [
  "pending",
  "in_progress",
  "passed",
  "failed",
  "blocked",
  "returned_to_dev",
];
const KINDS: ReadonlyArray<CarryOverRequirement["kind"]> = ["functional", "system"];

/** Verification results that send a carried item back to In progress (P13). */
const RESTART_STATUSES: ReadonlySet<CarryOverLastStatus> = new Set<CarryOverLastStatus>([
  "failed",
  "blocked",
  "returned_to_dev",
]);

/* ── Reading the wire ────────────────────────────────────────────────────── */

function carryOverItemFrom(raw: Loose): CarryOverItem | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    title: text(raw.title) ?? "Untitled item",
    progress: oneOf(raw.progress, PROGRESSES) ?? "todo",
    lastStatus: oneOf(raw.lastStatus, LAST_STATUSES),
    // Pre-selected only when the server says so in as many words.
    suggested: raw.suggested === true,
  };
}

function present<T>(value: T | null): value is T {
  return value !== null;
}

function carryOverRequirementFrom(raw: Loose): CarryOverRequirement | null {
  const requirementId = text(raw.requirementId);
  const kind = oneOf(raw.kind, KINDS);
  const items = records(raw.items).map(carryOverItemFrom).filter(present);
  if (!requirementId || !kind || items.length === 0) return null;
  return { requirementId, name: text(raw.name) ?? "Untitled requirement", kind, items };
}

/**
 * The carry-over candidates, or null when the server sent none (an older
 * backend, or a viewer who cannot start the next iteration). A delivered
 * iteration with nothing in it is still an answer: an empty list.
 */
export function normalizeCarryOver(value: unknown): CarryOver | null {
  const raw = record(value);
  const fromIterationNumber = positiveInt(raw?.fromIterationNumber);
  if (!raw || !fromIterationNumber) return null;
  return {
    fromIterationNumber,
    requirements: records(raw.requirements).map(carryOverRequirementFrom).filter(present),
  };
}

/* ── The selection ───────────────────────────────────────────────────────── */

/** Every item the server calls unfinished, in list order: the dialog's starting selection. */
export function unfinishedItemIds(carryOver: CarryOver | null): string[] {
  if (!carryOver) return [];
  return carryOver.requirements.flatMap((requirement) =>
    requirement.items.filter((item) => item.suggested).map((item) => item.id),
  );
}

/** Every item on offer, in list order. */
export function carryOverItemIds(carryOver: CarryOver | null): string[] {
  if (!carryOver) return [];
  return carryOver.requirements.flatMap((requirement) => requirement.items.map((item) => item.id));
}

/** One item in or out. */
export function toggleCarryItem(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "Select all unfinished": every unfinished item in, anything else already picked stays. */
export function selectAllUnfinished(selected: ReadonlySet<string>, carryOver: CarryOver | null): Set<string> {
  return new Set([...selected, ...unfinishedItemIds(carryOver)]);
}

/**
 * The ids to send, in list order, and only ids the list offers: a stale
 * selection can never name an item the dialog does not show.
 */
export function selectedCarryIds(selected: ReadonlySet<string>, carryOver: CarryOver | null): string[] {
  return carryOverItemIds(carryOver).filter((id) => selected.has(id));
}

/* ── Words ───────────────────────────────────────────────────────────────── */

/** True when carrying the item puts its Progress back to In progress (QA failed, blocked or returned it). */
export function carryRestartsProgress(item: Pick<CarryOverItem, "lastStatus">): boolean {
  return item.lastStatus !== null && RESTART_STATUSES.has(item.lastStatus);
}

/**
 * The item's state beside its checkbox: "Done · QA: Passed", "In progress ·
 * Not in the QA run", and for an item QA sent back, that it restarts In
 * progress when carried.
 */
export function carryItemHint(item: Pick<CarryOverItem, "progress" | "lastStatus">): string {
  const qa = item.lastStatus ? `QA: ${itemStatusLabel(item.lastStatus)}` : "Not in the QA run";
  const parts = [progressLabel(item.progress), qa];
  if (carryRestartsProgress(item)) parts.push("restarts In progress");
  return parts.join(" · ");
}

/** One item as the dialog lists it. */
export interface CarryOverRow {
  id: string;
  title: string;
  hint: string;
  suggested: boolean;
  checked: boolean;
}

/** One requirement as the dialog lists it: its kind chip, name and items. */
export interface CarryOverGroup {
  requirementId: string;
  name: string;
  kind: CarryOverRequirement["kind"];
  kindLabel: string;
  items: CarryOverRow[];
}

/** The list the dialog renders, with each item's checkbox state. */
export function carryOverGroups(carryOver: CarryOver | null, selected: ReadonlySet<string>): CarryOverGroup[] {
  if (!carryOver) return [];
  return carryOver.requirements.map((requirement) => ({
    requirementId: requirement.requirementId,
    name: requirement.name,
    kind: requirement.kind,
    kindLabel: kindCopy(requirement.kind).singular,
    items: requirement.items.map((item) => ({
      id: item.id,
      title: item.title,
      hint: carryItemHint(item),
      suggested: item.suggested,
      checked: selected.has(item.id),
    })),
  }));
}

/** "3 of 7 items selected". */
export function carrySelectionLabel(selectedCount: number, total: number): string {
  return `${String(selectedCount)} of ${String(total)} ${total === 1 ? "item" : "items"} selected`;
}
