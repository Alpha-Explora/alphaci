/* Pure Project QA run rules: reading the wire, what a viewer may record,
 * staleness copy and grouping. No React, no fetch.
 *
 * Every "may" mirrors a server rule and is never looser than it: the run's
 * permission flags win, the app-role allow-list stands in only when a flag is
 * missing, and "Passed" is offered only once a Developer marked the item Done
 * (the server refuses it otherwise with QA_PROGRESS_NOT_DONE). */

import type { AppRole } from "@/shared/api/contracts";

import { VERIFICATION_TYPE_OPTIONS } from "./checklist-rules";
import type { ChecklistVerificationType } from "./checklist-types";
import { QA_ERROR_MESSAGES } from "./qa-error-messages";
import { QA_ITEM_STATUSES, QA_SEVERITIES, QA_VERDICTS, shortSha, statusShowsDefect } from "./qa-run-rules";
import type {
  QaActor,
  QaFixRequest,
  QaItemDraft,
  QaRunItemStatus,
  QaRunStatus,
  QaRunSummaryCounts,
  QaSignoff,
} from "./qa-run-types";
import {
  canReopenProjectRun,
  canSetVerification,
  normalizeRequirementItem,
  PROGRESS_VALUES,
  REQUIREMENT_KINDS,
  resolveFlag,
} from "./requirement-rules";
import type { RequirementItem, RequirementKind } from "./requirement-types";
import type {
  HeadStatus,
  MyItemsBucket,
  ProjectFeedItem,
  ProjectMyItems,
  ProjectQaRun,
  ProjectQaRunItem,
  ProjectQaRunPermissions,
  ProjectRunCurrent,
  ProjectRunGroup,
  SetVerificationInput,
  VerificationStatus,
} from "./project-run-types";
import { oneOf, record, records, text, type Loose } from "./wire-readers";

type Role = AppRole | null | undefined;

/** Every Verification a Project run accepts, in the order a tester weighs them. */
export const VERIFICATION_STATUSES: ReadonlyArray<VerificationStatus> = [
  "pending",
  "passed",
  "failed",
  "blocked",
  "returned_to_dev",
];

const RUN_STATUSES: ReadonlyArray<QaRunStatus> = ["open", "signed_off"];
const VERIFICATION_TYPES: ReadonlyArray<ChecklistVerificationType> = VERIFICATION_TYPE_OPTIONS.map(
  (option) => option.value,
);

/* ── Reading the wire ───────────────────────────────────────────────────── */

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

function signoffFrom(value: unknown): QaSignoff | null {
  const raw = record(value) ?? {};
  const signoff = {
    id: text(raw.id),
    verdict: oneOf(raw.verdict, QA_VERDICTS),
    signedBy: actorFrom(raw.signedBy),
    signedAt: text(raw.signedAt),
  };
  const { id, verdict, signedBy, signedAt } = signoff;
  if (!id || !verdict || !signedBy || !signedAt) return null;
  return { id, verdict, summary: text(raw.summary), conditions: text(raw.conditions), signedBy, signedAt };
}

function wholeOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** One repository's uat head, or null without a repository id and name. */
export function normalizeHeadStatus(value: unknown): HeadStatus | null {
  const raw = record(value);
  const projectId = text(raw?.projectId);
  const repoFullName = text(raw?.repoFullName);
  if (!projectId || !repoFullName) return null;
  const runSha = text(raw?.runSha);
  const currentSha = text(raw?.currentSha);
  return { projectId, repoFullName, runSha, currentSha, moved: headMoved(raw?.moved, runSha, currentSha) };
}

/** "Moved" is the server's word; a differing pair of heads says it too. */
function headMoved(flag: unknown, runSha: string | null, currentSha: string | null): boolean {
  if (flag === true) return true;
  return runSha !== null && currentSha !== null && runSha !== currentSha;
}

export function normalizeHeads(value: unknown): HeadStatus[] {
  return records(value)
    .map(normalizeHeadStatus)
    .filter((head): head is HeadStatus => head !== null);
}

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

function requirementOf(raw: Loose) {
  return {
    requirementId: text(raw.requirementId),
    requirementName: text(raw.requirementName) ?? "Requirement",
    requirementKind: oneOf(raw.requirementKind, REQUIREMENT_KINDS) ?? "system",
  };
}

