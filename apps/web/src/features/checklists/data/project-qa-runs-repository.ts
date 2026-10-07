import { request } from "@/shared/api/request";

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

  /** Every Developer's items across the Project, in the four buckets. */
  async myItems(deliveryProjectId: string): Promise<ProjectMyItems> {
    return normalizeProjectMyItems(await request<unknown>(`/delivery-projects/${enc(deliveryProjectId)}/qa/my-items`));
  },
};
