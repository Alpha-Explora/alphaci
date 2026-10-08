import {
  applyLiveReads,
  formatLiveDuration,
  isLiveActive,
  isLiveFinished,
  liveConfirmationMode,
  liveFinishedNow,
  liveHeadline,
  liveKeepPolling,
  liveMilestones,
  liveProgressShare,
  liveRunStatus,
  liveTestStatus,
  liveWaitingConfirmation,
  LIVE_TESTS_CAP,
  normalizePlaywrightLive,
  showAllLabel,
  visibleLiveTests,
} from "../../../../../src/features/checklists/model/playwright-live-rules";
import type { PlaywrightLiveRun } from "../../../../../src/features/checklists/model/playwright-live-types";
import { projectDispatchConfirmation } from "../../../../../src/features/checklists/model/playwright-tab-rules";
import { dispatchConfirmation } from "../../../../../src/features/checklists/model/qa-automation-rules";
import { liveRun, liveTest } from "../playwright-live-fixtures";

function run(overrides: Record<string, unknown> = {}): PlaywrightLiveRun {
  return normalizePlaywrightLive({ run: liveRun(overrides) })!;
}

describe("normalizePlaywrightLive", () => {
  it("reads the whole contract", () => {
    const live = run();
    expect(live).toMatchObject({
      runId: 123,
      runAttempt: 1,
      commitSha: "a1b2c3d4e5f6",
      branch: "uat",
      status: "running",
      stage: "Run Playwright tests",
      total: 12,
      done: 4,
      passed: 3,
      failed: 1,
      skipped: 0,
    });
    expect(live.running).toEqual([
      { id: "t5", file: "e2e/cart.spec.ts", title: "adds to cart", project: "chromium", startedAt: "2026-10-08T02:00:30.000Z" },
    ]);
    expect(live.tests[3]).toEqual({
      id: "t4",
      file: "e2e/checkout.spec.ts",
      title: "pays with a saved card",
      project: "chromium",
      status: "failed",
      durationMs: 5100,
      error: "Timed out 5000ms waiting for getByRole('button', { name: 'Pay' })",
    });
  });

  it.each([undefined, null, "nope", {}, { run: null }, { run: "x" }, { run: [] }])("reads %p as no run, never a crash", (raw) => {
    expect(normalizePlaywrightLive(raw)).toBeNull();
  });

  it("survives a partial run: unknown status, no counts, junk tests", () => {
    const live = normalizePlaywrightLive({
      run: {
        status: "warming_up",
        tests: [liveTest({ status: "passed" }), null, 7, { id: "x" }, liveTest({ id: "t9", status: "timedOut", error: "slow" })],
        running: [{ title: "  " }, { file: "e2e/a.spec.ts" }],
      },
    })!;
    expect(live.status).toBe("unknown");
    expect(live.total).toBeNull();
    expect(live.tests.map((test) => test.status)).toEqual(["passed", "failed"]);
    expect([live.done, live.passed, live.failed, live.skipped]).toEqual([2, 1, 1, 0]);
    // A running test with only a file is still named by it.
    expect(live.running).toEqual([{ id: "e2e/a.spec.ts:e2e/a.spec.ts:1", file: "e2e/a.spec.ts", title: "e2e/a.spec.ts", project: null, startedAt: null }]);
    expect(live.runId).toBeNull();
    expect(live.startedAt).toBeNull();
  });

  it("keeps an error only on a failed test, and drops a negative duration", () => {
    const live = normalizePlaywrightLive({
      run: { status: "running", tests: [liveTest({ status: "passed", error: "noise", durationMs: -4 })] },
    })!;
    expect(live.tests[0]).toMatchObject({ error: null, durationMs: null });
  });

  it.each([
    ["queued", "queued"],
    ["QUEUED", "queued"],
    ["in_progress", "running"],
    ["success", "passed"],
    ["failure", "failed"],
    ["canceled", "cancelled"],
    ["timed_out", "timedout"],
    ["something-new", "unknown"],
    [42, "unknown"],
  ])("reads run status %p as %p", (raw, expected) => {
    expect(liveRunStatus(raw)).toBe(expected);
  });

  it.each([
    ["expected", "passed"],
    ["flaky", "passed"],
    ["unexpected", "failed"],
    ["interrupted", "failed"],
    ["skipped", "skipped"],
    ["weird", "unknown"],
  ])("reads test status %p as %p", (raw, expected) => {
    expect(liveTestStatus(raw)).toBe(expected);
  });
});

