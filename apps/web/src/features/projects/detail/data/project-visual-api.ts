import { request } from "@/shared/api/request";

import type {
  VisualApproveInput,
  VisualApproveResponse,
  VisualBranch,
  VisualChecksResponse,
} from "../model/visual-check-types";

/**
 * Visual checks for a project: the Playwright screenshots of the deployed
 * uat/main site, compared with the references ALPHACI stores per branch.
 *
 * Unlike the other workspace reads, nothing here calls GitHub, so it costs
 * the organisation's rate limit nothing. It is still read once per opened
 * Verify stage and never polled: screenshots change once per deploy.
 *
 * The images themselves are plain `<img src>` reads of the paths these
 * responses carry (served with the session cookie), not calls made here.
 */

const enc = encodeURIComponent;

const visualUrl = (projectId: string) => `/projects/${enc(projectId)}/workspace/visual`;

/** The named run's snapshots, or the branch's latest when `runId` is null. */
export function getProjectVisualChecks(
  projectId: string,
  branch: VisualBranch,
  runId: number | null,
) {
  const query = new URLSearchParams({ branch });
  if (runId !== null) query.set("runId", String(runId));
  return request<VisualChecksResponse>(`${visualUrl(projectId)}?${query.toString()}`);
}

/**
 * Makes each named screenshot the branch's reference. All or nothing: one
 * name the server cannot approve refuses the whole batch (409).
 */
export function approveProjectVisualChecks(projectId: string, input: VisualApproveInput) {
  return request<VisualApproveResponse>(`${visualUrl(projectId)}/approve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
