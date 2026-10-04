import {
  annotationLocation,
  annotationTone,
  checkHasDetail,
  checkStartsOpen,
  checksStartExpanded,
  groupPullRequestChecks,
  pullRequestCheckTone,
  stageOfCheck,
  stagePills,
  summarizePullRequestChecks,
  type ReadableCheck,
} from "@/features/projects/detail/model/pull-request-check-rules";

function check(name: string, conclusion: string | null = "success", extra: Partial<ReadableCheck> = {}): ReadableCheck {
  return { name, status: conclusion === null ? "in_progress" : "completed", conclusion, ...extra };
}

describe("pullRequestCheckTone", () => {
  it.each([
    [check("a"), "success"],
    [check("a", "failure"), "failure"],
    [check("a", "timed_out"), "failure"],
    // A commit status's `error` is our stage being cancelled: still a block.
    [check("a", "error"), "failure"],
    [check("a", null), "running"],
    [check("a", "skipped"), "neutral"],
    [check("a", "cancelled"), "neutral"],
  ] as const)("reads %o as %s", (input, tone) => {
    expect(pullRequestCheckTone(input)).toBe(tone);
  });
});

describe("summarizePullRequestChecks", () => {
  it("counts every check, statuses included, and says only the non-zero buckets", () => {
    const summary = summarizePullRequestChecks([
      check("alphaci/quality", "failure"),
      check("build"),
      check("lint"),
      check("e2e", null),
      check("deploy", "skipped"),
    ]);

    expect(summary.label).toBe("5 checks · 2 passed · 1 failed · 1 running · 1 skipped or neutral");
    expect(checksStartExpanded(summary)).toBe(true);
  });

  it("stays folded when everything passed", () => {
    const summary = summarizePullRequestChecks([check("build")]);

    expect(summary.label).toBe("1 check · 1 passed");
    expect(checksStartExpanded(summary)).toBe(false);
  });

  it("opens for a check that is still running", () => {
    expect(checksStartExpanded(summarizePullRequestChecks([check("build", null)]))).toBe(true);
  });
});

describe("stage pills", () => {
  it("reads alphaci/<stage> statuses as the pipeline's stages, in pipeline order", () => {
    const pills = stagePills([
      check("alphaci/verify", null),
      check("alphaci/access"),
      check("alphaci/quality", "failure"),
      check("build"),
    ]);

    expect(pills.map((pill) => `${pill.mark} ${pill.label}`)).toEqual(["✓ Access", "✗ Quality", "• Verify"]);
  });

  it("recognises a stage status from an older backend that sends no kind", () => {
    expect(stageOfCheck(check("alphaci/package"))).toBe("package");
  });

  it("never treats a check run, or an unknown context, as a stage", () => {
    expect(stageOfCheck(check("alphaci/quality", "success", { kind: "check-run" }))).toBeNull();
    expect(stageOfCheck(check("alphaci/drift-repair"))).toBeNull();
  });
});

describe("groupPullRequestChecks", () => {
  it("groups by workflow, failed then running then passed, with Other checks last on a tie", () => {
    const groups = groupPullRequestChecks([
      check("alphaci/quality"),
      check("SonarCloud"),
      check("build", "success", { workflowName: "Quality" }),
      check("e2e", null, { workflowName: "Verify" }),
      check("lint", "failure", { workflowName: "Quality" }),
    ]);

    expect(groups.map((group) => [group.name, group.rows.map((row) => row.check.name)])).toEqual([
      ["Quality", ["lint", "build"]],
      ["Verify", ["e2e"]],
      ["Other checks", ["SonarCloud"]],
    ]);
  });

  it("tells same-named checks apart by workflow and event, and only those", () => {
    const [group] = groupPullRequestChecks([
      check("build", "success", { id: 1, workflowName: "Quality", event: "pull_request" }),
      check("build", "success", { id: 2, workflowName: "Quality", event: "push" }),
      check("lint", "success", { id: 3, workflowName: "Quality", event: "push" }),
    ]);

    expect(group!.rows.map((row) => row.qualifier)).toEqual(["Quality · pull_request", "Quality · push", null]);
    expect(group!.rows.map((row) => row.key)).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("keys same-named checks from an older backend apart by position", () => {
    const [group] = groupPullRequestChecks([check("build"), check("build")]);

    expect(group!.name).toBe("Other checks");
    expect(group!.rows.map((row) => row.key)).toEqual(["build-0", "build-1"]);
    expect(group!.rows.map((row) => row.qualifier)).toEqual([null, null]);
  });
});

describe("a check's detail", () => {
  it("has none in the old shape, so it stays a plain row", () => {
    expect(checkHasDetail(check("build", "failure"))).toBe(false);
    expect(checkStartsOpen({ check: check("build", "failure"), tone: "failure" })).toBe(false);
  });

  it("opens a failed check that carries anything to read", () => {
    const failed = check("lint", "failure", { annotations: [{}] });

    expect(checkStartsOpen({ check: failed, tone: "failure" })).toBe(true);
    expect(checkStartsOpen({ check: check("lint", "success", { jobId: 3 }), tone: "success" })).toBe(false);
  });

  it("formats annotation locations and tones", () => {
    expect(annotationLocation({ path: "src/a.ts", line: 4 })).toBe("src/a.ts:4");
    expect(annotationLocation({ path: "src/a.ts", line: null })).toBe("src/a.ts");
    expect(annotationTone("failure")).toBe("failure");
    expect(annotationTone("warning")).toBe("warning");
    expect(annotationTone("notice")).toBe("neutral");
  });
});
