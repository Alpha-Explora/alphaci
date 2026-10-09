"use client";

import { useEffect, useRef, useState } from "react";

import { projectQaRunsRepository } from "../../data/project-qa-runs-repository";
import { projectReportBaseName } from "../../model/project-report-rules";
import type { QaProjectReport } from "../../model/project-report-types";
import { reportErrorCopy, type QaReportErrorCopy } from "../../model/qa-report-rules";
import type { QaReportStatus } from "./use-qa-report-view-model";
import { useAutoPrint } from "./use-qa-report-view-model";

export interface ProjectReportViewModel {
  status: QaReportStatus;
  report: QaProjectReport | null;
  error: QaReportErrorCopy | null;
  reload: () => void;
  print: () => void;
}

interface ReportState {
  status: QaReportStatus;
  report: QaProjectReport | null;
  error: QaReportErrorCopy | null;
}

const LOADING: ReportState = { status: "loading", report: null, error: null };

/** The tab title doubles as the browser's "Save as PDF" file name. */
function useDocumentTitle(report: QaProjectReport | null) {
  useEffect(() => {
    if (!report) return;
    const previous = document.title;
    document.title = projectReportBaseName(report);
    return () => {
      document.title = previous;
    };
  }, [report]);
}

/**
 * ViewModel for the printable Project QA report: fetches the server-built
 * `qa-report/v2` once per run and, when opened by "Download PDF", prints it
 * once it is on screen.
 */
export function useProjectReportViewModel(options: {
  deliveryProjectId: string;
  runId: string;
  autoPrint: boolean;
}): ProjectReportViewModel {
  const { deliveryProjectId, runId, autoPrint } = options;
  const [state, setState] = useState<ReportState>(LOADING);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    projectQaRunsRepository.report(deliveryProjectId, runId).then(
      (report) => {
        if (id === requestId.current) setState({ status: "ready", report, error: null });
      },
      (cause: unknown) => {
        if (id === requestId.current) setState({ status: "error", report: null, error: reportErrorCopy(cause) });
      },
    );
  }, [deliveryProjectId, runId, attempt]);

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
