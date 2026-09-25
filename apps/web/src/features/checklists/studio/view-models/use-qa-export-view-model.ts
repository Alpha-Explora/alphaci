"use client";

import { useEffect, useRef, useState } from "react";

import { downloadBlob } from "@/shared/browser/download-blob";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { exportErrorMessage, reportFilename, reportPageHref } from "../../model/qa-report-rules";

export type QaExportStatus = "idle" | "copying" | "copied" | "downloading" | "failed";

export interface QaExportViewModel {
  status: QaExportStatus;
  /** What happened, for the live region beside the menu. Null when idle. */
  message: string | null;
  /** The print page, opened in a new tab with the print dialog. */
  pdfHref: string;
  copyMarkdown: () => Promise<void>;
  downloadJson: () => Promise<void>;
  dismiss: () => void;
}

/** How long "Copied" stays before the control settles back. */
export const COPIED_RESET_MS = 2_500;

const COPIED_MESSAGE = "PR Markdown copied to the clipboard.";

async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(text);
}

/**
 * ViewModel for the run's "Export report" menu. Every export is built by the
 * server from the run — the same bytes for every role that can see it — so this
 * only fetches, copies or saves; it never assembles a report itself.
 */
export function useQaExportViewModel(options: { projectId: string; runId: string }): QaExportViewModel {
  const { projectId, runId } = options;
  const [status, setStatus] = useState<QaExportStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const resetTimer = useRef<number | null>(null);
  // A ref, not `status`: two clicks in one frame both see the old status.
  const busy = useRef(false);

  function clearTimer() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }

  useEffect(() => clearTimer, []);

  function begin(next: QaExportStatus): boolean {
    if (busy.current) return false;
    busy.current = true;
    clearTimer();
    setStatus(next);
    setMessage(null);
    return true;
  }

  function fail(text: string) {
    busy.current = false;
    setStatus("failed");
    setMessage(text);
  }

  function dismiss() {
    clearTimer();
    setStatus("idle");
    setMessage(null);
  }

  async function copyMarkdown() {
    if (!begin("copying")) return;
    let markdown: string;
    try {
      markdown = await qaRunsRepository.reportMarkdown(projectId, runId);
    } catch (cause) {
      fail(exportErrorMessage("copy-fetch", cause));
      return;
    }
    try {
      await writeClipboard(markdown);
    } catch (cause) {
      fail(exportErrorMessage("copy-clipboard", cause));
      return;
    }
    busy.current = false;
    setStatus("copied");
    setMessage(COPIED_MESSAGE);
    resetTimer.current = window.setTimeout(dismiss, COPIED_RESET_MS);
  }

  async function downloadJson() {
    if (!begin("downloading")) return;
    try {
      const report = await qaRunsRepository.report(projectId, runId);
      const body = `${JSON.stringify(report, null, 2)}\n`;
      downloadBlob(reportFilename(report, "json"), new Blob([body], { type: "application/json" }));
      busy.current = false;
      setStatus("idle");
    } catch (cause) {
      fail(exportErrorMessage("download", cause));
    }
  }

  return {
    status,
    message,
    pdfHref: reportPageHref(projectId, runId, { print: true }),
    copyMarkdown,
    downloadJson,
    dismiss,
  };
}