/** One run item, or null without an id, a title and a known status. */
export function normalizeProjectRunItem(value: unknown, runId: string): ProjectQaRunItem | null {
  const raw = record(value);
  const id = text(raw?.id);
  const title = text(raw?.title);
  const status = oneOf(raw?.status, QA_ITEM_STATUSES);
  if (!raw || !id || !title || !status) return null;
  return {
    id,
    runId,
    title,
    ...itemShapeFrom(raw),
    ...requirementOf(raw),
    status,
    ...recordedFrom(raw),
    rowVersion: wholeOrNull(raw.rowVersion),
    progress: oneOf(raw.progress, PROGRESS_VALUES),
  };
}

function itemShapeFrom(raw: Loose) {
  return {
    position: typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : 0,
    acceptanceCriteria: text(raw.acceptanceCriteria),
    verificationType: oneOf(raw.verificationType, VERIFICATION_TYPES) ?? "manual",
    testIdentifier: text(raw.testIdentifier),
    sourceItemId: text(raw.sourceItemId),
    canUpdate: typeof raw.canUpdate === "boolean" ? raw.canUpdate : null,
  };
}

const DEFECT_STATUSES: ReadonlyArray<QaRunItemStatus> = ["failed", "blocked", "returned_to_dev"];

/** The run's tally, counted from its items (the server's own summary is not trusted to exist). */
export function summarizeRunItems(
  items: ReadonlyArray<Pick<ProjectQaRunItem, "status" | "defectSeverity">>,
): QaRunSummaryCounts {
  const byStatus = Object.fromEntries(QA_ITEM_STATUSES.map((status) => [status, 0])) as Record<
    QaRunItemStatus,
    number
  >;
  let openDefects = 0;
  let blockers = 0;
  for (const item of items) {
    byStatus[item.status] += 1;
    if (!DEFECT_STATUSES.includes(item.status)) continue;
    openDefects += 1;
    if (item.defectSeverity === "blocker") blockers += 1;
  }
  return { total: items.length, byStatus, openDefects, blockers };
}

function flag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function permissionFlagsFrom(value: unknown): ProjectQaRun["permissions"] {
  const raw = record(value);
  return {
    canSetVerification: flag(raw?.canSetVerification),
    canSignOff: flag(raw?.canSignOff),
    canReopen: flag(raw?.canReopen),
    canDispatch: flag(raw?.canDispatch),
  };
}

function runItemsFrom(value: unknown, runId: string): ProjectQaRunItem[] {
  return records(value)
    .map((raw) => normalizeProjectRunItem(raw, runId))
    .filter((item): item is ProjectQaRunItem => item !== null)
    .sort((a, b) => a.position - b.position);
}

function runStateFrom(raw: Loose, repositories: HeadStatus[]) {
  return {
    status: oneOf(raw.status, RUN_STATUSES) ?? "open",
    signoff: signoffFrom(raw.signoff),
    // The server sets `moved` on a repository that joined since the run, too.
    stale: raw.stale === true || repositories.some((head) => head.moved),
    requirementsChanged: raw.requirementsChanged === true,
  };
}

/** A Project run, or null when the body has no id. */
export function normalizeProjectRun(value: unknown): ProjectQaRun | null {
  const raw = record(value);
  const id = text(raw?.id);
  if (!raw || !id) return null;
  const items = runItemsFrom(raw.items, id);
  const repositories = normalizeHeads(raw.repositories);
  return {
    id,
    deliveryProjectId: text(raw.deliveryProjectId) ?? "",
    deliveryProjectName: text(raw.deliveryProjectName) ?? text(raw.checklistName) ?? "Project",
    ...runStateFrom(raw, repositories),
    createdBy: actorFrom(raw.createdBy),
    createdAt: text(raw.createdAt),
    summary: summarizeRunItems(items),
    repositories,
    items,
    permissions: permissionFlagsFrom(raw.permissions),
  };
}

/** The current-heads answer. A body that is not one reads as "no run yet, heads unknown". */
export function normalizeProjectRunCurrent(value: unknown): ProjectRunCurrent {
  const raw = record(value) ?? {};
  const run = normalizeProjectRun(raw.run);
  const heads = normalizeHeads(raw.heads);
  return {
    run,
    heads: heads.length > 0 ? heads : (run?.repositories ?? []),
    stale: raw.stale === true || run?.stale === true,
    requirementsChanged: raw.requirementsChanged === true || run?.requirementsChanged === true,
  };
}

/**
 * A run from a write's reply: the run itself, or `{ run }` around it. Null
 * when the reply carries neither — the caller then reads the run again.
 */
export function runFromReply(value: unknown): ProjectQaRun | null {
  const raw = record(value);
  if (raw && Array.isArray(raw.items)) return normalizeProjectRun(raw);
  return normalizeProjectRun(raw?.run);
}

/* ── Who may do what on a run ───────────────────────────────────────────── */

