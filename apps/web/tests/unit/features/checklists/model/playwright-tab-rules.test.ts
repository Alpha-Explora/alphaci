import {
  MERGED_RESULTS_NAME,
  mergedNote,
  namesList,
  noRunText,
  notRunText,
  playwrightItemRows,
  playwrightPanelState,
  playwrightTabStatus,
  projectDispatchConfirmation,
  projectDispatchFailures,
  projectDispatchWarning,
  projectPlaywrightResults,
  projectVerifySettledSince,
  repositoryPlaywrightResults,
  resolveStudioColumnTab,
  studioColumnTabKey,
  UNSUPPORTED_TEXT,
  type PlaywrightResults,
} from "../../../../../src/features/checklists/model/playwright-tab-rules";
import { normalizeProjectDispatch } from "../../../../../src/features/checklists/model/project-run-automation-rules";
import { normalizeProjectRun } from "../../../../../src/features/checklists/model/project-run-rules";
import type { ProjectQaRun } from "../../../../../src/features/checklists/model/project-run-types";
import { normalizeRunAutomation } from "../../../../../src/features/checklists/model/qa-automation-rules";
import { automated, automation, qualitySuccess, verifyFailure } from "../qa-automation-fixtures";
import { qaRun, runItem } from "../qa-run-fixtures";
import { projectRunWire, runItemWire, SHA_BE, SHA_FE } from "../requirement-fixtures";

const VERIFY_API = verifyFailure({ status: "success", tests: { total: 9, passed: 9, failed: 0, failures: [], failuresTruncated: false } });

function run(overrides: Record<string, unknown> = {}): ProjectQaRun {
  const value = normalizeProjectRun(projectRunWire(overrides));
  if (!value) throw new Error("fixture did not normalise");
  return value;
}

function withAutomation(overrides: Record<string, unknown> = {}): ProjectQaRun {
  return run({
    automation: automation(),
    automationByRepository: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() },
      { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: VERIFY_API, quality: null } },
    ],
    ...overrides,
  });
}

describe("Project run automation — normalising", () => {
  it("reads the merged result, the per-repository breakdown and each item's automated result", () => {
    const value = run({
      automation: automation(),
      automationByRepository: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() }],
      items: [runItemWire({ automated: automated() }), runItemWire({ id: "run-item-2", position: 1 })],
    });
    expect(value.automation?.verify?.tests?.passed).toBe(18);
    expect(value.automationByRepository).toHaveLength(1);
    expect(value.automationByRepository?.[0].automation.quality?.status).toBe("success");
    expect(value.items[0].automated?.status).toBe("failed");
    expect(value.items[1].automated).toBeNull();
  });

  it("reads an older backend (no fields at all) as null, never a crash", () => {
    const value = run();
    expect(value.automation).toBeNull();
    expect(value.automationByRepository).toBeNull();
    expect(value.items.every((item) => item.automated === null)).toBe(true);
  });

  it("reads partial and malformed data as null parts", () => {
    const value = run({
      automation: null,
      automationByRepository: [
        { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: { verify: { status: "nonsense" } } },
        { repoFullName: "no id" },
        "junk",
      ],
      items: [runItemWire({ automated: { status: "weird" } })],
    });
    expect(value.automation).toEqual({ verify: null, quality: null });
    expect(value.automationByRepository).toHaveLength(1);
    expect(value.automationByRepository?.[0].automation.verify?.status).toBeNull();
    expect(value.items[0].automated?.status).toBe("unknown");
    expect(run({ automationByRepository: "nope" }).automationByRepository).toBeNull();
  });

  it("normalises the dispatch reply, dropping rows without a repository id", () => {
    expect(
      normalizeProjectDispatch({
        dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: SHA_FE, targetsRunCommit: true }, { ref: "uat" }],
        failed: [{ projectId: "proj-be", repoFullName: "tone/orders-api", code: "VERIFY_WORKFLOW_MISSING" }],
      }),
    ).toEqual({
      dispatched: [{ projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", headSha: SHA_FE, targetsRunCommit: true }],
      failed: [
        { projectId: "proj-be", repoFullName: "tone/orders-api", code: "VERIFY_WORKFLOW_MISSING", message: "Playwright could not be started in this repository." },
      ],
    });
    expect(normalizeProjectDispatch(undefined)).toEqual({ dispatched: [], failed: [] });
  });
});

