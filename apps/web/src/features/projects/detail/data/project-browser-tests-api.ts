import { request } from "@/shared/api/request";

import type { BrowserTestsAdded, BrowserTestsStatus } from "../model/browser-test-rules";

/**
 * "Add browser tests": whether the dev branch has ALPHACI's starter Playwright
 * pack, and the pull request that adds what is missing.
 *
 * The status read costs a few GitHub file reads, so it is made once when the
 * Pipeline runs tab opens and never polled. The write is the signed-in
 * person's own GitHub token: the pull request is theirs.
 */

const browserTestsUrl = (projectId: string) =>
  `/projects/${encodeURIComponent(projectId)}/workspace/browser-tests`;

export function getProjectBrowserTests(projectId: string) {
  return request<BrowserTestsStatus>(browserTestsUrl(projectId));
}

/** Opens the pull request into dev. No body: the server decides what is missing. */
export function addProjectBrowserTests(projectId: string) {
  return request<BrowserTestsAdded>(browserTestsUrl(projectId), { method: "POST" });
}