/** The run's flags, each standing in with the app-role rule only when absent. */
export function resolveProjectRunPermissions(
  run: Pick<ProjectQaRun, "permissions"> | null,
  role: Role,
): ProjectQaRunPermissions {
  const flags = run?.permissions;
  const verifier = canSetVerification(role);
  return {
    canSetVerification: resolveFlag(flags?.canSetVerification, verifier),
    canSignOff: resolveFlag(flags?.canSignOff, verifier),
    canReopen: resolveFlag(flags?.canReopen, canReopenProjectRun(role)),
    canDispatch: resolveFlag(flags?.canDispatch, verifier),
  };
}

/** Starting a Project run: QA Team, Product owner or admin. No run carries a flag yet. */
export function canStartProjectRun(role: Role): boolean {
  return canSetVerification(role);
}

/** Whether this viewer may record Verification on this item at all. */
export function canVerifyItem(
  item: Pick<ProjectQaRunItem, "rowVersion"> & Partial<Pick<ProjectQaRunItem, "canUpdate">>,
  run: Pick<ProjectQaRun, "status">,
  permissions: Pick<ProjectQaRunPermissions, "canSetVerification">,
): boolean {
  if (run.status !== "open" || !permissions.canSetVerification || item.rowVersion === null) return false;
  return item.canUpdate !== false;
}

/** Passed needs a Developer's Done first. */
export function canPass(item: Pick<ProjectQaRunItem, "progress">): boolean {
  return item.progress === "done";
}

/** Why Passed is not offered on this item, or null when it is. */
export function passedUnavailableReason(item: Pick<ProjectQaRunItem, "progress">): string | null {
  return canPass(item) ? null : QA_ERROR_MESSAGES.QA_PROGRESS_NOT_DONE;
}

/** The Verification values this viewer can move the item to. Empty when read-only. */
export function allowedVerificationStatuses(
  item: Pick<ProjectQaRunItem, "rowVersion" | "progress"> & Partial<Pick<ProjectQaRunItem, "canUpdate">>,
  run: Pick<ProjectQaRun, "status">,
  permissions: Pick<ProjectQaRunPermissions, "canSetVerification">,
): VerificationStatus[] {
  if (!canVerifyItem(item, run, permissions)) return [];
  return VERIFICATION_STATUSES.filter((status) => status !== "passed" || canPass(item));
}

export function isVerificationStatus(status: QaRunItemStatus): status is VerificationStatus {
  return status !== "in_progress";
}

/**
 * The PATCH body for a draft: the status (always sent), the row version read
 * and only the fields that changed. Null when nothing changed or the status
 * is not one a Project run accepts.
 */
export function verificationPayload(item: ProjectQaRunItem, draft: QaItemDraft): SetVerificationInput | null {
  if (item.rowVersion === null || !isVerificationStatus(draft.status)) return null;
  const body: SetVerificationInput = { status: draft.status, expectedRowVersion: item.rowVersion };
  const notes = draft.notes.trim() || null;
  if (notes !== item.notes) body.notes = notes;
  if (statusShowsDefect(draft.status)) Object.assign(body, defectChanges(item, draft));
  const changed = draft.status !== item.status || Object.keys(body).length > 2;
  return changed ? body : null;
}

/** Severity and reproduction steps, only where they differ from what is recorded. */
function defectChanges(item: ProjectQaRunItem, draft: QaItemDraft): Partial<SetVerificationInput> {
  const changes: Partial<SetVerificationInput> = {};
  const severity = draft.defectSeverity || null;
  const steps = draft.reproductionSteps.trim() || null;
  if (severity !== item.defectSeverity) changes.defectSeverity = severity;
  if (steps !== item.reproductionSteps) changes.reproductionSteps = steps;
  return changes;
}

/* ── What the run panel says ────────────────────────────────────────────── */

/** "Org/orders-api" -> "orders-api". */
export function repoShortName(repoFullName: string): string {
  const slash = repoFullName.lastIndexOf("/");
  return slash >= 0 ? repoFullName.slice(slash + 1) : repoFullName;
}

/** "orders-api @ 9f8e7d6", or the name alone when the head is unknown. */
export function headLabel(name: string, sha: string | null): string {
  const short = shortSha(sha);
  return short ? `${repoShortName(name)} @ ${short}` : repoShortName(name);
}

/** What changed for one repository since the run, or null when nothing did. */
export function headChangeMessage(head: HeadStatus): string | null {
  const name = repoShortName(head.repoFullName);
  // No captured head: the repository joined since (the server says moved), or nothing is compared.
  if (head.runSha === null) return head.moved ? `${name} joined the Project since this run` : null;
  if (head.currentSha === null) return `Could not read the uat head of ${name}`;
  if (!head.moved) return null;
  return `${name} moved since this run (${shortSha(head.runSha)} → ${shortSha(head.currentSha)})`;
}

