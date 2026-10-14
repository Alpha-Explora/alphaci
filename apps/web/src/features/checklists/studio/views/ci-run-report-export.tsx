"use client";

import type { CiRunReportRef } from "../../model/ci-run-report-types";
import { useCiRunReportExportViewModel } from "../view-models/use-qa-export-view-model";
import { ExportMenu, ExportStatus } from "./export-menu";

/**
 * "Export results" for one CI run, for the Project page's pipeline card: Download
 * PDF, Copy Markdown (to paste into a PR or an issue) and Download JSON. The
 * report is built by the server from the stored run, failures first, with no
 * raw logs and no GitHub links.
 */
export function CiRunReportExport({ run }: Readonly<{ run: CiRunReportRef }>) {
  const exporter = useCiRunReportExportViewModel(run);
  return (
    <div>
      <ExportMenu vm={exporter} label="Export results" />
      <ExportStatus vm={exporter} />
    </div>
  );
}
