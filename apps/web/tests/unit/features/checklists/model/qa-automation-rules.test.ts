import {
  AUTOMATED_DIFFERS_HINT,
  UNCONFIRMED_PASS_HINT,
  automatedBadgeLabel,
  automatedDiffers,
  automatedScopeLabel,
  automatedSentence,
  automatedSourceLabel,
  automatedStatusLabel,
  automatedStatusTone,
  automationStages,
  dispatchBlockedReason,
  dispatchConfirmation,
  dispatchError,
  dispatchMovedWarning,
  failuresToggleLabel,
  hasStageResults,
  isUnconfirmedPass,
  listedFailures,
  MAX_LISTED_FAILURES,
  noAutomationText,
  normalizeAutomatedResult,
  normalizeDispatch,
  normalizeFailure,
  normalizeRunAutomation,
  qaSignInHref,
  roleCanDispatch,
  stageCoverage,
  stageName,
  stagePassShare,
  stageResultFor,
  stageRunLabel,
  stageRunTone,
  stageTestsLabel,
  stageTitle,
  unlistedFailuresNote,
  verifySettledSince,
} from "../../../../../src/features/checklists/model/qa-automation-rules";
import type {
  QaAutomatedItemResult,
  QaAutomatedScope,
  QaAutomatedStatus,
  QaStageResult,
  QaStageTests,
} from "../../../../../src/features/checklists/model/qa-automation-types";
import { ApiError } from "../../../../../src/shared/api/request";
import { automated, automation, qualitySuccess, RUN_URL, verifyFailure } from "../qa-automation-fixtures";

function item(overrides: Partial<QaAutomatedItemResult> = {}): QaAutomatedItemResult {
  return {
    source: "playwright",
    stage: "verify",
    status: "failed",
    scope: "spec",
    matchedSpec: "e2e/checkout.spec.ts",
    failure: null,
    runId: 1,
    runUrl: null,
    reportedAt: null,
    inferred: false,
    ...overrides,
  };
}

function tests(overrides: Partial<QaStageTests> = {}): QaStageTests {
  return { total: 20, passed: 18, failed: 2, failures: [], failuresTruncated: false, ...overrides };
}

function stage(overrides: Partial<QaStageResult> = {}): QaStageResult {
  return { stage: "verify", status: "failure", runId: 1, runUrl: null, reportedAt: null, tests: null, ...overrides };
}

describe("labels", () => {
  it("names every automated status with its tone", () => {
    const expected: Array<[QaAutomatedStatus, string, string]> = [
      ["passed", "Passed", "success"],
      ["failed", "Failed", "danger"],
      ["unknown", "Unknown", "neutral"],
      ["not_run", "Not run", "neutral"],
    ];
    for (const [status, label, tone] of expected) {
      expect(automatedStatusLabel(status)).toBe(label);
      expect(automatedStatusTone(status)).toBe(tone);
    }
    expect(automatedStatusLabel("bogus" as QaAutomatedStatus)).toBe("Unknown");
    expect(automatedStatusTone("bogus" as QaAutomatedStatus)).toBe("neutral");
  });

  it("words the scope and the source", () => {
    expect(automatedScopeLabel("spec")).toBe("This spec");
    expect(automatedScopeLabel("suite")).toBe("Whole suite");
    expect(automatedScopeLabel("stage")).toBe("Stage result");
    expect(automatedScopeLabel(null)).toBeNull();
    expect(automatedScopeLabel("bogus" as QaAutomatedScope)).toBeNull();
    expect(automatedSourceLabel("playwright")).toBe("Playwright E2E");
    expect(automatedSourceLabel("unit_test")).toBe("Unit test");
    expect(automatedSourceLabel("bruno")).toBe("Bruno API");
    expect(automatedSourceLabel(null)).toBe("Automated test");
    expect(automatedSourceLabel("jest" as never)).toBe("Automated test");
  });

  it("titles the stages by what they run", () => {
    expect(stageTitle("verify")).toBe("Verify — browser & API tests");
    expect(stageTitle("quality")).toBe("Quality — unit tests");
    expect(stageName("quality")).toBe("Quality");
    expect(stageCoverage("verify")).toBe("browser & API tests");
    expect(stageName("lint" as never)).toBe("lint");
    expect(stageCoverage("lint" as never)).toBe("tests");
  });

  it("labels a stage run, with unknown for anything unrecognised", () => {
    expect(stageRunLabel("success")).toBe("Passed");
    expect(stageRunLabel("failure")).toBe("Failed");
    expect(stageRunLabel("running")).toBe("Running");
    expect(stageRunLabel("cancelled")).toBe("Cancelled");
    expect(stageRunLabel(null)).toBe("Unknown");
    expect(stageRunLabel("queued" as never)).toBe("Unknown");
    expect(stageRunTone("success")).toBe("success");
    expect(stageRunTone("failure")).toBe("danger");
    expect(stageRunTone("running")).toBe("brand");
    expect(stageRunTone("cancelled")).toBe("neutral");
    expect(stageRunTone(null)).toBe("neutral");
    expect(stageRunTone("queued" as never)).toBe("neutral");
  });
});