/** Every repository that changed, in the server's order. */
export function headChangeMessages(heads: ReadonlyArray<HeadStatus>): string[] {
  return heads.map(headChangeMessage).filter((message): message is string => message !== null);
}

export function requirementsChangedLabel(run: Pick<ProjectQaRun, "status">): string {
  return run.status === "signed_off"
    ? "Requirements changed since sign-off"
    : "Requirements changed since this run started";
}

export const REQUIREMENTS_CHANGED_NOTE =
  "This does not change what can merge. A Product owner can reopen the run so QA verifies the change.";

export const STALE_RUN_NOTE =
  "The run no longer covers what is on uat. Start a new run so QA verifies the current heads; its results carry over as history.";

/** "2 repositories" / "1 repository". */
export function repositoriesLabel(count: number): string {
  return `${count} ${count === 1 ? "repository" : "repositories"}`;
}

const KIND_ORDER: Record<RequirementKind, number> = { functional: 0, system: 1 };

/** Run items grouped by requirement: Features first, then System requirements, in run order. */
export function groupRunItems(items: ReadonlyArray<ProjectQaRunItem>): ProjectRunGroup[] {
  const groups = new Map<string, ProjectRunGroup & { first: number }>();
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const key = item.requirementId ?? `${item.requirementKind}:${item.requirementName}`;
    const group = groups.get(key) ?? {
      key,
      requirementName: item.requirementName,
      kind: item.requirementKind,
      items: [],
      first: item.position,
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.first - b.first)
    .map((group) => ({
      key: group.key,
      requirementName: group.requirementName,
      kind: group.kind,
      items: group.items,
    }));
}

/* ── The run list: filters and groups ───────────────────────────────────── */

/** What the run list shows: every item, or the items in one Verification. */
export type RunFilter = "all" | VerificationStatus;

/** Filter order: what still needs QA first, Passed last. */
export const RUN_FILTERS: ReadonlyArray<RunFilter> = [
  "all",
  "pending",
  "failed",
  "returned_to_dev",
  "blocked",
  "passed",
];

const RUN_FILTER_LABELS: Record<RunFilter, string> = {
  all: "All",
  pending: "To verify",
  failed: "Failed",
  returned_to_dev: "Returned",
  blocked: "Blocked",
  passed: "Passed",
};

export function runFilterLabel(filter: RunFilter): string {
  return RUN_FILTER_LABELS[filter];
}

const RUN_FILTER_EMPTY: Record<RunFilter, string> = {
  all: "This run has no items.",
  pending: "Nothing left to verify.",
  failed: "No item has failed.",
  returned_to_dev: "Nothing is returned to dev.",
  blocked: "Nothing is blocked.",
  passed: "No item has passed yet.",
};

/** What an empty filter says instead of an empty list. */
export function runFilterEmptyText(filter: RunFilter): string {
  return RUN_FILTER_EMPTY[filter];
}

/** The Verification an item counts under; a stray `in_progress` reads as still to verify. */
function filterStatus(item: Pick<ProjectQaRunItem, "status">): VerificationStatus {
  return item.status === "in_progress" ? "pending" : item.status;
}

export function itemMatchesRunFilter(item: Pick<ProjectQaRunItem, "status">, filter: RunFilter): boolean {
  return filter === "all" || filterStatus(item) === filter;
}

export function runFilterCounts(items: ReadonlyArray<Pick<ProjectQaRunItem, "status">>): Record<RunFilter, number> {
  const counts = Object.fromEntries(RUN_FILTERS.map((filter) => [filter, 0])) as Record<RunFilter, number>;
  for (const item of items) {
    counts.all += 1;
    counts[filterStatus(item)] += 1;
  }
  return counts;
}

/**
 * The filters worth offering: All, every Verification some item is in, and
 * the one chosen even once it empties — passing the last item still to
 * verify leaves "To verify" chosen and empty, not a jump back to All.
 */
export function visibleRunFilters(counts: Record<RunFilter, number>, active: RunFilter): RunFilter[] {
  return RUN_FILTERS.filter((filter) => filter === "all" || filter === active || counts[filter] > 0);
}

/** Where each group's numbering starts, so items count 01, 02… across the whole run. */
export function groupOffsets(groups: ReadonlyArray<Pick<ProjectRunGroup, "items">>): number[] {
  return groups.map((_, index) => groups.slice(0, index).reduce((sum, group) => sum + group.items.length, 0));
}