describe("Playwright tab — what it lists", () => {
  it("lists each covered repository on the head the run captured", () => {
    const results = projectPlaywrightResults(withAutomation());
    expect(results.supported).toBe(true);
    expect(results.repositories.map((repo) => [repo.name, repo.branch, repo.commitSha, repo.checks.map((ref) => ref.projectId)])).toEqual([
      ["storefront-web", "uat", SHA_FE, ["proj-fe"]],
      ["orders-api", "uat", SHA_BE, ["proj-be"]],
    ]);
  });

  it("falls back to the merged result, naming what it covers, without a breakdown", () => {
    const results = projectPlaywrightResults(run({ automation: automation() }));
    expect(results.repositories).toHaveLength(1);
    const [merged] = results.repositories;
    expect(merged.name).toBe(MERGED_RESULTS_NAME);
    expect(merged.projectId).toBeNull();
    expect(merged.checks.map((ref) => ref.projectId)).toEqual(["proj-fe", "proj-be"]);
    expect(mergedNote(merged.covers)).toBe("Combined for storefront-web and orders-api: the first report of each stage.");
  });

  it("is unsupported on an older backend", () => {
    const results = projectPlaywrightResults(run());
    expect(results.supported).toBe(false);
    expect(results.repositories).toEqual([]);
  });

  it("reads a repository run as one repository on its branch and commit", () => {
    const results = repositoryPlaywrightResults(qaRun({ automation: automation() }), { projectId: "project-1", repoFullName: "tone/storefront-web" });
    expect(results.supported).toBe(true);
    expect(results.repositories.map((repo) => [repo.name, repo.branch, repo.commitSha])).toEqual([["storefront-web", "main", qaRun().commitSha]]);
    expect(repositoryPlaywrightResults(qaRun(), { projectId: "project-1", repoFullName: null }).supported).toBe(false);
  });

  it("orders the requirement ↔ test rows failed first, and marks an inferred pass", () => {
    const rows = playwrightItemRows([
      { id: "a", title: "Home loads", group: "Smoke", testIdentifier: null, result: { ...normal("passed"), inferred: true, matchedSpec: "e2e/home.spec.ts" } },
      { id: "b", title: "Manual", group: null, testIdentifier: null, result: null },
      { id: "c", title: "Pays", group: "Checkout", testIdentifier: "e2e/checkout.spec.ts", result: { ...normal("failed"), failure: { name: "x", message: "Timed out" } } },
      { id: "d", title: "Refund", group: null, testIdentifier: "unit", result: normal("not_run") },
    ]);
    expect(rows.map((row) => [row.id, row.label, row.test])).toEqual([
      ["c", "Failed", "e2e/checkout.spec.ts"],
      ["d", "Not run", "unit"],
      ["a", "Passed (not confirmed)", "e2e/home.spec.ts"],
    ]);
    expect(rows[0].failure?.message).toBe("Timed out");
    expect(rows[2].inferred).toBe(true);
  });

  it("shows an item linked to no test as neutral, after failures and before not run, never as passed", () => {
    const rows = playwrightItemRows([
      { id: "p", title: "Home loads", group: null, testIdentifier: "e2e/home.spec.ts", result: normal("passed") },
      { id: "n", title: "Refund", group: null, testIdentifier: "e2e/refund.spec.ts", result: normal("not_run") },
      { id: "u", title: "Consignment registers", group: "Logistics", testIdentifier: null, result: { ...normal("unlinked"), scope: "stage" as const } },
      { id: "f", title: "Pays", group: null, testIdentifier: "e2e/pay.spec.ts", result: normal("failed") },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["f", "u", "n", "p"]);
    const unlinked = rows[1];
    expect([unlinked.label, unlinked.tone, unlinked.test, unlinked.inferred]).toEqual(["Not linked", "neutral", null, false]);
    expect(unlinked.note).toBe("Not linked to a Playwright test. Check this by hand.");
    expect(rows.filter((row) => row.id !== "u").every((row) => row.note === null)).toBe(true);
  });

  it("lists a repository run's automated items", () => {
    const results = repositoryPlaywrightResults(
      qaRun({ automation: automation(), items: [runItem(0, { title: "Pays", automated: automated() }), runItem(1, { title: "Manual" })] }),
      { projectId: "project-1", repoFullName: "tone/storefront-web" },
    );
    expect(results.items.map((row) => [row.title, row.status])).toEqual([["Pays", "failed"]]);
  });
});

function normal(status: "passed" | "failed" | "not_run" | "unlinked") {
  return {
    source: "playwright" as const,
    stage: "verify" as const,
    status,
    scope: "spec" as const,
    matchedSpec: null,
    failure: null,
    runId: null,
    runUrl: null,
    reportedAt: null,
    inferred: false,
  };
}

function results(verifies: unknown[]): PlaywrightResults {
  return {
    supported: true,
    items: [],
    repositories: verifies.map((verify, index) => ({
      key: String(index),
      projectId: String(index),
      name: String(index),
      repoFullName: null,
      covers: [],
      branch: "uat",
      commitSha: null,
      automation: normalizeRunAutomation({ verify }),
      checks: [],
    })),
  };
}

describe("Playwright tab — the label", () => {
  it("says nothing before anything reported", () => {
    expect(playwrightTabStatus(null)).toEqual({ text: null, spoken: null, tone: "none" });
    expect(playwrightTabStatus(results([null]))).toEqual({ text: null, spoken: null, tone: "none" });
  });

  it("carries one repository's counts: 22/24 failing", () => {
    expect(
      playwrightTabStatus(results([verifyFailure({ tests: { total: 24, passed: 22, failed: 2, failures: [], failuresTruncated: false } })])),
    ).toEqual({ text: "22/24", spoken: "22 of 24 browser tests passed", tone: "failed" });
  });

  it("sums the counts of every repository", () => {
    expect(playwrightTabStatus(results([verifyFailure(), VERIFY_API])).text).toBe("27/29");
    expect(playwrightTabStatus(results([VERIFY_API])).tone).toBe("passed");
  });

  it("says running while any repository's verify stage runs", () => {
    expect(playwrightTabStatus(results([verifyFailure(), { status: "running" }]))).toMatchObject({ text: "running", tone: "running" });
  });

  it("falls back to failing / passed when a stage sent no counts", () => {
    expect(playwrightTabStatus(results([{ status: "failure" }, VERIFY_API]))).toMatchObject({ text: "failing", tone: "failed" });
    expect(playwrightTabStatus(results([{ status: "success" }]))).toMatchObject({ text: "passed", tone: "passed" });
    expect(playwrightTabStatus(results([{ status: "cancelled" }])).text).toBeNull();
  });

  it("reads only the verify stage: a quality result alone says nothing", () => {
    const only = results([null]);
    only.repositories[0].automation = normalizeRunAutomation({ quality: qualitySuccess() });
    expect(playwrightTabStatus(only).text).toBeNull();
  });
});

describe("Playwright tab — which empty state shows", () => {
  it("loads, then needs a run, then says the server reports nothing, then shows results", () => {
    expect(playwrightPanelState({ ready: false, results: null })).toBe("loading");
    expect(playwrightPanelState({ ready: true, results: null })).toBe("no-run");
    expect(playwrightPanelState({ ready: true, results: projectPlaywrightResults(run()) })).toBe("unsupported");
    expect(playwrightPanelState({ ready: true, results: projectPlaywrightResults(withAutomation()) })).toBe("results");
  });

  it("has the copy the tab shows", () => {
    expect(notRunText("uat")).toBe("Playwright hasn't run on uat yet");
    expect(UNSUPPORTED_TEXT).toBe("This server doesn't report automated results.");
    expect(noRunText(true)).toMatch(/Project's QA run/);
    expect(noRunText(false)).toMatch(/a QA run/);
  });
});

describe("Playwright tab — Run Playwright on a Project run", () => {
  const started = normalizeProjectDispatch({
    dispatched: [
      { projectId: "proj-fe", repoFullName: "tone/storefront-web", ref: "uat", targetsRunCommit: true },
      { projectId: "proj-be", repoFullName: "tone/orders-api", ref: "uat", targetsRunCommit: false },
    ],
    failed: [{ projectId: "proj-x", repoFullName: "tone/admin", message: "This repository's pipeline has no verify workflow yet." }],
  });

  it("confirms where it started and warns about a moved head and a repository it could not reach", () => {
    expect(projectDispatchConfirmation(started)).toBe(
      "Playwright started on uat in storefront-web and orders-api. Results appear here when the runs report.",
    );
    expect(projectDispatchWarning(started)).toBe(
      "uat moved in orders-api since this run started — those results attach to the newer commit, not this run. Start a new Project run to verify it.",
    );
    expect(projectDispatchFailures(started)).toEqual(["admin — This repository's pipeline has no verify workflow yet."]);
    expect(projectDispatchConfirmation({ dispatched: [], failed: [] })).toBeNull();
    expect(projectDispatchWarning({ dispatched: started.dispatched.slice(0, 1), failed: [] })).toBeNull();
  });

  it("settles once every repository it started in reported since the dispatch", () => {
    const since = Date.parse("2026-09-25T06:00:00.000Z");
    const late = verifyFailure({ reportedAt: "2026-09-25T07:00:00.000Z" });
    const early = verifyFailure({ reportedAt: "2026-09-25T05:00:00.000Z" });
    const byRepo = (fe: unknown, be: unknown) =>
      run({
        automation: {},
        automationByRepository: [
          { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: { verify: fe } },
          { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: be } },
        ],
      });
    expect(projectVerifySettledSince(byRepo(late, early), ["proj-fe", "proj-be"], since)).toBe(false);
    expect(projectVerifySettledSince(byRepo(late, early), ["proj-fe"], since)).toBe(true);
    expect(projectVerifySettledSince(byRepo(late, late), ["proj-fe", "proj-be"], since)).toBe(true);
    expect(projectVerifySettledSince(run({ automation: { verify: late } }), ["proj-fe"], since)).toBe(true);
    expect(projectVerifySettledSince(run(), ["proj-fe"], since)).toBe(false);
  });

  it("names lists the way a sentence does", () => {
    expect(namesList([])).toBe("");
    expect(namesList(["a"])).toBe("a");
    expect(namesList(["a", "b", "c"])).toBe("a, b and c");
  });
});

describe("Studio column tabs — remembered choice", () => {
  it("keys the choice per studio and opens the Checklist for anything unknown", () => {
    expect(studioColumnTabKey("qa")).toBe("alphaci.qa-studio.column-tab");
    expect(studioColumnTabKey("po")).toBe("alphaci.po-studio.column-tab");
    expect(resolveStudioColumnTab("playwright")).toBe("playwright");
    expect(resolveStudioColumnTab(null)).toBe("checklist");
    expect(resolveStudioColumnTab("anything")).toBe("checklist");
  });
});
