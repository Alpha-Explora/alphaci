import { request, requestBlob, requestText } from "@/shared/api/request";

import { normalizeProjectReport } from "../model/project-report-rules";
import { XLSX_TYPE } from "../model/qa-report-rules";
import type { QaProjectReport } from "../model/project-report-types";
import { normalizeProjectDispatch } from "../model/project-run-automation-rules";
import {
  normalizeProjectMyItems,
  normalizeProjectRun,
  normalizeProjectRunCurrent,
  runFromReply,
} from "../model/project-run-rules";
import type {
  ProjectDispatchResult,
  ProjectMyItems,
  ProjectQaRun,
  ProjectRunCurrent,
  SetVerificationInput,
} from "../model/project-run-types";
import type { QaSignoffInput } from "../model/qa-run-types";
import { record } from "../model/wire-readers";

/* The only place in the checklists domain that talks to the Project QA run
 * endpoints (docs/design/project-requirements.md, sections 2.4 and 2.5).
 *
 * Starting a run sends no body: the server reads every repository's uat head
 * itself, so a stale page can never start a run on heads that are no longer
 * deployed (ADR-0013 rule 4). Every Verification write carries the row
 * version read. Replies are normalised here. */

const enc = encodeURIComponent;

function runsPath(deliveryProjectId: string): string {
  return `/delivery-projects/${enc(deliveryProjectId)}/qa-runs`;
}

function runPath(deliveryProjectId: string, runId: string): string {
  return `${runsPath(deliveryProjectId)}/${enc(runId)}`;
}

function post(body?: unknown): RequestInit {
  return body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) };
}

function runOrThrow(value: unknown): ProjectQaRun {
  const run = runFromReply(value);
  if (!run) throw new Error("The server did not return the QA run.");
  return run;
}

function projectReportOrThrow(raw: unknown): QaProjectReport {
  const report = normalizeProjectReport(raw);
  if (!report) throw new Error("The server did not return the QA report.");
  return report;
}

export interface ProjectRunStart {
  /** False when a run on the same heads already existed (it is returned instead). */
  created: boolean;
  run: ProjectQaRun;
}

export const projectQaRunsRepository = {
  async current(deliveryProjectId: string): Promise<ProjectRunCurrent> {
    return normalizeProjectRunCurrent(await request<unknown>(`${runsPath(deliveryProjectId)}/current`));
  },

  async start(deliveryProjectId: string): Promise<ProjectRunStart> {
    const raw = await request<unknown>(runsPath(deliveryProjectId), post());
    return { created: record(raw)?.created !== false, run: runOrThrow(raw) };
  },

  async get(deliveryProjectId: string, runId: string): Promise<ProjectQaRun> {
    const run = normalizeProjectRun(await request<unknown>(runPath(deliveryProjectId, runId)));
    if (!run) throw new Error("The server did not return the QA run.");
    return run;
  },

  /**
   * Record Verification on one item. The reply is the run (or `{ run }`);
   * null when it carried neither, so the caller reads the run again.
   */
  async setVerification(
    deliveryProjectId: string,
    runId: string,
    itemId: string,
    input: SetVerificationInput,
  ): Promise<ProjectQaRun | null> {
    const raw = await request<unknown>(`${runPath(deliveryProjectId, runId)}/items/${enc(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return runFromReply(raw);
  },

  async signoff(deliveryProjectId: string, runId: string, input: QaSignoffInput): Promise<ProjectQaRun> {
    return runOrThrow(await request<unknown>(`${runPath(deliveryProjectId, runId)}/signoff`, post(input)));
  },

  async reopen(deliveryProjectId: string, runId: string): Promise<ProjectQaRun> {
    return runOrThrow(await request<unknown>(`${runPath(deliveryProjectId, runId)}/reopen`, post()));
  },

  /**
   * "Run Playwright": starts the verify workflow on uat in every repository
   * the run covers (or only `projectId`). The server picks the workflow and
   * the ref; the 202 says where it started and where it could not.
   */
  async dispatchAutomation(deliveryProjectId: string, runId: string, projectId?: string): Promise<ProjectDispatchResult> {
    const raw = await request<unknown>(
      `${runPath(deliveryProjectId, runId)}/automation/dispatch`,
      post(projectId ? { projectId } : undefined),
    );
    return normalizeProjectDispatch(raw);
  },

  /**
   * The `qa-report/v2` JSON exactly as the server sent it, for Download JSON:
   * a saved file must be the server's document, not the shape the page reads.
   */
  reportBody(deliveryProjectId: string, runId: string): Promise<unknown> {
    return request<unknown>(`${runPath(deliveryProjectId, runId)}/report?format=json`);
  },

  /** The same report normalised for drawing. For a signed-off run it describes the frozen copy. */
  async report(deliveryProjectId: string, runId: string): Promise<QaProjectReport> {
    return projectReportOrThrow(await projectQaRunsRepository.reportBody(deliveryProjectId, runId));
  },

  /** The same report as GitHub-flavoured Markdown, ready to paste into a PR. */
  reportMarkdown(deliveryProjectId: string, runId: string): Promise<string> {
    return requestText(`${runPath(deliveryProjectId, runId)}/report?format=md`, {
      headers: { Accept: "text/markdown" },
    });
  },

  /** The same report as an Excel workbook (.xlsx), one sheet per section. */
  reportExcel(deliveryProjectId: string, runId: string): Promise<Blob> {
    return requestBlob(`${runPath(deliveryProjectId, runId)}/report?format=xlsx`, {
      headers: { Accept: XLSX_TYPE },
    });
  },

  /** Every Developer's items across the Project, in the four buckets. */
  async myItems(deliveryProjectId: string): Promise<ProjectMyItems> {
    return normalizeProjectMyItems(await request<unknown>(`/delivery-projects/${enc(deliveryProjectId)}/qa/my-items`));
  },
};
