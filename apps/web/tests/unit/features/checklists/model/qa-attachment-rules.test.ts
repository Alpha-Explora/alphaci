import { normalizeProjectReport } from "../../../../../src/features/checklists/model/project-report-rules";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import {
  anyUrlExpired,
  attachmentCountFrom,
  attachmentErrorMessage,
  attachmentRefsFrom,
  attachmentsByItem,
  attachmentSettingsFrom,
  canAddEvidence,
  canDeleteEvidence,
  CAPTURE_FAILED,
  captionError,
  captionPayload,
  captureErrorMessage,
  evidenceAlt,
  evidenceAtLimit,
  evidenceCount,
  evidenceCountLabel,
  imageUrl,
  MAX_CAPTION_LENGTH,
  normalizeAttachment,
  normalizeAttachmentList,
  positionLabel,
  reportEvidence,
  reportHasEvidence,
  showsEvidence,
  stepIndex,
  urlExpired,
} from "../../../../../src/features/checklists/model/qa-attachment-rules";
import {
  attachmentCodeMessage,
  QA_ATTACHMENT_ERROR_MESSAGES,
  qaCodeMessage,
} from "../../../../../src/features/checklists/model/qa-error-messages";
import { attachment, attachmentWire } from "../attachment-fixtures";
import { apiError } from "../checklist-fixtures";
import { projectReportWire } from "../project-report-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

function coded(status: number, code: string) {
  return Object.assign(apiError(status), { details: { code, message: "server words" } });
}

