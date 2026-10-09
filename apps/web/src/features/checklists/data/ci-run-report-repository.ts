import { request, requestText } from "@/shared/api/request";

import { ciRunReportQuery, normalizeCiRunReport } from "../model/ci-run-report-rules";
import type { CiRunReport, CiRunReportRef } from "../model/ci-run-report-types";

/* The only place in the checklists domain that reads a CI run's report
 * (`GET /ci/runs/report`). The server builds every format from the stored run,
 * so the PDF, the Markdown and the JSON agree; this only fetches. */

export const ciRunReportRepository = {
  /** The `ci-run-report/v1` JSON. */
  async report(ref: CiRunReportRef): Promise<CiRunReport> {
    const raw = await request<unknown>(`/ci/runs/report?${ciRunReportQuery(ref, { format: "json" })}`);
    const report = normalizeCiRunReport(raw);
    if (!report) throw new Error("The server did not return the CI report.");
    return report;
  },

  /** The same report as GitHub-flavoured Markdown, ready to paste into a PR or an issue. */
  reportMarkdown(ref: CiRunReportRef): Promise<string> {
    return requestText(`/ci/runs/report?${ciRunReportQuery(ref, { format: "md" })}`, {
      headers: { Accept: "text/markdown" },
    });
  },
};