describe("normalizeRunAutomation", () => {
  it("reads a full payload", () => {
    const result = normalizeRunAutomation(automation());
    expect(result.verify).toEqual({
      stage: "verify",
      status: "failure",
      runId: 1234567890,
      runUrl: RUN_URL,
      reportedAt: "2026-09-25T06:57:00.000Z",
      tests: {
        total: 20,
        passed: 18,
        failed: 2,
        failures: [
          { name: "e2e/checkout.spec.ts › pays with a saved card", message: expect.stringContaining("Timed out") },
          { name: "e2e/cart.spec.ts › applies a coupon per line", message: "Expected ₱2,480, received ₱2,700" },
        ],
        failuresTruncated: false,
      },
    });
    expect(result.quality?.status).toBe("success");
    expect(hasStageResults(result)).toBe(true);
  });

  it.each([undefined, null, "nope", 42, [], {}])("tolerates an absent or malformed automation (%p)", (raw) => {
    const result = normalizeRunAutomation(raw);
    expect(result).toEqual({ verify: null, quality: null });
    expect(hasStageResults(result)).toBe(false);
  });

  it("turns every missing or wrongly typed stage field into null", () => {
    const result = normalizeRunAutomation({ verify: {}, quality: { status: "queued", runId: "7", runUrl: 3, reportedAt: "yesterday", tests: "x" } });
    expect(result.verify).toEqual({ stage: "verify", status: null, runId: null, runUrl: null, reportedAt: null, tests: null });
    expect(result.quality).toEqual({ stage: "quality", status: null, runId: null, runUrl: null, reportedAt: null, tests: null });
  });

  it("takes the stage from the key, not the payload", () => {
    expect(normalizeRunAutomation({ verify: { stage: "quality", status: "success" } }).verify?.stage).toBe("verify");
  });

  it("keeps only http(s) run links", () => {
    const link = (runUrl: unknown) => normalizeRunAutomation({ verify: { runUrl } }).verify?.runUrl;
    expect(link("javascript:alert(1)")).toBeNull();
    expect(link("//evil.example.com")).toBeNull();
    expect(link("https://")).toBeNull();
    expect(link("  https://github.com/a/b/actions/runs/1  ")).toBe("https://github.com/a/b/actions/runs/1");
  });

  it("normalises partial test counts and failures", () => {
    const result = normalizeRunAutomation({
      verify: {
        tests: {
          total: 12.9,
          passed: -1,
          failures: [{ name: "a" }, { message: "no name" }, null, { name: "  " }, { name: "b", message: 3 }],
          failuresTruncated: "yes",
        },
      },
    });
    expect(result.verify?.tests).toEqual({
      total: 12,
      passed: null,
      failed: null,
      failures: [
        { name: "a", message: "" },
        { name: "b", message: "" },
      ],
      failuresTruncated: false,
    });
    expect(normalizeRunAutomation({ verify: { tests: { failures: "x" } } }).verify?.tests?.failures).toEqual([]);
  });

  it("lists the stages in display order and finds one by name", () => {
    const result = normalizeRunAutomation({ quality: qualitySuccess() });
    expect(automationStages(result).map((entry) => [entry.stage, entry.result?.status ?? null])).toEqual([
      ["verify", null],
      ["quality", "success"],
    ]);
    expect(stageResultFor(result, "quality")?.status).toBe("success");
    expect(stageResultFor(result, null)).toBeNull();
  });

  it("names a failure only when it has a name", () => {
    expect(normalizeFailure({ name: "x", message: " boom " })).toEqual({ name: "x", message: "boom" });
    expect(normalizeFailure({ message: "boom" })).toBeNull();
    expect(normalizeFailure("x")).toBeNull();
  });
});

