/* Pure rules for the Overview's "My QA items" card: reading the response,
 * folding a write's result back in, and what a developer may set on an item
 * from outside QA Studio. No React, no fetch.
 *
 * Both lists are read through a normaliser: an older backend sends only
 * `items` from qa-returned-items, a newer one may add fields, and a partial
 * row must degrade to "read-only", never to a control the server refuses. */

import type { ChecklistTargetPersona, ChecklistVerificationType } from "./checklist-types";
import { TARGET_PERSONA_OPTIONS, VERIFICATION_TYPE_OPTIONS } from "./checklist-rules";
import { commitLabel, QA_ITEM_STATUSES, QA_SEVERITIES } from "./qa-run-rules";
import type {
  QaActor,
  QaFixRequest,
  QaMyItemsResponse,
  QaReturnedItem,
  QaRun,
  QaRunItem,
} from "./qa-run-types";
import { oneOf, record, records, text, type Loose } from "./wire-readers";

const PERSONAS: ReadonlyArray<ChecklistTargetPersona> = TARGET_PERSONA_OPTIONS.map((option) => option.value);
const VERIFICATION_TYPES: ReadonlyArray<ChecklistVerificationType> = VERIFICATION_TYPE_OPTIONS.map(
  (option) => option.value,
);

/* ── Reading the response ────────────────────────────────────────────────── */

function actorFrom(value: unknown): QaActor | null {
  const raw = record(value);
  const id = text(raw?.id);
  const login = text(raw?.login);
  return id && login ? { id, login } : null;
}

function fixRequestFrom(value: unknown): QaFixRequest | null {
  const raw = record(value);
  const requestedAt = text(raw?.requestedAt);
  const requestedBy = actorFrom(raw?.requestedBy);
  if (!requestedAt || !requestedBy) return null;
  return { requestedAt, requestedBy, note: text(raw?.note) };
}

/** A row version the server can compare, or null (then the item is read-only). */
function rowVersionFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function positionFrom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** What was recorded against the item. */
function recordedFrom(raw: Loose) {
  return {
    notes: text(raw.notes),
    defectSeverity: oneOf(raw.defectSeverity, QA_SEVERITIES),
    reproductionSteps: text(raw.reproductionSteps),
    fixRequest: fixRequestFrom(raw.fixRequest),
    verifiedBy: actorFrom(raw.verifiedBy),
    verifiedAt: text(raw.verifiedAt),
  };
}

function itemFrom(raw: Loose, runId: string): QaRunItem | null {
  const id = text(raw.id);
  const title = text(raw.title);
  const status = oneOf(raw.status, QA_ITEM_STATUSES);
  if (!id || !title || !status) return null;
  const rowVersion = rowVersionFrom(raw.rowVersion);
  return {
    id,
    runId,
    position: positionFrom(raw.position),
    title,
    description: text(raw.description),
    targetPersona: oneOf(raw.targetPersona, PERSONAS) ?? "all",
    verificationType: oneOf(raw.verificationType, VERIFICATION_TYPES) ?? "manual",
    testIdentifier: text(raw.testIdentifier),
    status,
    ...recordedFrom(raw),
    rowVersion: rowVersion ?? 0,
    // No row version, no write: the server would refuse it as stale.
    canUpdate: raw.canUpdate === true && rowVersion !== null,
    previous: null,
  };
}

function entryFrom(raw: Loose): QaReturnedItem | null {
  const runId = text(raw.runId);
  const itemRaw = record(raw.item);
  if (!runId || !itemRaw) return null;
  const item = itemFrom(itemRaw, runId);
  if (!item) return null;
  return {
    runId,
    branch: text(raw.branch) ?? "",
    commitSha: text(raw.commitSha) ?? "",
    checklistName: text(raw.checklistName) ?? "Checklist",
    item,
  };
}

function entriesFrom(value: unknown): QaReturnedItem[] {
  return records(value)
    .map(entryFrom)
    .filter((entry): entry is QaReturnedItem => entry !== null);
}

/** Any input to the card's two lists. Absent lists are empty; broken rows are dropped. */
export function normalizeMyQaItems(value: unknown): QaMyItemsResponse {
  const raw = record(value) ?? {};
  return { returned: entriesFrom(raw.returned), developerItems: entriesFrom(raw.developerItems) };
}

/** The older qa-returned-items reply, in the same shape (no developer items). */
export function myItemsFromReturned(value: unknown): QaMyItemsResponse {
  return { returned: entriesFrom(record(value)?.items), developerItems: [] };
}

export function myItemsCount(data: QaMyItemsResponse): number {
  return data.returned.length + data.developerItems.length;
}

/* ── After a write ───────────────────────────────────────────────────────── */

function patchEntries(entries: QaReturnedItem[], run: QaRun): QaReturnedItem[] {
  return entries.map((entry) => {
    if (entry.runId !== run.id) return entry;
    const next = run.items.find((item) => item.id === entry.item.id);
    return next ? { ...entry, item: next } : entry;
  });
}

/**
 * Fold the run a PATCH returned into both lists, so the row shows the
 * server's state (status, new rowVersion) at once, without a reload.
 */
export function applyRunToMyItems(data: QaMyItemsResponse, run: QaRun): QaMyItemsResponse {
  return { returned: patchEntries(data.returned, run), developerItems: patchEntries(data.developerItems, run) };
}

/* ── What a developer may do from the Overview ───────────────────────────── */

/**
 * The run context `allowedItemStatuses` and `canEditItem` expect, for an item
 * listed outside its run. Only the item's own `canUpdate` grants anything, and
 * "Returned to dev" is never offered here: returning is QA's call, made in QA
 * Studio.
 */
export function developerItemRun(entry: Pick<QaReturnedItem, "item">): Pick<QaRun, "status" | "permissions"> {
  return {
    status: "open",
    permissions: {
      canUpdateItems: entry.item.canUpdate,
      canReturnToDev: false,
      canRequestRetest: false,
      canSignOff: false,
      canReopen: false,
    },
  };
}

export function myItemKey(entry: Pick<QaReturnedItem, "runId" | "item">): string {
  return `${entry.runId}:${entry.item.id}`;
}

export interface MyItemsCommitGroup {
  key: string;
  /** "uat @ 9f8e7d6". */
  label: string;
  entries: QaReturnedItem[];
}

/** Developer items grouped by the commit they are checked on, in first-seen order. */
export function groupByCommit(entries: ReadonlyArray<QaReturnedItem>): MyItemsCommitGroup[] {
  const groups = new Map<string, MyItemsCommitGroup>();
  for (const entry of entries) {
    const key = `${entry.branch}@${entry.commitSha}`;
    const group = groups.get(key) ?? { key, label: commitLabel(entry.branch, entry.commitSha), entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()];
}