describe("liveHeadline — what the header says", () => {
  it.each<[Record<string, unknown>, string, string]>([
    [{ status: "queued" }, "Queued", "neutral"],
    [{ status: "starting", stage: "Install Playwright browsers" }, "Starting · Install Playwright browsers", "brand"],
    [{ status: "starting", stage: null }, "Starting", "brand"],
    [{ status: "running" }, "Running tests · 4 of 12", "brand"],
    [{ status: "running", total: null }, "Running tests · 4 done", "brand"],
    [
      { status: "passed", total: 12, done: 12, passed: 12, failed: 0, finishedAt: "2026-10-08T02:01:01.000Z" },
      "Passed · 12 of 12 · 1m 01s",
      "success",
    ],
    [{ status: "failed", done: 12, failed: 1, finishedAt: null }, "Failed · 1 failed", "danger"],
    [{ status: "timedout", finishedAt: null }, "Timed out · 4 of 12", "warning"],
    [{ status: "cancelled", finishedAt: null }, "Cancelled · 4 of 12", "neutral"],
    [{ status: "mystery" }, "In progress · 4 of 12", "brand"],
  ])("%p → %p", (overrides, text, tone) => {
    const headline = liveHeadline(run(overrides));
    expect(headline.text).toBe(text);
    expect(headline.tone).toBe(tone);
  });
});

describe("progress, durations and the finished list", () => {
  it("fills the bar by done of total; indeterminate while the total is unknown", () => {
    expect(liveProgressShare(run())).toBe(33);
    expect(liveProgressShare(run({ total: null }))).toBeNull();
    expect(liveProgressShare(run({ total: 0 }))).toBeNull();
    expect(liveProgressShare(run({ total: null, status: "passed" }))).toBe(100);
    expect(liveProgressShare(run({ done: 15 }))).toBe(100);
  });

  it.each<[number | null, string | null]>([
    [320, "320 ms"],
    [1400, "1.4s"],
    [58_000, "58s"],
    [61_000, "1m 01s"],
    [null, null],
    [-1, null],
  ])("formats %p as %p", (ms, text) => {
    expect(formatLiveDuration(ms)).toBe(text);
  });

  it("lists finished tests newest first, capped until Show all", () => {
    const tests = Array.from({ length: 73 }, (_, index) => ({ ...run().tests[0], id: `t${index}` }));
    expect(visibleLiveTests(tests, false)).toHaveLength(LIVE_TESTS_CAP);
    expect(visibleLiveTests(tests, false)[0].id).toBe("t72");
    expect(visibleLiveTests(tests, true)).toHaveLength(73);
    expect(showAllLabel(73, false)).toBe("Show all 73 tests");
    expect(showAllLabel(73, true)).toBeNull();
    expect(showAllLabel(50, false)).toBeNull();
  });

  it("tells going from finished", () => {
    expect(isLiveActive(run({ status: "queued" }))).toBe(true);
    expect(isLiveActive(run({ status: "mystery" }))).toBe(true);
    expect(isLiveActive(null)).toBe(false);
    expect(isLiveFinished(run({ status: "passed" }))).toBe(true);
    expect(isLiveFinished(undefined)).toBe(false);
  });
});

