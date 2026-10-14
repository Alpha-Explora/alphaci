"use client";

import { useEffect, useRef, useState } from "react";

import { qaAttachmentsRepository } from "../../data/qa-attachments-repository";
import type { QaProjectReport } from "../../model/project-report-types";
import { reportEvidence, reportHasEvidence } from "../../model/qa-attachment-rules";
import type { QaAttachment, QaAttachmentRef } from "../../model/qa-attachment-types";

/**
 * `none`: the report has no per-item screenshots (or no report yet), so
 * nothing is read; `loading` while the run's signed URLs are read; `error`
 * when they could not be (the report still prints, with captions only).
 */
export type ReportEvidenceStatus = "none" | "loading" | "ready" | "error";

export interface ReportEvidenceItem {
  ref: QaAttachmentRef;
  attachment: QaAttachment | null;
}

export interface ReportEvidenceViewModel {
  status: ReportEvidenceStatus;
  /** One item's images: its frozen refs, each with its signed URL once read. */
  forItem: (refs: ReadonlyArray<QaAttachmentRef>) => ReportEvidenceItem[];
  /** An image finished (loaded or failed): print waits for every one. */
  imageSettled: (attachmentId: string) => void;
  /** Every image the report shows is in (or there are none to wait for). */
  settled: boolean;
}

interface Loaded {
  key: string;
  list: QaAttachment[] | null;
}

/** The images the page will actually draw: refs the run's list has a URL for. */
function expectedImageIds(report: QaProjectReport, list: ReadonlyArray<QaAttachment>): string[] {
  return report.run.items.flatMap((item) =>
    reportEvidence(item.attachments, list).flatMap((entry) => (entry.attachment?.url ? [entry.attachment.id] : [])),
  );
}

function statusOf(wanted: boolean, loaded: Loaded | null, key: string): ReportEvidenceStatus {
  if (!wanted) return "none";
  if (!loaded || loaded.key !== key) return "loading";
  return loaded.list ? "ready" : "error";
}

/** Nothing to wait for, or every image the page draws has loaded or failed. */
function isSettled(status: ReportEvidenceStatus, expected: ReadonlyArray<string>, settled: ReadonlySet<string>): boolean {
  if (status === "loading") return false;
  return status !== "ready" || expected.every((id) => settled.has(id));
}

/**
 * ViewModel for the screenshots a Project report shows under each item. The
 * report's JSON names them (ids and captions, frozen at sign-off); their
 * images come from one read of the run's attachments, for its five-minute
 * signed URLs. The print dialog waits until every image has loaded or failed,
 * the same way the "Visual evidence" appendix does.
 */
export function useReportEvidenceViewModel(options: {
  deliveryProjectId: string;
  runId: string;
  report: QaProjectReport | null;
}): ReportEvidenceViewModel {
  const { deliveryProjectId, runId, report } = options;
  const key = `${deliveryProjectId}/${runId}`;
  const wanted = report !== null && reportHasEvidence(report.run.items);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(() => new Set());
  const requestId = useRef(0);

  useEffect(() => {
    if (!wanted) return;
    const id = ++requestId.current;
    qaAttachmentsRepository.listForRun(deliveryProjectId, runId).then(
      (list) => {
        if (id === requestId.current) setLoaded({ key: `${deliveryProjectId}/${runId}`, list });
      },
      () => {
        if (id === requestId.current) setLoaded({ key: `${deliveryProjectId}/${runId}`, list: null });
      },
    );
  }, [deliveryProjectId, runId, wanted]);

  const status = statusOf(wanted, loaded, key);
  const list = (status === "ready" && loaded?.list) || [];
  const expected = report ? expectedImageIds(report, list) : [];

  return {
    status,
    forItem: (refs) => reportEvidence(refs, list),
    imageSettled: (attachmentId) =>
      setSettledIds((previous) => (previous.has(attachmentId) ? previous : new Set(previous).add(attachmentId))),
    settled: isSettled(status, expected, settledIds),
  };
}
