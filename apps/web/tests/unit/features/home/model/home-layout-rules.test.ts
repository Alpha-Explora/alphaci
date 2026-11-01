import {
  HOME_SHORTCUTS,
  dashboardShortcutHref,
  homeBlockState,
  homeLayoutFor,
  homeMetricsLoading,
  homeShortcutHref,
} from "../../../../../src/features/home/model/home-layout-rules";
import type { HomeSectionStates } from "../../../../../src/features/home/model/home-persona-types";
import type { AppRole } from "../../../../../src/features/home/model/home-types";

type Row = [AppRole | undefined, boolean, string, string[], string[], string[], string[]];

/* The role table: persona, metrics, main blocks, side blocks, shortcuts. */
const TABLE: Row[] = [
  [
    "member",
    true,
    "developer",
    ["scope-projects", "returned", "in-progress", "failing-runs", "success-rate"],
    ["returned-by-qa", "scoped-runs"],
    ["my-work", "quality"],
    ["add-repository", "projects", "runs"],
  ],
  [
    "member",
    false,
    "developer",
    ["scope-projects", "repositories", "running", "failing-runs", "success-rate"],
    ["scoped-runs", "branch-health"],
    ["my-work", "quality"],
    ["add-repository", "projects", "runs"],
  ],
  [
    "qa",
    true,
    "qa",
    ["in-verification", "pending-items", "failed-or-blocked", "ready-for-retest", "uat-pass-rate"],
    ["projects-in-verification", "uat-automation"],
    ["ready-for-retest", "defects"],
    ["projects", "runs"],
  ],
  ["qa", false, "team", [], [], [], ["create-project", "projects", "runs"]],
  [
    "lead",
    true,
    "product-owner",
    ["projects", "awaiting-promotion", "need-attention", "failing-branches", "success-rate"],
    ["ready-for-production", "branch-health"],
    ["needs-attention", "quality"],
    ["create-project", "projects", "runs"],
  ],
  [
    "lead",
    false,
    "product-owner",
    ["projects", "repositories", "running", "failing-branches", "success-rate"],
    ["team-runs", "branch-health"],
    ["team-projects", "quality"],
    ["create-project", "projects", "runs"],
  ],
  [
    "admin",
    true,
    "product-owner",
    ["projects", "awaiting-promotion", "need-attention", "failing-branches", "success-rate"],
    ["ready-for-production", "branch-health"],
    ["needs-attention", "quality"],
    ["create-project", "projects", "runs"],
  ],
  [undefined, true, "team", [], [], [], ["create-project", "projects", "runs"]],
];

describe("homeLayoutFor (role table)", () => {
  it.each(TABLE)("%s, QA %s: the %s Home", (appRole, qa, persona, metrics, main, side, shortcuts) => {
    const layout = homeLayoutFor({ appRole, qaChecklistsEnabled: qa });
    expect(layout.persona).toBe(persona);
    expect(layout.metrics).toEqual(metrics);
    expect(layout.main).toEqual(main);
    expect(layout.side).toEqual(side);
    expect(layout.shortcuts).toEqual(shortcuts);
  });

  it("keeps every role's Home within one screen's budget", () => {
    for (const [appRole, qa] of TABLE) {
      const layout = homeLayoutFor({ appRole, qaChecklistsEnabled: qa });
      expect(layout.metrics.length).toBeLessThanOrEqual(5);
      expect(layout.main.length).toBeLessThanOrEqual(2);
      expect(layout.side.length).toBeLessThanOrEqual(2);
    }
  });

  it("drops the QA blocks, and the QA read, with the capability off", () => {
    for (const appRole of ["member", "lead", "admin"] as const) {
      const on = homeLayoutFor({ appRole, qaChecklistsEnabled: true });
      const off = homeLayoutFor({ appRole, qaChecklistsEnabled: false });
      expect([on.qa, on.needs.qaOverview]).toEqual([true, true]);
      expect([off.qa, off.needs.qaOverview]).toEqual([false, false]);
    }
  });

  it("reads only what each Home shows: the team walk and Activity for the team dashboard alone", () => {
    expect(homeLayoutFor({ appRole: "member", qaChecklistsEnabled: true }).needs).toEqual({
      history: false,
      workspace: false,
      folders: true,
      qaOverview: true,
    });
    expect(homeLayoutFor({ appRole: "qa", qaChecklistsEnabled: true }).needs.workspace).toBe(false);
    expect(homeLayoutFor({ appRole: "lead", qaChecklistsEnabled: true }).needs).toEqual({
      history: true,
      workspace: false,
      folders: true,
      qaOverview: true,
    });
    expect(homeLayoutFor({ appRole: undefined, qaChecklistsEnabled: true }).needs).toEqual({
      history: true,
      workspace: true,
      folders: false,
      qaOverview: false,
    });
  });
});

