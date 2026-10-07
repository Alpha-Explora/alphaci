import { getApiBaseUrl, request, requestBlob } from "@/shared/api/request";

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

/**
 * One screenshot's bytes, for saving to disk. `url` is a full image URL the
 * model resolved (API base + path); it is fetched with the session cookie
 * exactly as the `<img>` that shows it is, so this works whether the API is
 * same-origin or not. A URL outside the API base is refused rather than
 * fetched with credentials.
 */
export function getVisualImageBlob(url: string): Promise<Blob> {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  if (!url.startsWith(`${base}/`)) return Promise.reject(new Error("Not an API image URL."));
  return requestBlob(url.slice(base.length));
}
