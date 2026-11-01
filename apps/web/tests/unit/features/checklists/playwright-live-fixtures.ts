/* Wire fixtures for GET /projects/:projectId/workspace/playwright-live. */

export function liveTest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "t1",
    file: "e2e/home.spec.ts",
    title: "home page loads",
    project: "chromium",
    status: "passed",
    durationMs: 1400,
    error: null,
    ...overrides,
  };
}

/** Running: 4 of 12 done (3 passed, 1 failed), one test running now. */
export function liveRun(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    runId: 123,
    runAttempt: 1,
    commitSha: "a1b2c3d4e5f6",
    branch: "uat",
    status: "running",
    stage: "Run Playwright tests",
    startedAt: "2026-10-08T02:00:00.000Z",
    updatedAt: "2026-10-08T02:00:31.000Z",
    finishedAt: null,
    total: 12,
    done: 4,
    passed: 3,
    failed: 1,
    skipped: 0,
    running: [
      { id: "t5", file: "e2e/cart.spec.ts", title: "adds to cart", project: "chromium", startedAt: "2026-10-08T02:00:30.000Z" },
    ],
    tests: [
      liveTest(),
      liveTest({ id: "t2", file: "e2e/search.spec.ts", title: "finds a product", durationMs: 2300 }),
      liveTest({ id: "t3", file: "e2e/search.spec.ts", title: "shows no results", durationMs: 820 }),
      liveTest({
        id: "t4",
        file: "e2e/checkout.spec.ts",
        title: "pays with a saved card",
        status: "failed",
        durationMs: 5100,
        error: "Timed out 5000ms waiting for getByRole('button', { name: 'Pay' })",
      }),
    ],
    ...overrides,
  };
}