describe("keyboard shortcuts", () => {
  const dev = homeLayoutFor({ appRole: "member", qaChecklistsEnabled: true }).shortcuts;
  const qa = homeLayoutFor({ appRole: "qa", qaChecklistsEnabled: true }).shortcuts;
  const po = homeLayoutFor({ appRole: "lead", qaChecklistsEnabled: true }).shortcuts;

  it("sends a Developer's N to Add repository, scoped to the team", () => {
    expect(dashboardShortcutHref("n", dev, "ws-1")).toBe("/workflows?tab=setup&group=ws-1");
  });

  it("sends a Product owner's N to Create project, New Project open", () => {
    expect(dashboardShortcutHref("n", po, "ws-1")).toBe("/workflows?group=ws-1&new=project");
  });

  it("gives the QA Team no N", () => {
    expect(dashboardShortcutHref("n", qa, "ws-1")).toBeNull();
  });

  it("keeps W and R for every role, and ignores other keys", () => {
    for (const shortcuts of [dev, qa, po]) {
      expect(dashboardShortcutHref("w", shortcuts, "ws-1")).toBe("/workflows?tab=current");
      expect(dashboardShortcutHref("r", shortcuts, "ws-1")).toBe("/runs");
      expect(dashboardShortcutHref("x", shortcuts, "ws-1")).toBeNull();
    }
  });

  it("falls back to the unscoped wizard with no team selected", () => {
    expect(homeShortcutHref("add-repository", null)).toBe("/workflows?tab=setup");
    expect(homeShortcutHref("create-project", null)).toBe("/workflows?new=project");
  });

  it("labels every shortcut", () => {
    expect(Object.values(HOME_SHORTCUTS).map((shortcut) => `${shortcut.key}:${shortcut.label}`)).toEqual([
      "n:Add repository",
      "n:Create Project",
      "w:View Projects",
      "r:View Runs",
    ]);
  });
});

describe("block states", () => {
  const ready = { status: "ready" as const, error: null };
  const states = (overrides: Partial<HomeSectionStates> = {}): HomeSectionStates => ({
    projects: ready,
    runs: ready,
    folders: ready,
    qaOverview: ready,
    ...overrides,
  });

  it("waits on every source a block reads", () => {
    const loadingQa = states({ qaOverview: { status: "loading", error: null } });
    expect(homeBlockState("scoped-runs", loadingQa).loading).toBe(true);
    expect(homeBlockState("uat-automation", loadingQa).loading).toBe(false);
    expect(homeMetricsLoading(loadingQa)).toBe(true);
    expect(homeMetricsLoading(states())).toBe(false);
  });

  it("fails a block only on its own source", () => {
    const qaFailed = states({ qaOverview: { status: "error", error: "Could not load QA progress." } });
    expect(homeBlockState("returned-by-qa", qaFailed).error).toBe("Could not load QA progress.");
    // Runs still show, team-wide, when the scope could not be read.
    expect(homeBlockState("scoped-runs", qaFailed).error).toBeNull();
    expect(homeBlockState("my-work", qaFailed).error).toBeNull();
  });
});
