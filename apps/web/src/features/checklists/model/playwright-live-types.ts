/* Live Playwright progress: what one repository's Playwright run is doing
 * right now, test by test. Pure: no React, no fetch.
 *
 * GET /projects/:projectId/workspace/playwright-live?branch=uat answers
 * `{ run: null | {...} }` for the latest Playwright run on that branch. A
 * backend without the route answers 404: the tab then keeps the stage cards
 * and the "results appear when the runs report" line, as before.
 *
 * Every wire field may be missing or malformed; `normalizePlaywrightLive`
 * turns the answer into the shapes below and never throws. */

/** The run's own state; `unknown` is a status this page does not know yet (read as still going). */
export type PlaywrightLiveStatus =
  | "queued"
  | "starting"
  | "running"
  | "passed"
  | "failed"
  | "cancelled"
  | "timedout"
  | "unknown";

/** One finished test; `unknown` when the reporter said something this page does not know. */
export type PlaywrightLiveTestStatus = "passed" | "failed" | "skipped" | "unknown";

export interface PlaywrightLiveRunningTest {
  id: string;
  file: string | null;
  title: string;
  /** The Playwright project, usually the browser: "chromium". */
  project: string | null;
  startedAt: string | null;
}

export interface PlaywrightLiveTest {
  id: string;
  file: string | null;
  title: string;
  project: string | null;
  status: PlaywrightLiveTestStatus;
  durationMs: number | null;
  /** The failure message, for a failed test. */
  error: string | null;
}

export interface PlaywrightLiveRun {
  runId: number | null;
  runAttempt: number | null;
  commitSha: string | null;
  branch: string | null;
  status: PlaywrightLiveStatus;
  /** What the workflow is doing: "Install Playwright browsers". */
  stage: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  /** Null until the reporter knows how many tests there are. */
  total: number | null;
  done: number;
  passed: number;
  failed: number;
  skipped: number;
  running: PlaywrightLiveRunningTest[];
  /** In the order the server sent them (finished order). */
  tests: PlaywrightLiveTest[];
}
