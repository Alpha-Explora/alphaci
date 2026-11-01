import { groupRunsByBranch } from "@/features/runs/model/runs-rules";
import type { RunGroup } from "@/shared/api/contracts";

const run = (
  branch: string,
  startedAt: string,
  commitSha = "abc123",
): RunGroup => ({
  runId: 1,
  repoFullName: "org/repo",
  branch,
  commitSha,
  startedAt,
  overallStatus: "success",
  stages: [],
});

/** Branch names only, which is what every ordering assertion is about. */
const branchesOf = (groups: ReturnType<typeof groupRunsByBranch>) =>
  groups.map((group) => group.branch);

describe("groupRunsByBranch", () => {
  it("orders branches by the promotion flow, not alphabetically", () => {
    // Alphabetically this would be dev, main, uat — which reads backwards
    // against the direction the pipeline actually runs.
    const groups = groupRunsByBranch([
      run("main", "2026-09-09T10:00:00Z"),
      run("dev", "2026-09-09T09:00:00Z"),
      run("uat", "2026-09-09T08:00:00Z"),
    ]);

    expect(branchesOf(groups)).toEqual(["dev", "uat", "main"]);
  });

  it("keeps each branch's runs newest first", () => {
    const groups = groupRunsByBranch([
      run("dev", "2026-09-09T08:00:00Z", "older"),
      run("dev", "2026-09-09T10:00:00Z", "newer"),
    ]);

    const dev = groups.find((group) => group.branch === "dev");
    expect(dev?.runs.map((r) => r.commitSha)).toEqual(["newer", "older"]);
    expect(dev?.latestRun?.commitSha).toBe("newer");
  });

  it("keeps a branch outside the flow rather than dropping it", () => {
    // A connected repository may use its own conventions. Losing its runs
    // would be worse than showing them last.
    const groups = groupRunsByBranch([
      run("release/2026-09", "2026-09-09T10:00:00Z"),
      run("dev", "2026-09-09T09:00:00Z"),
    ]);

    expect(branchesOf(groups)).toEqual([
      "dev",
      "uat",
      "main",
      "release/2026-09",
    ]);
  });

  it("marks a branch outside the flow so the view can say so", () => {
    const groups = groupRunsByBranch([
      run("release/2026-09", "2026-09-09T10:00:00Z"),
    ]);

    const byBranch = new Map(groups.map((group) => [group.branch, group]));
    expect(byBranch.get("release/2026-09")?.isPipelineBranch).toBe(false);
    expect(byBranch.get("dev")?.isPipelineBranch).toBe(true);
  });

  it("orders two unknown branches by recency, after the flow", () => {
    const groups = groupRunsByBranch([
      run("hotfix", "2026-09-09T08:00:00Z"),
      run("spike", "2026-09-09T10:00:00Z"),
    ]);

    expect(branchesOf(groups)).toEqual([
      "dev",
      "uat",
      "main",
      "spike",
      "hotfix",
    ]);
  });
});

/*
 * An empty declared branch is information, not an absence to tidy away: it
 * means nothing has been promoted there yet. A section that silently vanishes
 * cannot state that, so a reader cannot tell "uat is clean" from "uat has
 * never been reached".
 *
 * The projects feature already draws this distinction for one project's GitHub
 * runs; the cross-project runs list now answers the question the same way.
 */
describe("groupRunsByBranch, a branch with nothing on it", () => {
  it("still returns the declared flow when there are no runs at all", () => {
    const groups = groupRunsByBranch([]);

    expect(branchesOf(groups)).toEqual(["dev", "uat", "main"]);
    expect(groups.every((group) => group.runs.length === 0)).toBe(true);
    expect(groups.every((group) => group.latestRun === null)).toBe(true);
  });

  it("keeps a declared branch that has recorded nothing", () => {
    // Work on dev, nothing promoted. uat and main must still be visible.
    const groups = groupRunsByBranch([run("dev", "2026-09-09T09:00:00Z")]);

    const byBranch = new Map(groups.map((group) => [group.branch, group]));
    expect(byBranch.get("uat")?.latestRun).toBeNull();
    expect(byBranch.get("main")?.latestRun).toBeNull();
    expect(byBranch.get("dev")?.latestRun).not.toBeNull();
  });

  it("never duplicates a branch that does have runs", () => {
    // The placeholders are added after the real groups; a branch appearing
    // twice would render its history twice.
    const groups = groupRunsByBranch([
      run("dev", "2026-09-09T09:00:00Z"),
      run("uat", "2026-09-09T08:00:00Z"),
      run("main", "2026-09-09T07:00:00Z"),
    ]);

    expect(branchesOf(groups)).toEqual(["dev", "uat", "main"]);
    expect(new Set(branchesOf(groups)).size).toBe(groups.length);
  });

  it("does not invent sections for undeclared branches", () => {
    // An absent `uat` is a fact about the pipeline. An absent `hotfix` is not,
    // because the product never promised one.
    const groups = groupRunsByBranch([run("dev", "2026-09-09T09:00:00Z")]);

    expect(branchesOf(groups)).not.toContain("hotfix");
    expect(groups).toHaveLength(3);
  });
});
