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

describe("groupRunsByBranch", () => {
  it("orders branches by the promotion flow, not alphabetically", () => {
    // Alphabetically this would be dev, main, uat — which reads backwards
    // against the direction the pipeline actually runs.
    const groups = groupRunsByBranch([
      run("main", "2026-09-09T10:00:00Z"),
      run("dev", "2026-09-09T09:00:00Z"),
      run("uat", "2026-09-09T08:00:00Z"),
    ]);

    expect(groups.map((g) => g.branch)).toEqual(["dev", "uat", "main"]);
  });

  it("keeps each branch's runs newest first", () => {
    const groups = groupRunsByBranch([
      run("dev", "2026-09-09T08:00:00Z", "older"),
      run("dev", "2026-09-09T10:00:00Z", "newer"),
    ]);

    expect(groups[0]?.runs.map((r) => r.commitSha)).toEqual(["newer", "older"]);
    expect(groups[0]?.latestRun.commitSha).toBe("newer");
  });

  it("keeps a branch outside the flow rather than dropping it", () => {
    // A connected repository may use its own conventions. Losing its runs
    // would be worse than showing them last.
    const groups = groupRunsByBranch([
      run("release/2026-09", "2026-09-09T10:00:00Z"),
      run("dev", "2026-09-09T09:00:00Z"),
    ]);

    expect(groups.map((g) => g.branch)).toEqual(["dev", "release/2026-09"]);
  });

  it("orders two unknown branches by recency", () => {
    const groups = groupRunsByBranch([
      run("hotfix", "2026-09-09T08:00:00Z"),
      run("spike", "2026-09-09T10:00:00Z"),
    ]);

    expect(groups.map((g) => g.branch)).toEqual(["spike", "hotfix"]);
  });

  it("returns nothing for no runs", () => {
    expect(groupRunsByBranch([])).toEqual([]);
  });
});
