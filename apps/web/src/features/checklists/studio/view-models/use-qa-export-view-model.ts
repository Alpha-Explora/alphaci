"use client";

import { useEffect, useRef, useState } from "react";

import { downloadBlob } from "@/shared/browser/download-blob";

import { ciRunReportRepository } from "../../data/ci-run-report-repository";
import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { qaRunsRepository } from "../../data/qa-runs-repository";
import { ciRunReportFilename, ciRunReportPageHref } from "../../model/ci-run-report-rules";
import type { CiRunReportRef } from "../../model/ci-run-report-types";
import {
  normalizeProjectReport,
  projectReportFilename,
  projectReportPageHref,
} from "../../model/project-report-rules";
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

/**
 * Where one kind of run gets its three exports. The menu and its status line
 * are the same for a repository run and a Project run; only these differ.
 */
export interface QaExportSource {
  /** The print page, opened in a new tab with the print dialog. */
  pdfHref: string;
  fetchMarkdown: () => Promise<string>;
  /** The JSON report to save, and the file name to save it under. */
  fetchJson: () => Promise<{ filename: string; report: unknown }>;
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
export function useExportViewModel(source: QaExportSource): QaExportViewModel {
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
      markdown = await source.fetchMarkdown();
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
      const { filename, report } = await source.fetchJson();
      const body = `${JSON.stringify(report, null, 2)}\n`;
      downloadBlob(filename, new Blob([body], { type: "application/json" }));
      busy.current = false;
      setStatus("idle");
    } catch (cause) {
      fail(exportErrorMessage("download", cause));
    }
  }

  return {
    status,
    message,
    pdfHref: source.pdfHref,
    copyMarkdown,
    downloadJson,
    dismiss,
  };
}

/** A repository's QA run: `GET /projects/:id/qa-runs/:runId/report`. */
export function useQaExportViewModel(options: { projectId: string; runId: string }): QaExportViewModel {
  const { projectId, runId } = options;
  return useExportViewModel({
    pdfHref: reportPageHref(projectId, runId, { print: true }),
    fetchMarkdown: () => qaRunsRepository.reportMarkdown(projectId, runId),
    fetchJson: async () => {
      const report = await qaRunsRepository.report(projectId, runId);
      return { filename: reportFilename(report, "json"), report };
    },
  });
}

/** A Project's QA run: `GET /delivery-projects/:id/qa-runs/:runId/report`. */
export function useProjectQaExportViewModel(options: {
  deliveryProjectId: string;
  runId: string;
}): QaExportViewModel {
  const { deliveryProjectId, runId } = options;
  return useExportViewModel({
    pdfHref: projectReportPageHref(deliveryProjectId, runId, { print: true }),
    fetchMarkdown: () => projectQaRunsRepository.reportMarkdown(deliveryProjectId, runId),
    fetchJson: async () => {
      // Save the server's document untouched; read it only to name the file.
      const body = await projectQaRunsRepository.reportBody(deliveryProjectId, runId);
      const named = normalizeProjectReport(body);
      if (!named) throw new Error("The server did not return the QA report.");
      return { filename: projectReportFilename(named, "json"), report: body };
    },
  });
}

/** One CI run (a repository, a branch, a commit): `GET /ci/runs/report`. */
export function useCiRunReportExportViewModel(ref: CiRunReportRef): QaExportViewModel {
  return useExportViewModel({
    pdfHref: ciRunReportPageHref(ref, { print: true }),
    fetchMarkdown: () => ciRunReportRepository.reportMarkdown(ref),
    fetchJson: async () => {
      const report = await ciRunReportRepository.report(ref);
      return { filename: ciRunReportFilename(ref, "json"), report };
    },
  });
}
