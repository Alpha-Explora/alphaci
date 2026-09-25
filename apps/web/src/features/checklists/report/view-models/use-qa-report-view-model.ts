"use client";

import { useEffect, useRef, useState } from "react";

import { qaRunsRepository } from "../../data/qa-runs-repository";
import { reportBaseName, reportErrorCopy, type QaReportErrorCopy } from "../../model/qa-report-rules";
import type { QaReport } from "../../model/qa-report-types";

export type QaReportStatus = "loading" | "ready" | "error";

export interface QaReportViewModel {
  status: QaReportStatus;
  report: QaReport | null;
  error: QaReportErrorCopy | null;
  reload: () => void;
  print: () => void;
}

interface ReportState {
  status: QaReportStatus;
  report: QaReport | null;
  error: QaReportErrorCopy | null;
}

const LOADING: ReportState = { status: "loading", report: null, error: null };

/** Drop `?print=1` once the dialog has opened, so a refresh does not reopen it. */
function forgetPrintFlag() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("print")) return;
  url.searchParams.delete("print");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Opens the print dialog once, after the report has rendered and its web fonts
 * are in — printing before the fonts land would lay the PDF out in the fallback
 * face. The ref is only set when print actually fires, so React's development
 * double-effect (mount, cleanup, mount) still prints exactly once.
 */
function useAutoPrint(enabled: boolean) {
  const printed = useRef(false);
  useEffect(() => {
    if (!enabled || printed.current) return;
    let cancelled = false;
    const fontsReady = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
    void Promise.resolve(fontsReady).then(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      window.print();
      forgetPrintFlag();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
}

/** The tab title doubles as the browser's "Save as PDF" file name. */
function useDocumentTitle(report: QaReport | null) {
  useEffect(() => {
    if (!report) return;
    const previous = document.title;
    document.title = reportBaseName(report);
    return () => {
      document.title = previous;
    };
  }, [report]);
}

/**
 * ViewModel for the printable QA report: fetches the server-built report once
 * per run, and — when opened by "Download PDF" — prints it once it is on screen.
 */
export function useQaReportViewModel(options: {
  projectId: string;
  runId: string;
  autoPrint: boolean;
}): QaReportViewModel {
  const { projectId, runId, autoPrint } = options;
  const [state, setState] = useState<ReportState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    qaRunsRepository.report(projectId, runId).then(
      (report) => {
        if (id === requestId.current) setState({ status: "ready", report, error: null });
      },
      (cause: unknown) => {
        if (id === requestId.current) setState({ status: "error", report: null, error: reportErrorCopy(cause) });
      },
    );
  }, [projectId, runId, attempt]);

  useAutoPrint(autoPrint && state.status === "ready");
  useDocumentTitle(state.report);

  return {
    ...state,
    reload: () => {
      setState(LOADING);
      setAttempt((value) => value + 1);
    },
    print: () => window.print(),
  };
}
