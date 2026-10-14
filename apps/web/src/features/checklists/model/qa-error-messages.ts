/* The sentences for the error codes Project requirements and Project QA runs
 * add. Pure: no React, no fetch.
 *
 * A code the backend sends is mapped to a product sentence here rather than
 * shown as the server's own message, so every screen says the same thing in
 * the product's words ("Product owner", "Developer", "QA Team", "Project",
 * "repository"). An unknown code is not mapped: the caller falls back to its
 * own copy. */

import { errorCode, errorDetails, errorStatus, texts } from "./wire-readers";

export const QA_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  QA_NO_REQUIREMENTS:
    "This Project has no requirements yet. A Product owner adds a Feature or a System requirement before QA can start a run.",
  QA_UAT_HEAD_UNREADABLE:
    "ALPHACI could not read the uat branch of every repository in this Project, so the run was not started.",
  QA_UAT_BRANCH_MISSING:
    "A repository in this Project has no uat branch yet. Deploy it to uat, then start the run.",
  QA_NO_REPOSITORIES:
    "This Project has no repositories linked to ALPHACI yet. A Developer adds one before QA can start a run.",
  QA_RUN_LEGACY_READONLY:
    "This is an earlier per-repository QA run. It is kept as read-only history: QA now verifies the whole Project.",
  REQUIREMENT_MOVED_TO_PROJECT:
    "This checklist now belongs to a Project. Edit it from that Project's System requirements.",
  QA_PROJECT_REQUIRED:
    "This repository is not filed under a Project, and QA requirements belong to Projects. A Product owner moves it into a Project first.",
  QA_PROGRESS_NOT_DONE: "A Developer marks this Done before QA can pass it.",
  QA_VERIFICATION_STATUS_INVALID:
    "That verification status is not available. Choose Pending, Passed, Failed, Blocked or Returned to dev.",
  VERIFICATION_FORBIDDEN: "Only the QA Team, Product owners and admins set Verification.",
  PROGRESS_FORBIDDEN:
    "Developers, Product owners and admins update Progress. The QA Team records Verification instead.",
  REQUIREMENT_MANAGE_FORBIDDEN: "Only Product owners and admins create or edit requirements.",
  REQUIREMENT_NAME_TAKEN: "This Project already has a requirement with that name. Pick another name.",
  REQUIREMENT_BATCH_DUPLICATE_NAME:
    "Two requirements in this dialog have the same name. Rename one, then create them again.",
  REQUIREMENT_BATCH_INVALID:
    "These requirements could not be created as written. Check each name and story, then try again.",
  REQUIREMENT_STALE:
    "Someone else changed this requirement since you loaded it. Reload to see their change, then try again.",
  REQUIREMENT_ITEM_STALE:
    "Someone else changed this item since you loaded it. Reload to see their change, then try again.",
  REQUIREMENT_ARCHIVED: "This requirement is archived, so it can no longer change.",
  REQUIREMENT_KIND_INVALID: "A requirement is either a Feature or a System requirement.",
  REQUIREMENT_ORDER_MISMATCH:
    "The list changed while you were reordering it. Reload, then move the item again.",
};

/**
 * The evidence (screenshot) codes. Kept apart from the map above because
 * QA_RUN_SIGNED_OFF means something narrower here: elsewhere a signed-off run
 * refuses a Verification write with the server's own sentence, and that copy
 * must not change.
 */
export const QA_ATTACHMENT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  QA_RUN_SIGNED_OFF:
    "This run is signed off, so its screenshots are frozen. A Product owner reopens the run before evidence can change.",
  QA_ATTACHMENT_LIMIT: "This item already has 5 screenshots, the most it can hold. Delete one to add another.",
  QA_ATTACHMENT_TOO_LARGE: "This image is too large. A screenshot can be up to 3 MB and 8000 × 8000 pixels.",
  QA_ATTACHMENT_TYPE: "Only PNG, JPEG and WebP images can be attached.",
  QA_ATTACHMENT_FORBIDDEN:
    "You cannot change this item's evidence. The QA Team, Product owners and admins add screenshots; the uploader, a Product owner or an admin removes one.",
  QA_ATTACHMENTS_UNAVAILABLE:
    "Screenshots are not available on this server right now. Try again later, or ask an admin to check attachment storage.",
  QA_FIX_PROOF_NOT_REQUESTED:
    "Proof of a fix can be attached only while QA has returned this item, or after it is marked Done for re-test.",
};

/**
 * Where a Developer's proof of a fix needs other words than QA's evidence:
 * who may add it, and that its limit is its own five.
 */
export const FIX_PROOF_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  QA_ATTACHMENT_FORBIDDEN:
    "You cannot change this item's proof of the fix. Developers, Product owners and admins attach it; the uploader, a Product owner or an admin removes it.",
  QA_ATTACHMENT_LIMIT: "This item already has 5 screenshots of the fix, the most it can hold. Delete one to add another.",
};

/**
 * The product sentence for an evidence failure, or null when its code is not
 * an evidence code. A bare 413 (a proxy refusing the body before the server
 * saw it) reads as "too large" too. `fixProof` picks the Developer's wording
 * where it differs.
 */
export function attachmentCodeMessage(cause: unknown, fixProof = false): string | null {
  const code = errorCode(cause);
  const message = (fixProof ? FIX_PROOF_ERROR_MESSAGES[code] : undefined) ?? QA_ATTACHMENT_ERROR_MESSAGES[code];
  if (message) return message;
  return errorStatus(cause) === 413 ? QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_TOO_LARGE : null;
}

/** Codes a reload resolves: someone else wrote first. */
const STALE_CODES: ReadonlySet<string> = new Set([
  "REQUIREMENT_STALE",
  "REQUIREMENT_ITEM_STALE",
  "REQUIREMENT_ORDER_MISMATCH",
  "QA_ITEM_STALE",
  "QA_RUN_CHANGED",
]);

/** True when the failure carries a code a reload fixes. */
export function isStaleCode(cause: unknown): boolean {
  return STALE_CODES.has(errorCode(cause));
}

/**
 * The product sentence for the failure's code, or null when the code is not
 * one of ours. QA_UAT_HEAD_UNREADABLE names the repositories it could not
 * read, from the server's `reasons`.
 */
export function qaCodeMessage(cause: unknown): string | null {
  const code = errorCode(cause);
  const message = QA_ERROR_MESSAGES[code];
  if (!message) return null;
  if (code === "QA_UAT_HEAD_UNREADABLE") {
    const reasons = texts(errorDetails(cause)?.reasons);
    if (reasons.length > 0) return `${message} ${reasons.join(" ")}`;
  }
  return message;
}