describe("reading attachments from the wire", () => {
  it("reads every field of an attachment", () => {
    expect(normalizeAttachment(attachmentWire())).toEqual({
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
    });
  });

  it("drops a row without an id or item, and reads unknown values as not known", () => {
    expect(normalizeAttachment(attachmentWire({ id: "" }))).toBeNull();
    expect(normalizeAttachment(attachmentWire({ runItemId: null }))).toBeNull();
    expect(normalizeAttachment("nope")).toBeNull();
    const odd = normalizeAttachment(
      attachmentWire({ kind: "bogus", contentType: "image/gif", source: 7, width: -1, byteSize: 1.5, canDelete: "yes" }),
    );
    expect(odd).toMatchObject({ kind: "evidence", contentType: null, source: null, width: null, byteSize: null, canDelete: false });
  });

  it("loads only https URLs, or http on this machine", () => {
    expect(imageUrl("https://cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(imageUrl("http://127.0.0.1:54321/storage/a.png")).toBe("http://127.0.0.1:54321/storage/a.png");
    expect(imageUrl("http://localhost/a.png")).toBe("http://localhost/a.png");
    expect(imageUrl("http://evil.test/a.png")).toBeNull();
    expect(imageUrl("javascript:alert(1)")).toBeNull();
    expect(imageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(imageUrl("not a url")).toBeNull();
    expect(imageUrl(null)).toBeNull();
    expect(normalizeAttachment(attachmentWire({ url: "javascript:alert(1)" }))?.url).toBeNull();
  });

  it("reads a list as { items } or a bare array, oldest first", () => {
    const list = normalizeAttachmentList({
      items: [
        attachmentWire({ id: "b", createdAt: "2026-10-14T10:00:00.000Z" }),
        { broken: true },
        attachmentWire({ id: "a", createdAt: "2026-10-14T09:00:00.000Z" }),
      ],
    });
    expect(list.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(normalizeAttachmentList([attachmentWire()])).toHaveLength(1);
    expect(normalizeAttachmentList(null)).toEqual([]);
  });

  it("reads the run's answer, and none at all as 'hidden'", () => {
    expect(attachmentSettingsFrom({ enabled: true, canAdd: true })).toEqual({ enabled: true, canAdd: true });
    expect(attachmentSettingsFrom({ enabled: false })).toEqual({ enabled: false, canAdd: false });
    expect(attachmentSettingsFrom({ canAdd: true })).toBeNull();
    expect(attachmentSettingsFrom(undefined)).toBeNull();
  });

  it("reads an item's count and the report's frozen refs", () => {
    expect(attachmentCountFrom(3)).toBe(3);
    expect(attachmentCountFrom(undefined)).toBeNull();
    expect(attachmentCountFrom(-1)).toBeNull();
    expect(
      attachmentRefsFrom([
        { id: "a", caption: " Shown ", kind: "evidence", contentType: "image/png" },
        { id: "", caption: "no id" },
        { id: "b", kind: "weird" },
      ]),
    ).toEqual([
      { id: "a", caption: "Shown", kind: "evidence", contentType: "image/png" },
      { id: "b", caption: null, kind: "evidence", contentType: null },
    ]);
    expect(attachmentRefsFrom("nope")).toEqual([]);
  });
});

describe("the Project run carries the attachment answers", () => {
  it("reads the run's settings and each item's count", () => {
    const run = normalizeProjectRun(
      projectRunWire({
        attachments: { enabled: true, canAdd: false },
        items: [runItemWire({ attachmentCount: 2 }), runItemWire({ id: "run-item-2", position: 1 })],
      }),
    )!;
    expect(run.attachments).toEqual({ enabled: true, canAdd: false });
    expect(run.items.map((item) => item.attachmentCount)).toEqual([2, null]);
    expect(run.items[0].attachments).toEqual([]);
  });

  it("an older backend sends neither: the feature is hidden", () => {
    const run = normalizeProjectRun(projectRunWire())!;
    expect(run.attachments).toBeNull();
    expect(showsEvidence(run)).toBe(false);
    expect(canAddEvidence(run)).toBe(false);
  });

  it("the report's items carry their frozen refs", () => {
    const wire = projectReportWire();
    const items = (wire.run as { items: Record<string, unknown>[] }).items;
    items[0].attachments = [{ id: "att-1", caption: "Before the fix", kind: "evidence", contentType: "image/webp" }];
    const report = normalizeProjectReport(wire)!;
    expect(report.run.items[0].attachments.map((ref) => ref.id)).toEqual(["att-1"]);
    expect(reportHasEvidence(report.run.items)).toBe(true);
    expect(reportHasEvidence(normalizeProjectReport(projectReportWire())!.run.items)).toBe(false);
  });
});

describe("who may do what", () => {
  const settings = { enabled: true, canAdd: true };

  it("shows Evidence only once the server says storage is on", () => {
    expect(showsEvidence({ attachments: settings })).toBe(true);
    expect(showsEvidence({ attachments: { enabled: false, canAdd: true } })).toBe(false);
    expect(showsEvidence({ attachments: null })).toBe(false);
  });

  it("offers adding only on an open run the server allows", () => {
    expect(canAddEvidence({ status: "open", attachments: settings })).toBe(true);
    expect(canAddEvidence({ status: "signed_off", attachments: settings })).toBe(false);
    expect(canAddEvidence({ status: "open", attachments: { enabled: true, canAdd: false } })).toBe(false);
    expect(canAddEvidence({ status: "open", attachments: { enabled: false, canAdd: true } })).toBe(false);
  });

  it("offers delete only where the server allows it, never once signed off", () => {
    expect(canDeleteEvidence({ canDelete: true }, { status: "open" })).toBe(true);
    expect(canDeleteEvidence({ canDelete: false }, { status: "open" })).toBe(false);
    expect(canDeleteEvidence({ canDelete: true }, { status: "signed_off" })).toBe(false);
  });

  it("stops at five per item", () => {
    expect(evidenceAtLimit(4)).toBe(false);
    expect(evidenceAtLimit(5)).toBe(true);
  });
});

describe("what the Evidence section says", () => {
  it("groups by item, oldest first", () => {
    const grouped = attachmentsByItem([
      attachment({ id: "c", runItemId: "i2" }),
      attachment({ id: "b", createdAt: "2026-10-14T10:00:00.000Z" }),
      attachment({ id: "a", createdAt: "2026-10-14T08:00:00.000Z" }),
    ]);
    expect(grouped["run-item-1"].map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(grouped.i2.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("counts the loaded list once there is one, else the run's own count", () => {
    expect(evidenceCount(undefined, 3)).toBe(3);
    expect(evidenceCount(undefined, null)).toBe(0);
    expect(evidenceCount([attachment()], 3)).toBe(1);
    expect(evidenceCountLabel(1)).toBe("1 screenshot");
    expect(evidenceCountLabel(4)).toBe("4 screenshots");
  });

  it("uses the caption as alt text, else names the screenshot and its item", () => {
    expect(evidenceAlt({ caption: "Broken total" }, 0, "Pay")).toBe("Broken total");
    expect(evidenceAlt({ caption: null }, 1, "Pay with a saved card")).toBe("Screenshot 2 of Pay with a saved card");
  });

  it("knows when a signed URL has run out (with a margin)", () => {
    const now = Date.parse("2026-10-14T09:00:00.000Z");
    expect(urlExpired({ url: "https://a.test/x", urlExpiresAt: "2026-10-14T09:05:00.000Z" }, now)).toBe(false);
    expect(urlExpired({ url: "https://a.test/x", urlExpiresAt: "2026-10-14T09:00:10.000Z" }, now)).toBe(true);
    expect(urlExpired({ url: null, urlExpiresAt: null }, now)).toBe(true);
    expect(urlExpired({ url: "https://a.test/x", urlExpiresAt: null }, now)).toBe(false);
    expect(anyUrlExpired([attachment(), attachment({ url: null })], now)).toBe(true);
    expect(anyUrlExpired([attachment()], now)).toBe(false);
  });

  it("checks and trims the caption", () => {
    expect(captionError("x".repeat(MAX_CAPTION_LENGTH))).toBeNull();
    expect(captionError("x".repeat(MAX_CAPTION_LENGTH + 1))).toBe("A caption can be up to 280 characters.");
    expect(captionPayload("  Shown  ")).toBe("Shown");
    expect(captionPayload("   ")).toBeNull();
  });

  it("steps through the lightbox, wrapping at both ends", () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(0, 1, 0)).toBe(0);
    expect(positionLabel(1, 5)).toBe("2 of 5");
  });

  it("matches a report's frozen refs to the run's signed URLs", () => {
    const refs = [
      { id: "att-1", caption: null, kind: "evidence" as const, contentType: null },
      { id: "gone", caption: "Removed since", kind: "evidence" as const, contentType: null },
    ];
    const matched = reportEvidence(refs, [attachment()]);
    expect(matched[0].attachment?.id).toBe("att-1");
    expect(matched[1].attachment).toBeNull();
  });
});

describe("evidence errors", () => {
  it.each(Object.entries(QA_ATTACHMENT_ERROR_MESSAGES))("maps %s to its own sentence, not the server's", (code, sentence) => {
    expect(attachmentErrorMessage(coded(409, code), "fallback")).toBe(sentence);
  });

  it("reads a bare 413 (a proxy refusing the body) as too large", () => {
    expect(attachmentCodeMessage(apiError(413))).toBe(QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_TOO_LARGE);
    expect(attachmentCodeMessage(apiError(500))).toBeNull();
  });

  it("keys on the code, never the wording", () => {
    expect(attachmentErrorMessage(coded(409, "qa_attachment_limit"), "fallback")).toBe(
      QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_LIMIT,
    );
  });

  it("falls back to the QA run rules for anything else", () => {
    expect(attachmentErrorMessage(apiError(500), "Could not save.")).toBe("Could not save.");
    expect(attachmentErrorMessage(new Error("boom"), "Could not save.")).toBe("Could not save.");
  });

  it("leaves the existing QA sentences alone: a signed-off run elsewhere keeps the server's words", () => {
    expect(qaCodeMessage(coded(409, "QA_RUN_SIGNED_OFF"))).toBeNull();
  });

  it("says nothing when the tester cancelled the share prompt", () => {
    expect(captureErrorMessage(Object.assign(new Error("denied"), { name: "NotAllowedError" }))).toBeNull();
    expect(captureErrorMessage(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBeNull();
    expect(captureErrorMessage(new Error("no video"))).toBe(CAPTURE_FAILED);
    expect(captureErrorMessage(coded(413, "QA_ATTACHMENT_TOO_LARGE"))).toBe(
      QA_ATTACHMENT_ERROR_MESSAGES.QA_ATTACHMENT_TOO_LARGE,
    );
  });
});
