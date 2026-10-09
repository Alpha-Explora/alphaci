"use client";

import { useEffect, useRef, useState } from "react";

import { ciRunReportRepository } from "../../data/ci-run-report-repository";
import { ciRunReportBaseName } from "../../model/ci-run-report-rules";
import type { CiRunReport, CiRunReportRef } from "../../model/ci-run-report-types";
import { reportErrorCopy, type QaReportErrorCopy } from "../../model/qa-report-rules";
import { useAutoPrint, type QaReportStatus } from "./use-qa-report-view-model";

export interface CiRunReportViewModel {
  status: QaReportStatus;
  report: CiRunReport | null;
  error: QaReportErrorCopy | null;
  reload: () => void;
  print: () => void;
}

interface ReportState {
  status: QaReportStatus;
  report: CiRunReport | null;
  error: QaReportErrorCopy | null;
}

const LOADING: ReportState = { status: "loading", report: null, error: null };

/** The tab title doubles as the browser's "Save as PDF" file name. */
function useDocumentTitle(ref: CiRunReportRef | null, ready: boolean) {
  useEffect(() => {
    if (!ref || !ready) return;
    const previous = document.title;
    document.title = ciRunReportBaseName(ref);
    return () => {
      document.title = previous;
    };
  }, [ref, ready]);
}

/**
 * ViewModel for the printable CI run report: fetches the server-built
 * `ci-run-report/v1` once per execution and, when opened by "Download PDF",
 * prints it once it is on screen. A page opened without a full reference has
 * nothing to fetch and says so.
 */
export function useCiRunReportViewModel(options: {
  run: CiRunReportRef | null;
  autoPrint: boolean;
}): CiRunReportViewModel {
  const { run, autoPrint } = options;
  const repoFullName = run?.repoFullName ?? "";
  const branch = run?.branch ?? "";
  const commitSha = run?.commitSha ?? "";
  const known = run !== null;
  const [state, setState] = useState<ReportState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!known) return;
    const id = ++requestId.current;
    ciRunReportRepository.report({ repoFullName, branch, commitSha }).then(
      (report) => {
        if (id === requestId.current) setState({ status: "ready", report, error: null });
      },
      (cause: unknown) => {
        if (id === requestId.current) setState({ status: "error", report: null, error: reportErrorCopy(cause) });
      },
    );
  }, [known, repoFullName, branch, commitSha, attempt]);

  useAutoPrint(autoPrint && state.status === "ready");
  useDocumentTitle(run, state.status === "ready");

  if (!known) {
    return {
      status: "error",
      report: null,
      error: { title: "This report is not available", text: "The link is missing the repository, branch or commit.", signIn: false },
      reload: () => undefined,
      print: () => undefined,
    };
  }

  return {
    ...state,
    reload: () => {
      setState(LOADING);
      setAttempt((value) => value + 1);
    },
    print: () => window.print(),
  };
}