/** "2 of 3 passed": how far QA is through one requirement. */
export function groupPassLabel(group: Pick<ProjectRunGroup, "items">): string {
  const passed = group.items.filter((item) => item.status === "passed").length;
  return `${String(passed)} of ${String(group.items.length)} passed`;
}

/**
 * Which requirements open expanded: every one with something left for QA.
 * A requirement whose items all passed starts collapsed, so the list opens on
 * the work. Read once per run: an item passed while the list is on screen
 * never folds its group away under the tester's pointer.
 */
export function initialExpandedGroups(groups: ReadonlyArray<ProjectRunGroup>): Record<string, boolean> {
  return Object.fromEntries(
    groups.map((group) => [group.key, group.items.length === 0 || group.items.some((item) => item.status !== "passed")]),
  );
}

/** Replace one run item (after a write that returned no run), recounting the summary. */
export function replaceRunItem(run: ProjectQaRun, item: ProjectQaRunItem): ProjectQaRun {
  const items = run.items.map((entry) => (entry.id === item.id ? item : entry));
  return { ...run, items, summary: summarizeRunItems(items) };
}

/* ── My QA items (project-wide) ─────────────────────────────────────────── */

export const MY_ITEMS_BUCKETS: ReadonlyArray<MyItemsBucket> = ["returned", "inProgress", "todo", "readyForQa"];

export interface BucketCopy {
  title: string;
  lede: string;
}

const BUCKET_COPY: Record<MyItemsBucket, BucketCopy> = {
  returned: {
    title: "Returned by QA",
    lede: "QA sent these back. Fix them, then mark them Done so QA verifies them again.",
  },
  inProgress: { title: "In progress", lede: "Being built now. Mark Done when it is ready for QA." },
  todo: { title: "To do", lede: "Not started yet." },
  readyForQa: { title: "Ready for QA", lede: "Done by a Developer and waiting for QA to verify on the Project run." },
};

export function bucketCopy(bucket: MyItemsBucket): BucketCopy {
  return BUCKET_COPY[bucket];
}

function feedRequirementFrom(value: unknown): ProjectFeedItem["requirement"] | null {
  const raw = record(value);
  const id = text(raw?.id);
  if (!id) return null;
  return {
    id,
    name: text(raw?.name) ?? "Requirement",
    kind: oneOf(raw?.kind, REQUIREMENT_KINDS) ?? "system",
  };
}

function feedItemFrom(value: unknown): ProjectFeedItem | null {
  const raw = record(value);
  const requirement = feedRequirementFrom(raw?.requirement);
  if (!raw || !requirement) return null;
  const item = normalizeRequirementItem(raw.item, requirement.id);
  if (!item) return null;
  const runId = text(raw.runId);
  return { requirement, item, runId, runItem: runId ? normalizeProjectRunItem(raw.runItem, runId) : null };
}

function feedFrom(value: unknown): ProjectFeedItem[] {
  return records(value)
    .map(feedItemFrom)
    .filter((entry): entry is ProjectFeedItem => entry !== null);
}

/** The four buckets. An absent bucket is empty; a broken row is dropped. */
export function normalizeProjectMyItems(value: unknown): ProjectMyItems {
  const raw = record(value) ?? {};
  return {
    returned: feedFrom(raw.returned),
    inProgress: feedFrom(raw.inProgress),
    todo: feedFrom(raw.todo),
    readyForQa: feedFrom(raw.readyForQa),
  };
}

export function projectMyItemsCount(data: ProjectMyItems): number {
  return MY_ITEMS_BUCKETS.reduce((sum, bucket) => sum + data[bucket].length, 0);
}

export function feedItemKey(entry: Pick<ProjectFeedItem, "requirement" | "item">): string {
  return `${entry.requirement.id}:${entry.item.id}`;
}

/** Fold a saved item (after a Progress write) into whichever bucket holds it. */
export function applyItemToMyItems(data: ProjectMyItems, saved: RequirementItem): ProjectMyItems {
  const patch = (entries: ProjectFeedItem[]) =>
    entries.map((entry) =>
      entry.item.id === saved.id && entry.requirement.id === saved.requirementId ? { ...entry, item: saved } : entry,
    );
  return {
    returned: patch(data.returned),
    inProgress: patch(data.inProgress),
    todo: patch(data.todo),
    readyForQa: patch(data.readyForQa),
  };
}

export const EMPTY_PROJECT_MY_ITEMS: ProjectMyItems = { returned: [], inProgress: [], todo: [], readyForQa: [] };
