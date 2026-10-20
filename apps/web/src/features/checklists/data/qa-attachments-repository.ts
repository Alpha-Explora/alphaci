import { request } from "@/shared/api/request";

import { normalizeAttachment, normalizeAttachmentList } from "../model/qa-attachment-rules";
import type { EvidenceUploadInput, QaAttachment } from "../model/qa-attachment-types";

/* The only place in the checklists domain that talks to the QA evidence
 * endpoints (QA_ATTACHMENTS_PLAN.md §5 A1, A2). Images live in a private bucket;
 * every read returns five-minute signed URLs, so a list is read again rather
 * than cached once one expires. Replies are normalised here.
 *
 * Its own module (not part of projectQaRunsRepository) so the run panel's
 * existing tests, which mock that repository whole, keep their shape. */

const enc = encodeURIComponent;

function runPath(deliveryProjectId: string, runId: string): string {
  return `/delivery-projects/${enc(deliveryProjectId)}/qa-runs/${enc(runId)}`;
}

function itemAttachmentsPath(deliveryProjectId: string, runId: string, itemId: string): string {
  return `${runPath(deliveryProjectId, runId)}/items/${enc(itemId)}/attachments`;
}

/**
 * The multipart body. The browser sets Content-Type (with its boundary) for
 * a FormData body, so none is set here; the shared transport leaves it alone.
 */
export function evidenceFormData(input: EvidenceUploadInput): FormData {
  const form = new FormData();
  form.append("file", input.file, input.fileName);
  if (input.caption) form.append("caption", input.caption);
  form.append("source", input.source);
  form.append("kind", input.kind ?? "evidence");
  return form;
}

export const qaAttachmentsRepository = {
  /** One item's screenshots, oldest first. */
  async listForItem(deliveryProjectId: string, runId: string, itemId: string): Promise<QaAttachment[]> {
    return normalizeAttachmentList(await request<unknown>(itemAttachmentsPath(deliveryProjectId, runId, itemId)));
  },

  /** Every screenshot in the run, for the Evidence sections and the report. */
  async listForRun(deliveryProjectId: string, runId: string): Promise<QaAttachment[]> {
    return normalizeAttachmentList(await request<unknown>(`${runPath(deliveryProjectId, runId)}/attachments`));
  },

  /** Attach one image: QA evidence, or (`kind: "fix_proof"`) a Developer's proof of a fix. 201 replies with the attachment. */
  async upload(deliveryProjectId: string, runId: string, itemId: string, input: EvidenceUploadInput): Promise<QaAttachment> {
    const raw = await request<unknown>(itemAttachmentsPath(deliveryProjectId, runId, itemId), {
      method: "POST",
      body: evidenceFormData(input),
    });
    const attachment = normalizeAttachment(raw);
    if (!attachment) throw new Error("The server did not return the screenshot.");
    return attachment;
  },

  /** Remove one screenshot. 204. */
  async remove(deliveryProjectId: string, runId: string, attachmentId: string): Promise<void> {
    await request<unknown>(`${runPath(deliveryProjectId, runId)}/attachments/${enc(attachmentId)}`, {
      method: "DELETE",
    });
  },
};
