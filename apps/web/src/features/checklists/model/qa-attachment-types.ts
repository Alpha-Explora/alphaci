/* QA evidence attachments — screenshots a tester attaches to a Project run
 * item. Pure: no React, no fetch.
 *
 * The backend stores each image in a private bucket and hands out a signed
 * URL that lives five minutes, after its own role check. The client only ever
 * reads these shapes; the `…Wire` names mirror QA_ATTACHMENTS_PLAN.md §5 A1. */

/** Why the image is there: QA's evidence, a Developer's proof of a fix, or CI's screenshot. */
export type QaAttachmentKind = "evidence" | "fix_proof" | "automated";

/** What a person adds: QA's evidence, or a Developer's proof of a fix. */
export type QaHumanAttachmentKind = Exclude<QaAttachmentKind, "automated">;

/**
 * Which of an item's two groups an image sits in. QA's evidence and CI's
 * screenshots read together as "QA evidence"; a Developer's images as "Fix proof".
 */
export type QaAttachmentGroup = QaHumanAttachmentKind;

/** How a person added it (or `playwright` for CI). */
export type QaAttachmentSource = "capture" | "paste" | "upload" | "playwright";

/** The image types the server accepts, read from the file's own bytes. */
export type QaImageType = "image/png" | "image/jpeg" | "image/webp";

export interface QaAttachment {
  id: string;
  runId: string;
  runItemId: string;
  kind: QaAttachmentKind;
  /** Null when the server named a type this client does not know. */
  contentType: QaImageType | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  source: QaAttachmentSource | null;
  /** For an automated image: the Playwright test it came from. */
  testTitle: string | null;
  createdByLogin: string | null;
  createdAt: string | null;
  /** A short-lived signed URL. Null when the server sent none (or not an http(s) one). */
  url: string | null;
  /** When `url` stops working; null when not said. */
  urlExpiresAt: string | null;
  /** The server's answer: this viewer may delete it. Never guessed. */
  canDelete: boolean;
}

/** What the report's frozen JSON says about an item's images: no URLs. */
export interface QaAttachmentRef {
  id: string;
  caption: string | null;
  kind: QaAttachmentKind;
  contentType: QaImageType | null;
}

/**
 * The run's answer about attachments. Absent on a backend without them, and
 * then the whole feature stays hidden.
 */
export interface QaRunAttachmentSettings {
  /** The bucket and service key are configured. */
  enabled: boolean;
  /** This viewer may add evidence to this run (role and run state). */
  canAdd: boolean;
  /**
   * This viewer may add proof of a fix on this run (a Developer, Product
   * owner or admin, run open). False when the server did not say.
   */
  canAddFixProof: boolean;
}

/** What one upload sends. `file` is the compressed image. */
export interface EvidenceUploadInput {
  file: Blob;
  fileName: string;
  caption: string | null;
  source: Exclude<QaAttachmentSource, "playwright">;
  /** Sent as the multipart `kind`; QA evidence when not said. */
  kind?: QaHumanAttachmentKind;
}

/** An image ready to save: compressed, measured, previewable. */
export interface EvidenceImage {
  blob: Blob;
  type: QaImageType;
  width: number;
  height: number;
}
