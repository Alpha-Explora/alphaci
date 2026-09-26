import { request, requestText } from "@/shared/api/request";

import type {
  CreateQaRunInput,
  QaCurrentRunResponse,
  QaReturnedItemsResponse,
  QaRun,
  QaRunListResponse,
  QaSignoffInput,
  UpdateQaRunItemInput,
} from "../model/qa-run-types";
import type { QaReport } from "../model/qa-report-types";
import type { QaAutomationDispatchWire } from "../model/qa-automation-types";
import type { QaPromotionMergeWire, QaPromotionStatusWire } from "../model/qa-promotion-types";

/* The only place in the checklists domain that talks to the QA run endpoints.
 *
 * Starting a run sends the checklist and the branch, never a commit: the
 * server resolves which commit the branch is on, so a stale page cannot start
 * a run against a sha that is no longer deployed. Every item write carries the
 * rowVersion the viewer read, so two testers get a 409 instead of silently
 * overwriting each other. */

function id(value: string): string {
  return encodeURIComponent(value);
}

function runsPath(projectId: string): string {
  return `/projects/${id(projectId)}/qa-runs`;
}

function runPath(projectId: string, runId: string): string {
  return `${runsPath(projectId)}/${id(runId)}`;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function post(body?: unknown): RequestInit {
  return body === undefined
    ? { method: "POST" }
    : { method: "POST", body: JSON.stringify(body) };
}

export const qaRunsRepository = {
  list(
    projectId: string,
    filters: { branch?: string; checklistId?: string; limit?: number } = {},
  ): Promise<QaRunListResponse> {
    return request<QaRunListResponse>(`${runsPath(projectId)}${query(filters)}`);
  },

  current(
    projectId: string,
    filters: { branch: string; checklistId: string },
  ): Promise<QaCurrentRunResponse> {
    return request<QaCurrentRunResponse>(
      `${runsPath(projectId)}/current${query(filters)}`,
    );
  },

  create(projectId: string, input: CreateQaRunInput): Promise<QaRun> {
    // Only these two fields, whatever the caller passed: never a sha.
    const body: CreateQaRunInput = { checklistId: input.checklistId, branch: input.branch };
    return request<QaRun>(runsPath(projectId), post(body));
  },

  get(projectId: string, runId: string): Promise<QaRun> {
    return request<QaRun>(runPath(projectId, runId));
  },

  updateItem(
    projectId: string,
    runId: string,
    itemId: string,
    input: UpdateQaRunItemInput,
  ): Promise<QaRun> {
    return request<QaRun>(`${runPath(projectId, runId)}/items/${id(itemId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  requestRetest(
    projectId: string,
    runId: string,
    itemId: string,
    note: string | null,
  ): Promise<QaRun> {
    return request<QaRun>(
      `${runPath(projectId, runId)}/items/${id(itemId)}/request-retest`,
      post(note ? { note } : {}),
    );
  },

  signoff(projectId: string, runId: string, input: QaSignoffInput): Promise<QaRun> {
    return request<QaRun>(`${runPath(projectId, runId)}/signoff`, post(input));
  },

  reopen(projectId: string, runId: string): Promise<QaRun> {
    return request<QaRun>(`${runPath(projectId, runId)}/reopen`, post());
  },

  /** The `qa-report/v1` JSON. For a signed-off run it describes the frozen copy. */
  report(projectId: string, runId: string): Promise<QaReport> {
    return request<QaReport>(`${runPath(projectId, runId)}/report${query({ format: "json" })}`);
  },

  /** The same report as GitHub-flavoured Markdown, ready to paste into a PR. */
  reportMarkdown(projectId: string, runId: string): Promise<string> {
    return requestText(`${runPath(projectId, runId)}/report${query({ format: "md" })}`, {
      headers: { Accept: "text/markdown" },
    });
  },

  /**
   * Starts the project's verify workflow (Playwright) for this run's branch.
   * 202 carries which ref and head commit it started on, and whether that is
   * still the run's commit. No body: the server picks the workflow and ref
   * from the run, so a stale page cannot aim it anywhere else.
   */
  dispatchAutomation(projectId: string, runId: string): Promise<QaAutomationDispatchWire> {
    return request<QaAutomationDispatchWire>(`${runPath(projectId, runId)}/automation/dispatch`, post());
  },

  returnedItems(projectId: string): Promise<QaReturnedItemsResponse> {
    return request<QaReturnedItemsResponse>(
      `/projects/${id(projectId)}/qa-returned-items`,
    );
  },

  /**
   * The Overview's "My QA items": what QA returned, plus the current uat
   * run's developer items. Untyped on purpose — read it through
   * `normalizeMyQaItems`.
   */
  myItems(projectId: string): Promise<unknown> {
    return request<unknown>(`/projects/${id(projectId)}/qa-my-items`);
  },

  /** Whether uat's current head is QA-approved for main. Read through `normalizePromotionStatus`. */
  promotion(projectId: string): Promise<QaPromotionStatusWire> {
    return request<QaPromotionStatusWire>(`/projects/${id(projectId)}/qa/promotion`);
  },

  /**
   * Merge uat into main (Team lead / Admin). No body: the server re-checks
   * the gate, resolves uat's head and the promotion PR itself, so a stale
   * page can never merge a commit QA did not approve.
   */
  mergePromotion(projectId: string): Promise<QaPromotionMergeWire> {
    return request<QaPromotionMergeWire>(`/projects/${id(projectId)}/qa/promotion/merge`, post());
  },
};
