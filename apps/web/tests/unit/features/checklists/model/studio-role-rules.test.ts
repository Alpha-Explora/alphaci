import {
  playwrightTabStatus,
  projectPlaywrightResults,
  type PlaywrightResults,
} from "../../../../../src/features/checklists/model/playwright-tab-rules";
import { normalizeProjectRunCurrent } from "../../../../../src/features/checklists/model/project-run-rules";
import { qaScopeFromFolder, withProjectOnPage } from "../../../../../src/features/checklists/model/qa-scope";
import {
  liveRepositories,
  runsBrowserTests,
  scopePlaywrightResults,
  studioColumnRules,
  visibleStages,
  type RepositoryRoles,
} from "../../../../../src/features/checklists/model/studio-role-rules";
import { automated, automation, qualitySuccess, verifyFailure } from "../qa-automation-fixtures";
import { projectRunWire, runItemWire } from "../requirement-fixtures";

const ROLES: RepositoryRoles = { "proj-fe": "frontend", "proj-be": "backend" };

const API_VERIFY = verifyFailure({
  status: "success",
  tests: { total: 9, passed: 9, failed: 0, failures: [], failuresTruncated: false },
});

/** A Project run: a frontend (18/20 browser tests) and a backend (9/9 API tests), both with unit tests. */
function results(): PlaywrightResults {
  const run = normalizeProjectRunCurrent({
    run: projectRunWire({
      automation: automation(),
      automationByRepository: [
        { projectId: "proj-fe", repoFullName: "tone/storefront-web", automation: automation() },
        { projectId: "proj-be", repoFullName: "tone/orders-api", automation: { verify: API_VERIFY, quality: qualitySuccess() } },
      ],
      items: [
        runItemWire({ id: "i-browser", title: "Pays with a saved card", automated: automated() }),
        runItemWire({ id: "i-unit", position: 1, title: "Totals round", automated: automated({ source: "unit_test", stage: "quality", status: "passed", failure: null }) }),
        runItemWire({ id: "i-api", position: 2, title: "Orders API answers", automated: automated({ source: "bruno", stage: "verify", status: "passed", failure: null }) }),
        runItemWire({ id: "i-unsaid", position: 3, title: "Home loads", automated: automated({ source: undefined, stage: undefined, status: "passed", failure: null }) }),
      ],
    }),
  }).run!;
  return projectPlaywrightResults(run);
}

describe("studioColumnRules — who sees what", () => {
  it("gives a Team lead no tabs and no Playwright tab (so no Run Playwright)", () => {
    expect(studioColumnRules("lead")).toEqual({ tabs: false, playwright: false, browserOnly: false });
  });

  it("gives the QA Team both tabs, browser tests only", () => {
    expect(studioColumnRules("qa")).toEqual({ tabs: true, playwright: true, browserOnly: true });
  });

  it.each(["admin", "member", null, undefined] as const)("keeps the full view for %s", (role) => {
    expect(studioColumnRules(role)).toEqual({ tabs: true, playwright: true, browserOnly: false });
  });

  it("draws the verify stage only for browser-only viewers", () => {
    expect(visibleStages(studioColumnRules("qa"))).toEqual(["verify"]);
    expect(visibleStages(studioColumnRules("admin"))).toEqual(["verify", "quality"]);
  });
});

describe("runsBrowserTests — how backend repositories are told apart", () => {
  it("says no only for the server's backend role", () => {
    expect(runsBrowserTests("backend")).toBe(false);
    expect(runsBrowserTests("frontend")).toBe(true);
  });

  it.each(["app", "service", null, undefined] as const)("keeps %s listed: it cannot be told apart", (role) => {
    expect(runsBrowserTests(role)).toBe(true);
  });
});

describe("scopePlaywrightResults", () => {
  it("leaves an admin's results untouched", () => {
    const all = results();
    expect(scopePlaywrightResults(all, studioColumnRules("admin"), ROLES)).toBe(all);
    expect(scopePlaywrightResults(null, studioColumnRules("qa"), ROLES)).toBeNull();
  });

  it("drops the backend repository and every Quality stage for the QA Team", () => {
    const scoped = scopePlaywrightResults(results(), studioColumnRules("qa"), ROLES)!;
    expect(scoped.repositories.map((repository) => repository.name)).toEqual(["storefront-web"]);
    expect(scoped.repositories[0].automation.quality).toBeNull();
    expect(scoped.repositories[0].automation.verify?.tests?.total).toBe(20);
  });

  it("keeps only browser-test requirements: no unit or API tests; an unnamed source on verify stays", () => {
    const scoped = scopePlaywrightResults(results(), studioColumnRules("qa"), ROLES)!;
    expect(scoped.items.map((row) => row.id)).toEqual(["i-browser", "i-unsaid"]);
  });

  it("counts browser tests only on the tab label", () => {
    expect(playwrightTabStatus(results()).text).toBe("27/29");
    const scoped = scopePlaywrightResults(results(), studioColumnRules("qa"), ROLES);
    expect(playwrightTabStatus(scoped)).toEqual({
      text: "18/20",
      spoken: "18 of 20 browser tests passed",
      tone: "failed",
    });
  });

  it("keeps every repository when roles are not known (an older backend, outside a Project)", () => {
    const scoped = scopePlaywrightResults(results(), studioColumnRules("qa"), {})!;
    expect(scoped.repositories).toHaveLength(2);
    expect(scoped.repositories.every((repository) => repository.automation.quality === null)).toBe(true);
  });

  it("keeps the server's merged result but narrows the repositories it draws checks for", () => {
    const run = normalizeProjectRunCurrent({ run: projectRunWire({ automation: automation(), automationByRepository: [] }) }).run!;
    const scoped = scopePlaywrightResults(projectPlaywrightResults(run), studioColumnRules("qa"), ROLES)!;
    expect(scoped.repositories).toHaveLength(1);
    expect(scoped.repositories[0].projectId).toBeNull();
    expect(scoped.repositories[0].checks.map((ref) => ref.projectId)).toEqual(["proj-fe"]);
  });
});

describe("liveRepositories", () => {
  it("follows each browser repository once, by its short name", () => {
    expect(liveRepositories(results().repositories, ROLES)).toEqual([{ projectId: "proj-fe", name: "storefront-web" }]);
    expect(liveRepositories(results().repositories, {})).toEqual([
      { projectId: "proj-fe", name: "storefront-web" },
      { projectId: "proj-be", name: "orders-api" },
    ]);
  });
});

describe("qaScopeFromFolder — repository roles", () => {
  it("carries each linked repository's role into a Project scope, and keeps it on the page", () => {
    const scope = qaScopeFromFolder("ready", {
      deliveryProjectId: "dp-1",
      name: "storefront",
      href: null,
      repositories: [
        { projectId: "proj-fe", role: "frontend" },
        { projectId: "proj-be", role: "backend" },
        { projectId: null, role: "service" },
      ],
    });
    expect(scope).toMatchObject({ kind: "project", repositoryRoles: { "proj-fe": "frontend", "proj-be": "backend" } });
    expect(withProjectOnPage(scope)).toMatchObject({ repositoryRoles: { "proj-be": "backend" } });
  });

  it("knows no roles when the folder sent none", () => {
    const scope = qaScopeFromFolder("ready", { deliveryProjectId: "dp-1", name: "storefront", href: null });
    expect(scope).toMatchObject({ kind: "project", repositoryRoles: {} });
  });
});