describe("normalizeAutomatedResult", () => {
  it("reads a full item result", () => {
    expect(normalizeAutomatedResult(automated())).toEqual({
      source: "playwright",
      stage: "verify",
      status: "failed",
      scope: "spec",
      matchedSpec: "e2e/checkout.spec.ts",
      failure: { name: "e2e/checkout.spec.ts › pays with a saved card", message: "Timed out 5000ms" },
      runId: 1234567890,
      runUrl: RUN_URL,
      reportedAt: "2026-09-25T06:57:00.000Z",
      inferred: false,
    });
  });

  it.each([undefined, null, "failed", 1, []])("is null for a manual item or junk (%p)", (raw) => {
    expect(normalizeAutomatedResult(raw)).toBeNull();
  });

  it("reads an object with nothing recognisable as unknown, never as hidden", () => {
    expect(normalizeAutomatedResult({})).toEqual({
      source: null,
      stage: null,
      status: "unknown",
      scope: null,
      matchedSpec: null,
      failure: null,
      runId: null,
      runUrl: null,
      reportedAt: null,
      inferred: false,
    });
    expect(normalizeAutomatedResult({ status: "flaky", scope: "file", source: "cypress" })).toMatchObject({
      status: "unknown",
      scope: null,
      source: null,
    });
  });
});

describe("normalizeDispatch", () => {
  it("reads the 202 body", () => {
    expect(normalizeDispatch({ workflowFile: "verify.yml", ref: "main", headSha: "abc", targetsRunCommit: false })).toEqual({
      workflowFile: "verify.yml",
      ref: "main",
      headSha: "abc",
      targetsRunCommit: false,
    });
  });

  it("tolerates an empty 202", () => {
    for (const raw of [undefined, null, {}, { targetsRunCommit: "no" }]) {
      expect(normalizeDispatch(raw)).toEqual({ workflowFile: null, ref: null, headSha: null, targetsRunCommit: null });
    }
  });
});

describe("automatedSentence — every status × scope", () => {
  const verifyStage = stage({ status: "failure", tests: tests() });

  it.each<[QaAutomatedStatus, QaAutomatedScope | null, string]>([
    ["passed", "spec", "Automated: passed in e2e/checkout.spec.ts"],
    ["passed", "suite", "Automated: passed (whole suite green)"],
    ["passed", "stage", "Automated: verify stage passed"],
    ["passed", null, "Automated: passed"],
    ["failed", "spec", "Automated: failed in e2e/checkout.spec.ts"],
    ["failed", "suite", "Automated: failed (whole suite has failures)"],
    ["failed", "stage", "Automated: verify stage failed"],
    ["failed", null, "Automated: failed"],
    ["unknown", "spec", "Automated: unknown — CI could not tell for this item"],
    ["unknown", "suite", "Automated: unknown — CI could not tell for this item"],
    ["unknown", "stage", "Automated: unknown — CI could not tell for this item"],
    ["unknown", null, "Automated: unknown — CI could not tell for this item"],
    ["not_run", "spec", "Automated: not run for a1b2c3d yet"],
    ["not_run", "suite", "Automated: not run for a1b2c3d yet"],
    ["not_run", "stage", "Automated: not run for a1b2c3d yet"],
    ["not_run", null, "Automated: not run for a1b2c3d yet"],
  ])("%s at %s scope", (status, scope, sentence) => {
    expect(automatedSentence(item({ status, scope }), { commitSha: "a1b2c3d4e5f6", stageResult: verifyStage })).toBe(sentence);
  });

  it("falls back when the matched spec or stage is missing", () => {
    expect(automatedSentence(item({ status: "passed", matchedSpec: null }))).toBe("Automated: passed (this spec)");
    expect(automatedSentence(item({ status: "failed", matchedSpec: null }))).toBe("Automated: failed (this spec)");
    expect(automatedSentence(item({ status: "failed", scope: "stage", stage: null }))).toBe("Automated: CI stage failed");
    expect(automatedSentence(item({ status: "passed", scope: "stage", source: "bruno" }))).toBe("Automated: verify stage passed");
  });

  it("says why a result is unknown", () => {
    const unknown = item({ status: "unknown" });
    expect(automatedSentence(unknown, { stageResult: stage({ status: "running" }) })).toBe(
      "Automated: unknown — verify is still running",
    );
    expect(automatedSentence(unknown, { stageResult: stage({ tests: tests({ failuresTruncated: true }) }) })).toBe(
      "Automated: unknown — more failures than listed",
    );
    expect(automatedSentence(unknown)).toBe("Automated: unknown — CI could not tell for this item");
  });

  it("says not run for this commit without a sha", () => {
    expect(automatedSentence(item({ status: "not_run" }))).toBe("Automated: not run for this commit yet");
  });
});

