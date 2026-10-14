import { normalizeAttachment } from "../../../../src/features/checklists/model/qa-attachment-rules";
import type { QaAttachment } from "../../../../src/features/checklists/model/qa-attachment-types";

/** One attachment as GET .../attachments sends it. */
export function attachmentWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "att-1",
    runId: "prun-1",
    runItemId: "run-item-1",
    kind: "evidence",
    contentType: "image/webp",
    byteSize: 182_000,
    width: 1280,
    height: 800,
    caption: "Pay button missing on the summary step",
    source: "capture",
    testTitle: null,
    createdByLogin: "ana-qa",
    createdAt: "2026-10-14T09:00:00.000Z",
    url: "https://storage.example.test/qa-attachments/prun-1/run-item-1/att-1.webp?token=abc",
    urlExpiresAt: "2099-01-01T00:00:00.000Z",
    canDelete: true,
    ...overrides,
  };
}

export function attachment(overrides: Record<string, unknown> = {}): QaAttachment {
  const value = normalizeAttachment(attachmentWire(overrides));
  if (!value) throw new Error("fixture did not normalise");
  return value;
}