describe("liveFinishedNow and liveMilestones", () => {
  const going = run();
  const failedMore = run({
    done: 6,
    failed: 2,
    tests: [...(liveRun().tests as object[]), liveTest({ id: "t6", title: "applies a coupon", status: "failed", error: "Expected ₱2,480" })],
  });
  const passed = run({ status: "passed", total: 12, done: 12, passed: 12, failed: 0, finishedAt: "2026-10-08T02:01:01.000Z" });

  it("is history on the first read, news once seen going (or a new run already done)", () => {
    expect(liveFinishedNow(undefined, passed)).toBe(false);
    expect(liveFinishedNow(going, passed)).toBe(true);
    expect(liveFinishedNow(passed, passed)).toBe(false);
    expect(liveFinishedNow(null, passed)).toBe(true);
    expect(liveFinishedNow(passed, run({ runId: 124, status: "failed", finishedAt: null }))).toBe(true);
    expect(liveFinishedNow(going, null)).toBe(false);
  });

  it("announces a run already going on arrival, without its earlier failures", () => {
    expect(liveMilestones(undefined, going, "storefront-web")).toEqual(["Playwright is running in storefront-web."]);
  });

  it("announces a start once, then each new failure, then the finish", () => {
    expect(liveMilestones(null, going, "web")).toEqual(["Playwright started in web.", "Failed in web: pays with a saved card."]);
    expect(liveMilestones(going, going, "web")).toEqual([]);
    expect(liveMilestones(going, failedMore, "web")).toEqual(["Failed in web: applies a coupon."]);
    expect(liveMilestones(failedMore, passed, "web")).toEqual(["Playwright passed in web: 12 of 12 · 1m 01s."]);
    expect(liveMilestones(passed, null, "web")).toEqual([]);
  });

  it("caps a burst of failures", () => {
    const burst = run({
      tests: Array.from({ length: 5 }, (_, index) => liveTest({ id: `f${index}`, title: `test ${index}`, status: "failed" })),
    });
    expect(liveMilestones(run({ tests: [] }), burst, "web")).toEqual([
      "Failed in web: test 0.",
      "Failed in web: test 1.",
      "Failed in web: test 2.",
      "2 more failed in web.",
    ]);
  });
});

describe("polling and folding reads in", () => {
  it("keeps polling while a run goes, or while a dispatch waits for its run; never without the route", () => {
    expect(liveKeepPolling({ runs: [run()], supported: true, awaitingUntil: null, now: 0 })).toBe(true);
    expect(liveKeepPolling({ runs: [null], supported: true, awaitingUntil: 10, now: 5 })).toBe(true);
    expect(liveKeepPolling({ runs: [null], supported: true, awaitingUntil: 10, now: 10 })).toBe(false);
    expect(liveKeepPolling({ runs: [run({ status: "passed" })], supported: true, awaitingUntil: null, now: 0 })).toBe(false);
    expect(liveKeepPolling({ runs: [run()], supported: false, awaitingUntil: 10, now: 0 })).toBe(false);
  });

  it("folds a round in: runs, milestones, finished, arrival, a missing route", () => {
    const repositories = [
      { projectId: "fe", name: "web" },
      { projectId: "admin", name: "admin-web" },
    ];
    const first = applyLiveReads({}, repositories, [{ kind: "run", run: run() }, { kind: "run", run: null }]);
    expect(first.runs).toEqual({ fe: run(), admin: null });
    expect(first.milestones).toEqual(["Playwright is running in web."]);
    expect(first).toMatchObject({ finished: false, arrived: true, missing: false });

    const done = run({ status: "passed", finishedAt: null });
    const second = applyLiveReads(first.runs, repositories, [{ kind: "run", run: done }, { kind: "error" }]);
    expect(second.runs).toEqual({ fe: done, admin: null });
    expect(second).toMatchObject({ finished: true, arrived: true });

    const third = applyLiveReads(second.runs, repositories, [{ kind: "missing" }, { kind: "missing" }]);
    expect(third.missing).toBe(true);
    expect(third.runs).toEqual(second.runs);
  });

  it("decides what Run Playwright's confirmation does", () => {
    expect(liveConfirmationMode({ supported: null, awaiting: true, anyRun: false })).toBe("as-is");
    expect(liveConfirmationMode({ supported: false, awaiting: true, anyRun: true })).toBe("as-is");
    expect(liveConfirmationMode({ supported: true, awaiting: true, anyRun: true })).toBe("waiting");
    expect(liveConfirmationMode({ supported: true, awaiting: false, anyRun: true })).toBe("hidden");
    expect(liveConfirmationMode({ supported: true, awaiting: false, anyRun: false })).toBe("as-is");
  });

  it("shortens the confirmation while waiting for the first progress report", () => {
    const project = projectDispatchConfirmation({
      dispatched: [
        { projectId: "fe", repoFullName: "tone/web", ref: "uat", headSha: null, targetsRunCommit: true },
        { projectId: "fe2", repoFullName: "tone/admin", ref: "uat", headSha: null, targetsRunCommit: true },
      ],
      failed: [],
    })!;
    expect(liveWaitingConfirmation(project)).toBe("Playwright started on uat in web and admin. Waiting for its first progress report…");
    const single = dispatchConfirmation({ workflowFile: null, ref: "uat", headSha: null, targetsRunCommit: true }, { branch: "uat" });
    expect(liveWaitingConfirmation(single)).toBe("Playwright started on uat. Waiting for its first progress report…");
  });
});