describe("automatedDiffers", () => {
  it("flags only a passed/failed disagreement", () => {
    expect(automatedDiffers("passed", "failed")).toBe(true);
    expect(automatedDiffers("failed", "passed")).toBe(true);
    expect(automatedDiffers("passed", "passed")).toBe(false);
    expect(automatedDiffers("failed", "failed")).toBe(false);
    expect(automatedDiffers("pending", "failed")).toBe(false);
    expect(automatedDiffers("blocked", "passed")).toBe(false);
    expect(automatedDiffers("passed", "unknown")).toBe(false);
    expect(automatedDiffers("failed", "not_run")).toBe(false);
    expect(AUTOMATED_DIFFERS_HINT).toBe("Automated result differs from the recorded status");
  });
});

describe("stage figures", () => {
  it("says passed out of total only when both are known", () => {
    expect(stageTestsLabel(tests())).toBe("18 / 20 passed");
    expect(stageTestsLabel(tests({ total: null }))).toBeNull();
    expect(stageTestsLabel(tests({ passed: null }))).toBeNull();
    expect(stageTestsLabel(null)).toBeNull();
  });

  it("gives the passed share for the bar", () => {
    expect(stagePassShare(tests())).toBe(90);
    expect(stagePassShare(tests({ passed: 30 }))).toBe(100);
    expect(stagePassShare(tests({ total: 0, passed: 0 }))).toBeNull();
    expect(stagePassShare(tests({ passed: null }))).toBeNull();
    expect(stagePassShare(null)).toBeNull();
  });

  it("lists at most 20 failures and counts the rest", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ name: `t${index}`, message: "" }));
    expect(listedFailures(tests({ failures: many }))).toHaveLength(MAX_LISTED_FAILURES);
    expect(listedFailures(null)).toEqual([]);
    expect(unlistedFailuresNote(tests({ failures: many, failed: 25 }))).toBe("5 more failures not listed.");
  });

  it("uses the failed count when CI truncated the list", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ name: `t${index}`, message: "" }));
    expect(unlistedFailuresNote(tests({ failures: twenty, failed: 21, failuresTruncated: true }))).toBe(
      "1 more failure not listed.",
    );
    expect(unlistedFailuresNote(tests({ failures: twenty, failed: null, failuresTruncated: true }))).toBe(
      "More failures than listed — open the run for the full list.",
    );
  });

  it("labels the failures disclosure", () => {
    const one = [{ name: "a", message: "" }];
    const two = [...one, { name: "b", message: "" }];
    expect(failuresToggleLabel(tests({ failures: two, failed: 2 }), false)).toBe("Show 2 failures");
    expect(failuresToggleLabel(tests({ failures: one, failed: 1 }), true)).toBe("Hide 1 failure");
    expect(failuresToggleLabel(tests({ failures: two, failed: 23 }), false)).toBe("Show 2 of 23 failures");
    expect(failuresToggleLabel(tests({ failures: two, failed: null }), false)).toBe("Show 2 failures");
    expect(failuresToggleLabel(tests({ failures: [], failed: 5 }), false)).toBeNull();
    expect(failuresToggleLabel(null, false)).toBeNull();
  });

  it("has no note when every failure is listed", () => {
    expect(unlistedFailuresNote(tests({ failures: [{ name: "a", message: "" }], failed: 1 }))).toBeNull();
    expect(unlistedFailuresNote(null)).toBeNull();
  });

  it("words the empty state with the branch and short sha", () => {
    expect(noAutomationText("main", "a1b2c3d4e5f6")).toBe("No automated results for main @ a1b2c3d yet.");
    expect(noAutomationText("main", null)).toBe("No automated results for main yet.");
  });
});

