import { homeLayoutFor } from "../../../../../src/features/home/model/home-layout-rules";
import {
  addRepositoryHref,
  buildPersonaDashboard,
  createProjectHref,
} from "../../../../../src/features/home/model/home-persona-dashboard";
import type { HomeMetric } from "../../../../../src/features/home/model/home-persona-types";
import type { AppRole, TeamQaOverview } from "../../../../../src/features/home/model/home-types";
import { PAY, PROVISIONED, RUNS, SHOP, LOYALTY, olderOverview, overview, snapshot } from "../home-persona-fixtures";

function build(appRole: AppRole, qa: boolean, qaOverview: TeamQaOverview | null = overview(), groupId: string | null = "ws-1") {
  return buildPersonaDashboard({
    layout: homeLayoutFor({ appRole, qaChecklistsEnabled: qa }),
    groupId,
    folders: snapshot(),
    overview: qaOverview,
    teamRuns: RUNS,
    projects: PROVISIONED,
  });
}

function values(metrics: HomeMetric[]) {
  return metrics.map((metric) => [metric.label, metric.value, metric.suffix]);
}

describe("buildPersonaDashboard: Developer", () => {
  it("covers my Projects: their returned items, runs (failures first) and repositories", () => {
    const home = build("member", true);
    expect(home.scope).toEqual({ mode: "mine", projectIds: ["dp-shop"] });
    expect(home.fallbackLine).toBeNull();
    expect(values(home.metrics)).toEqual([
      ["My Projects", 1, ""],
      ["Returned by QA", 2, ""],
      ["In progress", 1, ""],
      ["Failing runs", 2, ""],
      ["Success rate", 50, "%"],
    ]);
    expect(home.returned.map((row) => row.name)).toEqual(["Storefront"]);
    expect(home.runs.map((entry) => entry.overallStatus)).toEqual(["failure", "failure", "success", "success"]);
    expect(new Set(home.runs.map((entry) => entry.repoFullName))).toEqual(new Set(["acme/shop-fe", "acme/shop-be"]));
    expect(home.myWork.map((project) => project.name)).toEqual(["Storefront"]);
    expect(home.addRepositoryHref).toBe("/workflows?tab=setup&group=ws-1&project=dp-shop");
  });

  it("falls back to the team, and says so, when the Developer is in no Project", () => {
    const nobody = overview([SHOP, PAY, LOYALTY].map((project) => ({ ...project, viewerMembership: null })));
    const home = build("member", true, nobody);
    expect(home.scope.mode).toBe("fallback");
    expect(home.fallbackLine).toBe("Your Product owner hasn't added you to a Project yet.");
    expect(home.metrics[0]).toMatchObject({ label: "Team Projects", value: 3 });
    expect(home.runs).toHaveLength(RUNS.length);
    expect(home.addRepositoryHref).toBe("/workflows?tab=setup&group=ws-1");
  });

  it("keeps a run-based Home with the QA capability off", () => {
    const home = build("member", false, null);
    expect(home.scope.mode).toBe("team");
    expect(home.fallbackLine).toBeNull();
    expect(values(home.metrics)).toEqual([
      ["Team Projects", 3, ""],
      ["Repositories", 3, ""],
      ["Running", 1, ""],
      ["Failing runs", 3, ""],
      ["Success rate", 50, "%"],
    ]);
    expect(home.branchHealth).toHaveLength(4);
  });

  it("shows dashes for QA metrics it could not read", () => {
    const home = build("member", true, null);
    expect(home.metrics.find((metric) => metric.id === "returned")?.value).toBeNull();
    expect(home.metrics.find((metric) => metric.id === "in-progress")?.value).toBeNull();
  });
});

describe("buildPersonaDashboard: QA Team", () => {
  it("covers the Projects I verify, with the team's uat automation", () => {
    const home = build("qa", true);
    expect(home.scope).toEqual({ mode: "mine", projectIds: ["dp-pay"] });
    expect(values(home.metrics)).toEqual([
      ["In verification", 0, ""],
      ["Pending items", 0, ""],
      ["Failed or blocked", 0, ""],
      ["Ready for re-test", 0, ""],
      ["UAT pass rate", 67, "%"],
    ]);
    expect(home.verification.map((row) => row.name)).toEqual(["Payments"]);
    expect(home.uatAutomation).toHaveLength(3);
    expect(home.retest).toEqual([]);
    expect(home.defects).toEqual({ blocker: 0, major: 1, minor: 0, unrated: 1 });
  });

  it("falls back to the team with its own line", () => {
    const nobody = overview([SHOP, PAY, LOYALTY].map((project) => ({ ...project, viewerMembership: null })));
    const home = build("qa", true, nobody);
    expect(home.fallbackLine).toBe("You haven't been added to a Project as QA yet.");
    expect(home.metrics.map((metric) => metric.value)).toEqual([1, 2, 2, 2, 67]);
  });

  it("dashes Ready for re-test on an older backend", () => {
    const home = build("qa", true, olderOverview());
    expect(home.metrics.find((metric) => metric.id === "ready-for-retest")?.value).toBeNull();
    expect(home.retest).toBeNull();
    expect(home.defects).toBeNull();
  });
});

describe("buildPersonaDashboard: Product owner", () => {
  it("covers the whole team: what can ship, what is stuck, branch health", () => {
    const home = build("lead", true);
    expect(home.scope.mode).toBe("team");
    expect(values(home.metrics)).toEqual([
      ["Projects", 3, ""],
      ["Awaiting promotion", 1, ""],
      ["Need attention", 1, ""],
      ["Failing branches", 2, ""],
      ["Success rate", 50, "%"],
    ]);
    expect(home.production.ready.map((row) => row.name)).toEqual(["Payments"]);
    expect(home.needsAttention.map((row) => row.name)).toEqual(["Payments"]);
    expect(home.createProjectHref).toBe("/workflows?group=ws-1&new=project");
  });

  it("dashes Awaiting promotion when the backend sent no latestRun", () => {
    const home = build("admin", true, olderOverview());
    expect(home.production.mode).toBe("legacy");
    expect(home.metrics.find((metric) => metric.id === "awaiting-promotion")?.value).toBeNull();
  });
});

describe("block actions", () => {
  const scope = { mode: "mine" as const, projectIds: ["dp-1"] };

  it("hides Add repository when the server says the caller may not create one, or with no team", () => {
    expect(addRepositoryHref(snapshot([], { canCreateRepository: false }), scope, "ws-1")).toBeNull();
    expect(addRepositoryHref(snapshot(), scope, null)).toBeNull();
    expect(addRepositoryHref(null, scope, "ws-1")).toBe("/workflows?tab=setup&group=ws-1&project=dp-1");
    expect(addRepositoryHref(snapshot([], { canCreateRepository: true }), { mode: "team", projectIds: ["a", "b"] }, "ws-1")).toBe(
      "/workflows?tab=setup&group=ws-1",
    );
  });

  it("hides Create project only when the server says no", () => {
    expect(createProjectHref(snapshot([], { canCreateProject: false }), "ws-1")).toBeNull();
    expect(createProjectHref(null, "ws-1")).toBe("/workflows?group=ws-1&new=project");
  });

  it("builds without a team selected", () => {
    const home = build("member", true, null, null);
    expect(home.addRepositoryHref).toBeNull();
  });
});
