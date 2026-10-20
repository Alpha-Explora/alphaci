/* QA evidence attachment rules: reading the wire, who may add what, and what
 * the Evidence section says. Pure: no React, no fetch.
 *
 * Every "may" mirrors a server rule and is never looser than it. The run's
 * `attachments` answer decides whether the feature exists at all: a backend
 * without it (or without storage configured) hides everything here, and the
 * rest of the run behaves exactly as before. */

import { attachmentCodeMessage } from "./qa-error-messages";
import { qaActionError } from "./qa-run-rules";
import type { QaRunStatus } from "./qa-run-types";
import type {
  QaAttachment,
  QaAttachmentGroup,
  QaAttachmentKind,
  QaAttachmentRef,
  QaAttachmentSource,
  QaImageType,
  QaRunAttachmentSettings,
} from "./qa-attachment-types";
import { oneOf, record, records, text } from "./wire-readers";

/**
 * The most human attachments one item holds of each kind (5 QA evidence plus
 * 5 fix proof); the server refuses the sixth.
 */
export const MAX_EVIDENCE_PER_ITEM = 5;

/** The longest caption the server accepts. */
export const MAX_CAPTION_LENGTH = 280;

export const QA_IMAGE_TYPES: ReadonlyArray<QaImageType> = ["image/png", "image/jpeg", "image/webp"];
const KINDS: ReadonlyArray<QaAttachmentKind> = ["evidence", "fix_proof", "automated"];
const SOURCES: ReadonlyArray<QaAttachmentSource> = ["capture", "paste", "upload", "playwright"];

/** A signed URL is refetched this long before it says it expires. */
const EXPIRY_MARGIN_MS = 15_000;

/* ── Reading the wire ───────────────────────────────────────────────────── */

function wholeOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * An image URL the page may load: any https URL, or http on this machine (a
 * local Supabase). Anything else (javascript:, data:, a plain-http host) is
 * dropped, so a bad payload can never become a script or a mixed-content leak.
 */
export function imageUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:") return url.toString();
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** One attachment, or null without an id and the item it belongs to. */
export function normalizeAttachment(value: unknown): QaAttachment | null {
  const raw = record(value);
  const id = text(raw?.id);
  const runItemId = text(raw?.runItemId);
  if (!raw || !id || !runItemId) return null;
  return {
    id,
    runId: text(raw.runId) ?? "",
    runItemId,
    kind: oneOf(raw.kind, KINDS) ?? "evidence",
    contentType: oneOf(raw.contentType, QA_IMAGE_TYPES),
    byteSize: wholeOrNull(raw.byteSize),
    width: wholeOrNull(raw.width),
    height: wholeOrNull(raw.height),
    caption: text(raw.caption),
    source: oneOf(raw.source, SOURCES),
    testTitle: text(raw.testTitle),
    createdByLogin: text(raw.createdByLogin),
    createdAt: text(raw.createdAt),
    url: imageUrl(raw.url),
    urlExpiresAt: text(raw.urlExpiresAt),
    canDelete: raw.canDelete === true,
  };
}

/** `{ items: Attachment[] }` (or a bare array), oldest first; broken rows are dropped. */
export function normalizeAttachmentList(value: unknown): QaAttachment[] {
  const list = Array.isArray(value) ? value : record(value)?.items;
  return records(list)
    .map(normalizeAttachment)
    .filter((attachment): attachment is QaAttachment => attachment !== null)
    .sort(byCreatedAt);
}

