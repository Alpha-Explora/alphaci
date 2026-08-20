import {
  STATUS_COLORS,
  STATUS_LABELS,
  groupRunsByProject,
  summarizeRuns,
  toUserError,
} from "../../../../../src/features/runs/model/runs-rules";
import type { RunGroup } from "../../../../../src/features/runs/model/runs-types";
import { ApiError } from "../../../../../src/lib/api/request";

/* These assertions were previously reachable only by rendering /runs and
 * inspecting the DOM: the grouping, the summary counts and the error mapping
 * all lived inside the 771-line route. */

function run(overrides: Partial<RunGroup> & { runId: string }): RunGroup {
  return {
    runId: overrides.runId,
    repoFullName: "acme/web",
    overallStatus: "success",
    startedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  } as RunGroup;
}

describe("groupRunsByProject", () => {
  it("returns nothing for no runs", () => {
    expect(groupRunsByProject([])).toEqual([]);
  });

  it("buckets runs by repository", () => {
    const grouped = groupRunsByProject([
      run({ runId: "1", repoFullName: "acme/web" }),
      run({ runId: "2", repoFullName: "acme/api" }),
      run({ runId: "3", repoFullName: "acme/web" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((g) => g.repoFullName).sort()).toEqual([
      "acme/api",
      "acme/web",
    ]);
    expect(
      grouped.find((g) => g.repoFullName === "acme/web")!.runs,
    ).toHaveLength(2);
  });

  it("sorts runs newest first inside a repository", () => {
    const [group] = groupRunsByProject([
      run({ runId: "old", startedAt: "2026-08-01T00:00:00.000Z" }),
      run({ runId: "new", startedAt: "2026-08-03T00:00:00.000Z" }),
      run({ runId: "mid", startedAt: "2026-08-02T00:00:00.000Z" }),
    ]);

    expect(group!.runs.map((r) => r.runId)).toEqual(["new", "mid", "old"]);
  });

  it("hoists the newest run of each repository as latestRun", () => {
    const [group] = groupRunsByProject([
      run({ runId: "old", startedAt: "2026-08-01T00:00:00.000Z" }),
      run({ runId: "new", startedAt: "2026-08-05T00:00:00.000Z" }),
    ]);

    expect(group!.latestRun.runId).toBe("new");
  });

  it("orders repositories by their most recent run", () => {
    const grouped = groupRunsByProject([
      run({
        runId: "a",
        repoFullName: "acme/stale",
        startedAt: "2026-08-01T00:00:00.000Z",
      }),
      run({
        runId: "b",
        repoFullName: "acme/fresh",
        startedAt: "2026-08-09T00:00:00.000Z",
      }),
    ]);

    expect(grouped.map((g) => g.repoFullName)).toEqual([
      "acme/fresh",
      "acme/stale",
    ]);
  });

  it("does not mutate the input array", () => {
    const runs = [
      run({ runId: "old", startedAt: "2026-08-01T00:00:00.000Z" }),
      run({ runId: "new", startedAt: "2026-08-05T00:00:00.000Z" }),
    ];
    const order = runs.map((r) => r.runId);

    groupRunsByProject(runs);

    expect(runs.map((r) => r.runId)).toEqual(order);
  });
});

describe("summarizeRuns", () => {
  it("reports zeroes and no latest run for an empty list", () => {
    const summary = summarizeRuns([]);

    expect(summary.total).toBe(0);
    expect(summary.latestRun).toBeNull();
    expect(summary.needsAttention).toBe(0);
    expect(summary.counts.success).toBe(0);
  });

  it("counts each status", () => {
    const summary = summarizeRuns([
      run({ runId: "1", overallStatus: "success" }),
      run({ runId: "2", overallStatus: "success" }),
      run({ runId: "3", overallStatus: "running" }),
      run({ runId: "4", overallStatus: "failure" }),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.counts.success).toBe(2);
    expect(summary.counts.running).toBe(1);
    expect(summary.counts.failure).toBe(1);
  });

  it("counts failure, partial and cancelled as needing attention", () => {
    const summary = summarizeRuns([
      run({ runId: "1", overallStatus: "failure" }),
      run({ runId: "2", overallStatus: "partial" }),
      run({ runId: "3", overallStatus: "cancelled" }),
      run({ runId: "4", overallStatus: "success" }),
      run({ runId: "5", overallStatus: "running" }),
    ]);

    expect(summary.needsAttention).toBe(3);
  });

  it("picks the newest run regardless of input order", () => {
    const summary = summarizeRuns([
      run({ runId: "mid", startedAt: "2026-08-02T00:00:00.000Z" }),
      run({ runId: "new", startedAt: "2026-08-04T00:00:00.000Z" }),
      run({ runId: "old", startedAt: "2026-08-01T00:00:00.000Z" }),
    ]);

    expect(summary.latestRun?.runId).toBe("new");
  });
});

describe("toUserError", () => {
  it("explains an expired session on 401", () => {
    expect(toUserError(new ApiError("nope", 401))).toMatch(/session expired/i);
  });

  it("explains missing access on 403", () => {
    expect(toUserError(new ApiError("nope", 403))).toMatch(/access/i);
  });

  it("explains an unconfigured repository on 404", () => {
    expect(toUserError(new ApiError("nope", 404))).toMatch(/set up for CI/i);
  });

  it("falls back to a generic message on other API errors", () => {
    expect(toUserError(new ApiError("boom", 500))).toMatch(
      /could not load pipeline runs/i,
    );
  });

  it("falls back to a generic message for non-API throws", () => {
    expect(toUserError(new Error("network down"))).toMatch(
      /could not load pipeline runs/i,
    );
    expect(toUserError("a string")).toMatch(/could not load pipeline runs/i);
  });

  it("never leaks the underlying error text", () => {
    const leaky = new ApiError("postgres: relation runs does not exist", 500);
    expect(toUserError(leaky)).not.toMatch(/postgres/);
  });
});

describe("status presentation maps", () => {
  it("labels and colours every run status", () => {
    const statuses = [
      "success",
      "failure",
      "running",
      "cancelled",
      "partial",
    ] as const;

    for (const status of statuses) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_COLORS[status]).toMatch(/^var\(--/);
    }
  });
});