describe("dispatch copy", () => {
  const run = { branch: "main", commitSha: "a1b2c3d4e5f6", status: "open" as const };

  it("offers Run Playwright to the roles that start runs", () => {
    expect(roleCanDispatch("qa")).toBe(true);
    expect(roleCanDispatch("lead")).toBe(true);
    expect(roleCanDispatch("admin")).toBe(true);
    expect(roleCanDispatch("member")).toBe(false);
    expect(roleCanDispatch(null)).toBe(false);
  });

  it("blocks a signed-off run with a reason", () => {
    expect(dispatchBlockedReason({ status: "open" })).toBeNull();
    expect(dispatchBlockedReason({ status: "signed_off" })).toBe(
      "This run is signed off, so Playwright cannot run on it until it is reopened.",
    );
  });

  it("confirms on the ref, falling back to the run's branch", () => {
    const started = normalizeDispatch({ ref: "release/1.2", headSha: "a1b2c3d4", targetsRunCommit: true });
    expect(dispatchConfirmation(started, run)).toBe(
      "Playwright started on release/1.2. Results appear here when the run reports.",
    );
    expect(dispatchConfirmation(normalizeDispatch({}), run)).toBe(
      "Playwright started on main. Results appear here when the run reports.",
    );
  });

  it("warns when the branch has moved past the run's commit", () => {
    const moved = normalizeDispatch({ ref: "main", headSha: "9f8e7d6c5b4a", targetsRunCommit: false });
    expect(dispatchMovedWarning(moved, run)).toBe(
      "The branch has moved to 9f8e7d6 — results will attach to that commit, not this run's a1b2c3d.",
    );
    expect(dispatchMovedWarning(normalizeDispatch({ targetsRunCommit: false }), run)).toBe(
      "The branch has moved since this run started — results will attach to the newer commit, not this run's a1b2c3d.",
    );
    expect(dispatchMovedWarning(normalizeDispatch({ headSha: "9f8e7d6", targetsRunCommit: true }), run)).toBeNull();
  });

  it("compares shas itself when an older backend omits targetsRunCommit", () => {
    expect(dispatchMovedWarning(normalizeDispatch({ headSha: "9f8e7d6c" }), run)).toMatch(/moved to 9f8e7d6/);
    expect(dispatchMovedWarning(normalizeDispatch({ headSha: "A1B2C3D" }), run)).toBeNull();
    expect(dispatchMovedWarning(normalizeDispatch({}), run)).toBeNull();
  });

  it("maps each dispatch error to a clear message", () => {
    const reauth = dispatchError(new ApiError("x", 409, { code: "GITHUB_REAUTH", message: "reauth" }));
    expect(reauth).toEqual({ message: expect.stringMatching(/sign in again/), signIn: true, failures: [] });
    expect(dispatchError(new ApiError("x", 409, { error: { code: "github_reauth" } })).signIn).toBe(true);
    expect(dispatchError(new ApiError("x", 409, { code: "VERIFY_WORKFLOW_MISSING" }))).toEqual({
      message: expect.stringMatching(/no verify workflow/),
      signIn: false,
      failures: [],
    });
    expect(dispatchError(new ApiError("x", 409, { message: "QA run is signed off." })).message).toBe("QA run is signed off.");
    expect(dispatchError(new ApiError("x", 409, { message: ["Run", "is signed off."] })).message).toBe("Run is signed off.");
    expect(dispatchError(new ApiError("x", 409, undefined)).message).toMatch(/signed off/);
    expect(dispatchError(new ApiError("x", 403, {})).message).toBe("GitHub refused to start Playwright.");
    expect(dispatchError(new ApiError("x", 404, {})).message).toMatch(/no longer exists/);
    expect(dispatchError(new ApiError("x", 401, {})).signIn).toBe(true);
    expect(dispatchError(new ApiError("x", 500, {})).message).toMatch(/could not be started/);
    expect(dispatchError(new Error("network")).message).toMatch(/could not be started/);
    expect(dispatchError(null).signIn).toBe(false);
  });

  it("shows the server's own reason for a 403, never an invented role message", () => {
    const refused = dispatchError(
      new ApiError("x", 403, { message: "Resource not accessible by personal access token" }),
    );
    expect(refused).toEqual({
      message: "Resource not accessible by personal access token",
      signIn: false,
      failures: [],
    });
    expect(dispatchError(new ApiError("x", 403, {})).message).not.toMatch(/role/i);
    expect(dispatchError(new ApiError("x", 403, { message: "   " })).message).toBe("GitHub refused to start Playwright.");
  });

  it("never shows raw HTML and keeps server sentences short", () => {
    const html = "<html><body><h1>403 Forbidden</h1></body></html>";
    expect(dispatchError(new ApiError("x", 403, html)).message).toBe("GitHub refused to start Playwright.");
    expect(dispatchError(new ApiError("x", 403, { message: html })).message).toBe("GitHub refused to start Playwright.");
    const long = dispatchError(new ApiError("x", 403, { message: `${"a ".repeat(400)}` })).message;
    expect(long.length).toBeLessThanOrEqual(240);
    expect(long.endsWith("…")).toBe(true);
    expect(dispatchError(new ApiError("x", 403, { message: "no\n  write\taccess" })).message).toBe("no write access");
  });

  it("lists each repository the server says refused, with the server's reason", () => {
    const copy = dispatchError(
      new ApiError("x", 403, {
        message: "GitHub refused to start the workflow in every repository.",
        failed: [
          { projectId: "p1", repoFullName: "tone/logistics2cicd-fe", code: "GITHUB_FORBIDDEN", message: "Resource not accessible by integration" },
          { projectId: "p2", repoFullName: "tone/logistics2cicd-be", code: "X", message: "<b>bad</b>" },
          { projectId: "p3", message: "No repo name" },
          "junk",
        ],
      }),
    );
    expect(copy.message).toBe("GitHub refused to start the workflow in every repository.");
    expect(copy.failures).toEqual([
      "logistics2cicd-fe — Resource not accessible by integration",
      "logistics2cicd-be — GitHub refused to start Playwright.",
      "No repo name",
    ]);
  });

  it("keeps the sign-in and missing-workflow copy even when failures are listed", () => {
    const reauth = dispatchError(
      new ApiError("x", 409, { code: "GITHUB_REAUTH", message: "token expired", failed: [{ repoFullName: "t/a", message: "expired" }] }),
    );
    expect(reauth.signIn).toBe(true);
    expect(reauth.message).toMatch(/sign in again/);
    expect(reauth.failures).toEqual(["a — expired"]);
  });

  it("keeps the 401, 404 and 5xx copy rather than the server's text", () => {
    expect(dispatchError(new ApiError("x", 401, { message: "jwt expired" })).message).toMatch(/session has ended/);
    expect(dispatchError(new ApiError("x", 404, { message: "Not Found" })).message).toMatch(/no longer exists/);
    expect(dispatchError(new ApiError("x", 502, { message: "Bad gateway" })).message).toMatch(/could not be started/);
  });

  it("sends sign-in back to the project", () => {
    expect(qaSignInHref("project 1")).toBe("/login?next=/projects/project%201");
  });
});