function byCreatedAt(a: Pick<QaAttachment, "createdAt">, b: Pick<QaAttachment, "createdAt">): number {
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

/** The run's `attachments` answer; null (feature hidden) when the server sent none. */
export function attachmentSettingsFrom(value: unknown): QaRunAttachmentSettings | null {
  const raw = record(value);
  if (!raw || typeof raw.enabled !== "boolean") return null;
  return { enabled: raw.enabled, canAdd: raw.canAdd === true, canAddFixProof: raw.canAddFixProof === true };
}

/** An item's `attachmentCount`; null when the server sent none. */
export function attachmentCountFrom(value: unknown): number | null {
  return wholeOrNull(value);
}

/** The report's per-item `attachments` (ids and captions, no URLs). */
export function attachmentRefsFrom(value: unknown): QaAttachmentRef[] {
  return records(value).flatMap((raw) => {
    const id = text(raw.id);
    if (!id) return [];
    return [
      {
        id,
        caption: text(raw.caption),
        kind: oneOf(raw.kind, KINDS) ?? "evidence",
        contentType: oneOf(raw.contentType, QA_IMAGE_TYPES),
      },
    ];
  });
}

/* ── Who may do what ────────────────────────────────────────────────────── */

type RunAttachmentState = { status: QaRunStatus; attachments: QaRunAttachmentSettings | null };

/** The Evidence section exists: the server answered and storage is configured. */
export function showsEvidence(run: Pick<RunAttachmentState, "attachments">): boolean {
  return run.attachments?.enabled === true;
}

/** Capture, Paste and Upload are offered: storage is on, the server says this viewer may, and the run is open. */
export function canAddEvidence(run: RunAttachmentState): boolean {
  return showsEvidence(run) && run.attachments?.canAdd === true && run.status === "open";
}

/** Delete is offered only where the server allows it, and never on a signed-off run. */
export function canDeleteEvidence(attachment: Pick<QaAttachment, "canDelete">, run: Pick<RunAttachmentState, "status">): boolean {
  return attachment.canDelete && run.status === "open";
}

/**
 * The Developer's "Proof of the fix" shows on a My QA items entry: the server
 * says proof may be attached now, or the item already holds some. An older
 * backend sends neither, and nothing shows.
 */
export function showsFixProof(
  runItem: { canAttachFixProof: boolean; fixProofCount: number | null } | null,
): boolean {
  if (!runItem) return false;
  return runItem.canAttachFixProof || (runItem.fixProofCount ?? 0) > 0;
}

/** True once the item holds as many screenshots (of one kind) as it can. */
export function evidenceAtLimit(count: number): boolean {
  return count >= MAX_EVIDENCE_PER_ITEM;
}

/* ── What the Evidence section says ─────────────────────────────────────── */

/** The run's attachments, by item, oldest first. */
export function attachmentsByItem(list: ReadonlyArray<QaAttachment>): Record<string, QaAttachment[]> {
  const byItem: Record<string, QaAttachment[]> = {};
  for (const attachment of [...list].sort(byCreatedAt)) {
    const entries = byItem[attachment.runItemId] ?? [];
    entries.push(attachment);
    byItem[attachment.runItemId] = entries;
  }
  return byItem;
}

/** The group an image sits in: a Developer's proof of a fix, else QA evidence (CI's images included). */
export function attachmentGroup(kind: QaAttachmentKind): QaAttachmentGroup {
  return kind === "fix_proof" ? "fix_proof" : "evidence";
}

/** One group's images, in the order given. */
export function attachmentsInGroup(list: ReadonlyArray<QaAttachment>, group: QaAttachmentGroup): QaAttachment[] {
  return list.filter((attachment) => attachmentGroup(attachment.kind) === group);
}

const KIND_LABELS: Readonly<Record<QaAttachmentKind, string>> = {
  evidence: "QA evidence",
  fix_proof: "Fix proof",
  automated: "Playwright",
};

/** "QA evidence", "Fix proof" or "Playwright": which kind an image is, in the lightbox and the report. */
export function attachmentKindLabel(kind: QaAttachmentKind): string {
  return KIND_LABELS[kind];
}

/** The QA evidence count the run payload implies: every image less the fix proofs; null when not said. */
export function evidenceCountFromRun(item: { attachmentCount: number | null; fixProofCount: number | null }): number | null {
  if (item.attachmentCount === null) return null;
  return Math.max(0, item.attachmentCount - (item.fixProofCount ?? 0));
}

/** What the badge counts: the loaded list once there is one, else the run's own count. */
export function evidenceCount(loaded: ReadonlyArray<QaAttachment> | undefined, fromRun: number | null): number {
  return loaded ? loaded.length : (fromRun ?? 0);
}

/** "1 screenshot" / "3 screenshots". */
export function evidenceCountLabel(count: number): string {
  return `${count} ${count === 1 ? "screenshot" : "screenshots"}`;
}

/** The image's alt text: its caption, else "Screenshot 2 of <item title>". */
export function evidenceAlt(attachment: Pick<QaAttachment, "caption">, index: number, itemTitle: string): string {
  return attachment.caption ?? `Screenshot ${String(index + 1)} of ${itemTitle}`;
}

/** True when the signed URL is missing or about to stop working, so the list is read again. */
export function urlExpired(attachment: Pick<QaAttachment, "url" | "urlExpiresAt">, now: number = Date.now()): boolean {
  if (!attachment.url) return true;
  const expires = attachment.urlExpiresAt ? Date.parse(attachment.urlExpiresAt) : Number.NaN;
  return !Number.isNaN(expires) && expires - EXPIRY_MARGIN_MS <= now;
}

/** True when any loaded URL has expired (or is about to). */
export function anyUrlExpired(list: ReadonlyArray<QaAttachment>, now: number = Date.now()): boolean {
  return list.some((attachment) => urlExpired(attachment, now));
}

/** Why the caption cannot be saved, or null when it can. */
export function captionError(caption: string): string | null {
  return caption.trim().length > MAX_CAPTION_LENGTH
    ? `A caption can be up to ${String(MAX_CAPTION_LENGTH)} characters.`
    : null;
}

/** The caption to send: trimmed, null when empty. */
export function captionPayload(caption: string): string | null {
  return caption.trim() || null;
}

/** The next image in the lightbox, wrapping at both ends. */
export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

/** The lightbox's "2 of 5". */
export function positionLabel(index: number, length: number): string {
  return `${String(index + 1)} of ${String(length)}`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * Any failed evidence write or read, as a sentence: an evidence code first
 * (in the Developer's words for a fix proof), then the QA run rules.
 */
export function attachmentErrorMessage(cause: unknown, fallback: string, group: QaAttachmentGroup = "evidence"): string {
  return attachmentCodeMessage(cause, group === "fix_proof") ?? qaActionError(cause, fallback).message;
}

export const CAPTURE_FAILED = "The screen could not be captured. Paste or upload a screenshot instead.";

/**
 * Why a capture failed, or null when the tester simply cancelled the
 * browser's prompt (nothing to say: they chose not to share).
 */
export function captureErrorMessage(cause: unknown): string | null {
  const name = record(cause)?.name;
  if (name === "NotAllowedError" || name === "AbortError") return null;
  return attachmentCodeMessage(cause) ?? CAPTURE_FAILED;
}

/** Which images a report item shows: its frozen refs, matched to the run's signed URLs. */
export function reportEvidence(
  refs: ReadonlyArray<QaAttachmentRef>,
  loaded: ReadonlyArray<QaAttachment>,
): Array<{ ref: QaAttachmentRef; attachment: QaAttachment | null }> {
  const byId = new Map(loaded.map((attachment) => [attachment.id, attachment]));
  return refs.map((ref) => ({ ref, attachment: byId.get(ref.id) ?? null }));
}

/** True when any item of the report carries an image. */
export function reportHasEvidence(items: ReadonlyArray<{ attachments: ReadonlyArray<QaAttachmentRef> }>): boolean {
  return items.some((item) => item.attachments.length > 0);
}
