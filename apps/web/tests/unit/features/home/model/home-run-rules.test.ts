import {
  branchHealth,
  failingBranchCount,
  failureStreak,
  latestRunByRepo,
  latestRunFor,
  repoKeysOf,
  repoProjectIds,
  runTone,
  runsFailuresFirst,
  runsInScope,
  runsNewestFirst,
  uatAutomationRows,
  uatRuns,
} from "../../../../../src/features/home/model/home-run-rules";
import { FOLDERS, PROVISIONED, RUNS, run } from "../home-persona-fixtures";

const ids = repoProjectIds(FOLDERS, PROVISIONED);

describe("runs in scope", () => {
  it("narrows My Projects to their repositories, ignoring case", () => {
    const shop = [{ ...FOLDERS[0], repositories: FOLDERS[0].repositories.map((r) => ({ ...r, repoFullName: r.repoFullName!.toUpperCase() })) }];
    const scoped = runsInScope(RUNS, { mode: "mine", projectIds: ["dp-shop"] }, shop);
    expect(new Set(scoped.map((entry) => entry.repoFullName))).toEqual(new Set(["acme/shop-fe", "acme/shop-be"]));
  });

  it("keeps every team run, filed or not, for a team-wide scope", () => {
    expect(runsInScope(RUNS, { mode: "fallback", projectIds: [] }, [])).toHaveLength(RUNS.length);
    expect(runsInScope(RUNS, { mode: "team", projectIds: [] }, [])).toHaveLength(RUNS.length);
  });

  it("lists the repositories filed under Projects", () => {
    expect(repoKeysOf(FOLDERS)).toEqual(new Set(["acme/shop-be", "acme/shop-fe", "acme/pay-be"]));
  });

  it("orders failures first, and newest first", () => {
    expect(runsFailuresFirst(RUNS).slice(0, 3).map((entry) => entry.overallStatus)).toEqual(["failure", "failure", "failure"]);
    const shuffled = [RUNS[3], RUNS[0], RUNS[1]];
    expect(runsNewestFirst(shuffled)).toEqual([RUNS[0], RUNS[1], RUNS[3]]);
  });
});

describe("latest run per repository", () => {
  it("keeps the newest run of each repository on any branch", () => {
    const latest = latestRunByRepo(RUNS);
    expect(latestRunFor(latest, "ACME/Shop-FE")?.branch).toBe("dev");
    expect(latestRunFor(latest, "acme/shop-be")?.branch).toBe("main");
    expect(latestRunFor(latest, null)).toBeUndefined();
  });

  it("maps statuses to dots", () => {
    expect(runTone(undefined)).toBe("none");
    expect(runTone(run("x", "dev", "partial", "2026-10-13T00:00:00Z"))).toBe("warning");
    expect(runTone(run("x", "dev", "cancelled", "2026-10-13T00:00:00Z"))).toBe("warning");
    expect(runTone(run("x", "dev", "success", "2026-10-13T00:00:00Z"))).toBe("success");
  });

  it("finds each repository's ALPHACI project from the Projects list, then the provisioned projects", () => {
    expect(ids.get("acme/shop-fe")).toBe("p-shop-fe");
    expect(ids.get("acme/other-api")).toBe("p-other");
  });
});

describe("branchHealth (Product owner)", () => {
  const rows = branchHealth(RUNS, FOLDERS, ids);

  it("lays every repository out by dev / uat / main, failing first", () => {
    expect(rows.map((row) => [row.repoFullName, row.cells.dev, row.cells.uat, row.cells.main, row.failureStreak])).toEqual([
      ["acme/shop-fe", "failure", "success", "none", 1],
      ["acme/pay-be", "running", "failure", "none", 0],
      ["acme/other-api", "none", "success", "none", 0],
      ["acme/shop-be", "none", "none", "success", 0],
    ]);
    expect(rows[0].href).toBe("/projects/p-shop-fe");
  });

  it("adds a filed repository with no runs yet, with no link when it has no project", () => {
    const withIdle = branchHealth([], [{ ...FOLDERS[2], repositories: [{ ...FOLDERS[1].repositories[0], repoFullName: "acme/idle", project: null }] }], new Map());
    expect(withIdle).toEqual([
      { repoFullName: "acme/idle", cells: { dev: "none", uat: "none", main: "none" }, failureStreak: 0, href: null },
    ]);
  });

  it("skips a malformed run with no repository name", () => {
    const nameless = { ...run("x", "dev", "failure", "2026-10-13T11:00:00Z"), repoFullName: undefined as unknown as string };
    expect(branchHealth([nameless, ...RUNS], FOLDERS, ids)).toEqual(rows);
  });

  it("counts failing branch cells", () => {
    expect(failingBranchCount(rows)).toBe(2);
  });

  it("counts a failure streak from the newest run", () => {
    const failing = run("a", "dev", "failure", "2026-10-13T00:00:00Z");
    const passing = run("a", "dev", "success", "2026-10-12T00:00:00Z");
    expect(failureStreak([failing, failing, passing, failing])).toBe(2);
    expect(failureStreak([passing, failing])).toBe(0);
  });
});

describe("uatAutomationRows (QA Team)", () => {
  it("takes the newest uat run of each repository with its verify stage, failing first", () => {
    const rows = uatAutomationRows(RUNS, ids);
    expect(rows.map((row) => [row.repoFullName, row.verify, row.tests?.passed ?? null, row.href])).toEqual([
      ["acme/pay-be", "failure", 3, "/projects/p-pay-be"],
      ["acme/shop-fe", "success", 48, "/projects/p-shop-fe"],
      ["acme/other-api", "pending", null, "/projects/p-other"],
    ]);
  });

  it("links a repository with no ALPHACI project to the runs page", () => {
    const [row] = uatAutomationRows([run("lost", "uat", "success", "2026-10-13T00:00:00Z")], new Map());
    expect(row.href).toBe("/runs");
    expect(row.tests).toBeNull();
  });

  it("selects uat runs only", () => {
    expect(uatRuns(RUNS).every((entry) => entry.branch === "uat")).toBe(true);
  });
});
