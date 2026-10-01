import {
  computeRunStats,
  connectorTone,
  isEmptyWorkspace,
  projectBadgeLabel,
  projectTone,
  runsForTeam,
  shortRepoName,
  timeAgo,
} from "../../../../../src/features/home/model/home-rules";
import type { RunGroup } from "../../../../../src/features/home/model/home-types";

/* All of this came out of a 1,492-line route where the only way to assert it was
 * to render the dashboard and read the DOM. */

function run(
  status: RunGroup["overallStatus"],
  stages: Array<{ stage: "access" | "quality" | "package"; status: string }> = [],
): RunGroup {
  return { overallStatus: status, stages } as unknown as RunGroup;
}

describe("timeAgo", () => {
  const now = new Date("2026-08-21T12:00:00.000Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("says just now under a minute", () => {
    expect(timeAgo(ago(30_000), now)).toBe("just now");
  });

  it("counts whole minutes under an hour", () => {
    expect(timeAgo(ago(12 * 60_000), now)).toBe("12m ago");
    expect(timeAgo(ago(59 * 60_000), now)).toBe("59m ago");
  });

  it("switches to hours at 60 minutes", () => {
    expect(timeAgo(ago(60 * 60_000), now)).toBe("1h ago");
    expect(timeAgo(ago(23 * 3_600_000), now)).toBe("23h ago");
  });

  it("switches to days at 24 hours", () => {
    expect(timeAgo(ago(24 * 3_600_000), now)).toBe("1d ago");
    expect(timeAgo(ago(9 * 24 * 3_600_000), now)).toBe("9d ago");
  });
});

describe("shortRepoName", () => {
  it("takes the repo half of owner/name", () => {
    expect(shortRepoName("acme/orders-api")).toBe("orders-api");
  });

  it("falls back to the whole string when there is no slash", () => {
    expect(shortRepoName("orders-api")).toBe("orders-api");
  });

  it("has a label for null and undefined", () => {
    expect(shortRepoName(null)).toBe("Repository");
    expect(shortRepoName(undefined)).toBe("Repository");
  });
});

describe("projectTone / projectBadgeLabel", () => {
  it("maps each status to a tone", () => {
    expect(projectTone("provisioned")).toBe("ok");
    expect(projectTone("provisioning")).toBe("warn");
    expect(projectTone("failed")).toBe("danger");
    expect(projectTone("orphaned")).toBe("muted");
  });

  it("maps each status to a label", () => {
    expect(projectBadgeLabel("provisioned")).toBe("Active");
    expect(projectBadgeLabel("provisioning")).toBe("Provisioning");
    expect(projectBadgeLabel("failed")).toBe("Failed");
    expect(projectBadgeLabel("orphaned")).toBe("Idle");
  });
});

describe("connectorTone", () => {
  it("goes danger into any failing stage, whatever preceded it", () => {
    expect(connectorTone("success", "failure")).toBe("danger");
    expect(connectorTone("pending", "failure")).toBe("danger");
  });

  it("stays success only while progress holds", () => {
    expect(connectorTone("success", "success")).toBe("success");
  });

  it("flows into a running stage from a completed one", () => {
    expect(connectorTone("success", "running")).toBe("flowing");
  });

  it("is pending when the previous stage has not succeeded", () => {
    expect(connectorTone("pending", "running")).toBe("pending");
    expect(connectorTone("running", "pending")).toBe("pending");
  });
});

describe("computeRunStats", () => {
  it("reports nothing for no runs", () => {
    const s = computeRunStats([]);
    expect(s.successRate).toBeNull();
    expect(s.finishedCount).toBe(0);
    expect(s.worstStage).toBeNull();
    expect(s.failureStreak).toBe(0);
    expect(s.outcomes).toEqual([]);
  });

  it("excludes running runs from the success rate", () => {
    // 1 success, 1 failure finished -> 50%. The running one must not dilute it.
    const s = computeRunStats([
      run("running"),
      run("success"),
      run("failure"),
    ]);
    expect(s.successRate).toBe(50);
    expect(s.finishedCount).toBe(2);
    expect(s.running).toBe(1);
  });

  it("returns null rather than zero when every run is still running", () => {
    const s = computeRunStats([run("running"), run("running")]);
    expect(s.successRate).toBeNull();
  });

  it("samples only the newest ten for the rate", () => {
    const runs = [...Array(10)].map(() => run("success")).concat(run("failure"));
    const s = computeRunStats(runs);
    expect(s.sample).toHaveLength(10);
    expect(s.successRate).toBe(100); // the 11th, a failure, is outside the window
  });

  it("counts running across the whole list, not just the sample", () => {
    const runs = [...Array(10)].map(() => run("success")).concat(run("running"));
    expect(computeRunStats(runs).running).toBe(1);
  });

  it("names the stage that failed most often", () => {
    const s = computeRunStats([
      run("failure", [{ stage: "quality", status: "failure" }]),
      run("failure", [{ stage: "quality", status: "failure" }]),
      run("failure", [{ stage: "access", status: "failure" }]),
    ]);
    expect(s.worstStage).toEqual({ stage: "quality", count: 2 });
  });

  it("has no worst stage when nothing failed at stage level", () => {
    const s = computeRunStats([
      run("success", [{ stage: "quality", status: "success" }]),
    ]);
    expect(s.worstStage).toBeNull();
  });

  it("counts the failure streak from the most recent run only", () => {
    expect(
      computeRunStats([run("failure"), run("failure"), run("success"), run("failure")])
        .failureStreak,
    ).toBe(2);
  });

  it("reports a zero streak when the newest run succeeded", () => {
    expect(computeRunStats([run("success"), run("failure")]).failureStreak).toBe(0);
  });

  it("keeps every outcome for the sparkline, beyond the sample window", () => {
    const runs = [...Array(12)].map(() => run("success"));
    expect(computeRunStats(runs).outcomes).toHaveLength(12);
  });
});

describe("isEmptyWorkspace", () => {
  const base = { loading: false, projectCount: 0, deliveryProjectCount: 0 };

  it("is empty for a team with no projects, whatever runs arrived", () => {
    expect(isEmptyWorkspace(base)).toBe(true);
  });

  it("is not empty while loading, or with a project or delivery project", () => {
    expect(isEmptyWorkspace({ ...base, loading: true })).toBe(false);
    expect(isEmptyWorkspace({ ...base, projectCount: 1 })).toBe(false);
    expect(isEmptyWorkspace({ ...base, deliveryProjectCount: 2 })).toBe(false);
  });
});

describe("runsForTeam", () => {
  const runs = [run("failure"), run("success")];
  const project = { id: "p1" } as never;

  it("drops other teams' runs when the team has no projects", () => {
    expect(runsForTeam(runs, [], true)).toEqual([]);
  });

  it("keeps the runs when the team has projects", () => {
    expect(runsForTeam(runs, [project], true)).toBe(runs);
  });

  it("keeps the runs while projects have not loaded", () => {
    expect(runsForTeam(runs, [], false)).toBe(runs);
  });

  it("does not count other teams' runs in the stats of an empty team", () => {
    expect(computeRunStats(runsForTeam(runs, [], true)).failureStreak).toBe(0);
  });
});