describe("verifySettledSince", () => {
  const since = Date.parse("2026-09-25T07:00:00.000Z");

  it("is true once verify reported, finished, after the dispatch", () => {
    const after = normalizeRunAutomation({ verify: verifyFailure({ reportedAt: "2026-09-25T07:03:00.000Z" }) });
    expect(verifySettledSince(after, since)).toBe(true);
  });

  it("ignores an older report, a running one, and none at all", () => {
    expect(verifySettledSince(normalizeRunAutomation({ verify: verifyFailure() }), since)).toBe(false);
    expect(
      verifySettledSince(normalizeRunAutomation({ verify: verifyFailure({ status: "running", reportedAt: "2026-09-25T07:03:00.000Z" }) }), since),
    ).toBe(false);
    expect(verifySettledSince(normalizeRunAutomation(undefined), since)).toBe(false);
  });
});

describe("an inferred (unconfirmed) Playwright pass", () => {
  it("reads the flag only when it is exactly true", () => {
    expect(normalizeAutomatedResult(automated({ status: "passed", failure: null, inferred: true }))?.inferred).toBe(true);
    expect(normalizeAutomatedResult(automated({ status: "passed", failure: null }))?.inferred).toBe(false);
    expect(
      normalizeAutomatedResult({ ...automated({ status: "passed" }), inferred: "true" })?.inferred,
    ).toBe(false);
  });

  it("is unconfirmed only for a pass", () => {
    expect(isUnconfirmedPass(item({ status: "passed", inferred: true }))).toBe(true);
    expect(isUnconfirmedPass(item({ status: "passed", inferred: false }))).toBe(false);
    expect(isUnconfirmedPass(item({ status: "failed", inferred: true }))).toBe(false);
  });

  it("labels and explains it, leaving a confirmed pass unchanged", () => {
    expect(automatedBadgeLabel("passed", true)).toBe("Passed (not confirmed)");
    expect(automatedBadgeLabel("passed")).toBe("Passed");
    expect(automatedBadgeLabel("failed", true)).toBe("Failed");
    expect(automatedSentence(item({ status: "passed", inferred: true }))).toBe(
      "Automated: passed in e2e/checkout.spec.ts (not confirmed)",
    );
    expect(automatedSentence(item({ status: "passed" }))).toBe("Automated: passed in e2e/checkout.spec.ts");
    expect(UNCONFIRMED_PASS_HINT).toBe(
      "Older pipeline: this test wasn't in the failure list, but its pass wasn't reported. Update the pipeline to confirm passes.",
    );
  });
});
