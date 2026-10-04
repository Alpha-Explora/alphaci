import {
  checkProgress,
  commitTitle,
  defaultOpenStage,
  distinctCommitTitles,
  githubStatusChip,
  headlineChipLabel,
  loadsFailureLog,
  runDuration,
  runEventLabel,
  showsVerdictReason,
  stageEntries,
  stageVerdict,
  workflowRunLabel,
} from "@/features/projects/detail/model/pipeline-run-card-rules";
import {
  commitHeadline,
  groupRunsByCommit,
} from "@/features/projects/detail/model/runs-by-commit";
import type { FriendlyMessage, RunGroup, StageReport } from "@/shared/api/contracts";

function stage(
  name: StageReport["stage"],
  status: StageReport["status"],
  options: {
    runId?: number;
    checks?: [string, string][];
    messages?: FriendlyMessage[];
  } = {},
): StageReport {
  return {
    stage: name,
    status,
    runId: options.runId ?? 0,
    friendlyMessages: options.messages ?? [],
    githubRunUrl: "https://github.com/o/r/actions/runs/1",
    updatedAt: "2026-09-25T10:00:00Z",
    checks: options.checks?.map(([checkName, conclusion]) => ({ name: checkName, conclusion })),
  };
}

const warning: FriendlyMessage = {
  severity: "warning",
  title: "3 committed secrets",
  detail: "Not blocking on dev.",
  hint: "Rotate them.",
};

describe("checkProgress", () => {
  it("takes skipped checks out of the denominator, and still names them", () => {
    // The screenshot: PACKAGE "1 running, 4 passed, 4 skipped" under "success".
    const progress = checkProgress([
      { conclusion: "success" },
      { conclusion: "success" },
      { conclusion: "success" },
      { conclusion: "success" },
      { conclusion: "in_progress" },
      { conclusion: "skipped" },
      { conclusion: "skipped" },
      { conclusion: "skipped" },
      { conclusion: "skipped" },
    ]);

    expect(progress?.label).toBe("4 / 5 passed");
    expect(progress?.notes).toEqual(["1 still running", "4 skipped"]);
    expect(progress?.share).toBe(80);
  });

  it("does not draw a bar when nothing ran at all", () => {
    const progress = checkProgress([{ conclusion: "skipped" }, { conclusion: "skipped" }]);

    expect(progress?.label).toBe("2 skipped");
    expect(progress?.share).toBeNull();
    expect(progress?.notes).toEqual([]);
  });

  it("is null, not zero, when the stage reported no checks", () => {
    expect(checkProgress(undefined)).toBeNull();
    expect(checkProgress([])).toBeNull();
  });
});

describe("stageVerdict — a success reconciled with its checks and GitHub", () => {
  const pkg = stage("package", "success", {
    runId: 42,
    checks: [
      ["build", "success"],
      ["promote-to-uat", "in_progress"],
    ],
  });

  it("reads Finishing while GitHub is still running the stage's run", () => {
    const verdict = stageVerdict(pkg, [pkg], { status: "in_progress", conclusion: null });

    expect(verdict.state).toBe("finishing");
    expect(verdict.label).toBe("Finishing");
    expect(verdict.reason).toContain("Promote to uat is still running");
  });

  it("reads Passed once GitHub finished the run green", () => {
    const verdict = stageVerdict(pkg, [pkg], { status: "completed", conclusion: "success" });

    expect(verdict.state).toBe("passed");
    expect(verdict.tone).toBe("success");
  });

  it("never stays green when GitHub finished the run as failed", () => {
    // The promotion job fails after the stage has already reported success.
    const verdict = stageVerdict(pkg, [pkg], { status: "completed", conclusion: "failure" });

    expect(verdict.state).toBe("failed-after-report");
    expect(verdict.tone).toBe("danger");
    // Not "still running at report time": the job FAILED, after the report,
    // and the stage detail loads its error (see loadsFailureLog).
    expect(verdict.reason).toContain("Promote to uat failed after the stage reported success");
    expect(verdict.reason).not.toContain("still running");
  });

  it("says the result is unknown, in amber, when the run is no longer listed", () => {
    const verdict = stageVerdict(pkg, [pkg], null);

    expect(verdict.label).toBe("Passed");
    expect(verdict.tone).toBe("warning");
    expect(verdict.reason).toContain("was still running when the stage reported");
  });

  it("flags an advisory failure inside a passing stage", () => {
    const quality = stage("quality", "success", {
      checks: [
        ["lint", "success"],
        ["secrets", "failure"],
      ],
    });

    const verdict = stageVerdict(quality, [quality]);

    expect(verdict.label).toBe("Passed with warnings");
    expect(verdict.reason).toBe("Secret scan failed, but it does not block this branch.");
  });

  it("flags a passing stage that carries a warning message", () => {
    const quality = stage("quality", "success", { messages: [warning] });

    expect(stageVerdict(quality, [quality]).state).toBe("passed-with-findings");
  });

  it("ignores an informational note on a passing stage", () => {
    const quality = stage("quality", "success", {
      messages: [{ severity: "info", title: "SBOM", detail: "51 components", hint: "" }],
    });

    expect(stageVerdict(quality, [quality]).state).toBe("passed");
  });
});

describe("stageVerdict — stages that did not run", () => {
  it("names the stage a blocked one is waiting on, in a muted tone", () => {
    const stages = [
      stage("access", "success"),
      stage("quality", "failure"),
      stage("package", "blocked"),
      stage("verify", "blocked"),
    ];

    const verdict = stageVerdict(stages[3]!, stages);

    expect(verdict.label).toBe("Not run");
    expect(verdict.tone).toBe("muted");
    expect(verdict.reason).toBe("Not run because Quality failed.");
  });

  it("reads a stalled stage as Did not start, amber rather than red", () => {
    const stages = [stage("package", "success"), stage("verify", "stalled")];

    const verdict = stageVerdict(stages[1]!, stages);

    expect(verdict.label).toBe("Did not start");
    expect(verdict.tone).toBe("warning");
    expect(verdict.reason).toBe("Package passed, but Verify never started.");
  });

  it("says what a pending stage is waiting for", () => {
    const stages = [stage("quality", "running"), stage("package", "pending")];

    expect(stageVerdict(stages[1]!, stages).reason).toBe("Starts when Quality finishes.");
  });

  it("keeps a failure red", () => {
    const failed = stage("quality", "failure");

    expect(stageVerdict(failed, [failed]).tone).toBe("danger");
  });
});

describe("defaultOpenStage", () => {
  it("opens the red stage before the amber one", () => {
    const stages = [
      stage("quality", "success", { messages: [warning] }),
      stage("package", "failure"),
      stage("verify", "blocked"),
    ];

    expect(defaultOpenStage(stageEntries(stages, []))).toBe("package");
  });

  it("opens a stalled stage when nothing failed", () => {
    const stages = [stage("package", "success"), stage("verify", "stalled")];

    expect(defaultOpenStage(stageEntries(stages, []))).toBe("verify");
  });

  it("opens nothing for a clean pipeline", () => {
    const stages = [stage("access", "success"), stage("quality", "success")];

    expect(defaultOpenStage(stageEntries(stages, []))).toBeNull();
  });

  it("never opens a blocked stage on its own", () => {
    const stages = [stage("quality", "cancelled"), stage("package", "blocked")];

    expect(defaultOpenStage(stageEntries(stages, []))).toBeNull();
  });
});

describe("stageEntries", () => {
  it("checks each stage against the GitHub run it executed in", () => {
    const pkg = stage("package", "success", { runId: 7, checks: [["promote-to-uat", "in_progress"]] });

    const [entry] = stageEntries([pkg], [
      { id: 6, status: "completed", conclusion: "success" },
      { id: 7, status: "completed", conclusion: "failure" },
    ]);

    expect(entry!.verdict.state).toBe("failed-after-report");
  });
});

describe("loadsFailureLog", () => {
  it("reads the log for a stage that failed or was cancelled", () => {
    const stages = [stage("quality", "failure"), stage("package", "cancelled")];
    const entries = stageEntries(stages, []);

    expect(entries.map((entry) => loadsFailureLog(entry))).toEqual([true, true]);
  });

  it("reads the log for a stage whose run failed after it passed", () => {
    // The promotion's error is in no report, only in the run's log.
    const pkg = stage("package", "success", { runId: 7, checks: [["promote-to-uat", "in_progress"]] });
    const [entry] = stageEntries([pkg], [{ id: 7, status: "completed", conclusion: "failure" }]);

    expect(loadsFailureLog(entry!)).toBe(true);
  });

  it("asks for nothing for a clean, blocked or stalled stage", () => {
    const stages = [
      stage("quality", "success", { runId: 7 }),
      stage("package", "blocked"),
      stage("verify", "stalled"),
    ];
    const entries = stageEntries(stages, [{ id: 7, status: "completed", conclusion: "success" }]);

    expect(entries.map((entry) => loadsFailureLog(entry))).toEqual([false, false, false]);
  });
});

describe("showsVerdictReason", () => {
  it("stays quiet when our grading already explains a stage that did not run", () => {
    const stages = [
      stage("quality", "failure"),
      stage("package", "blocked", {
        messages: [{ severity: "info", title: "Waiting on quality", detail: "d", hint: "h" }],
      }),
    ];

    expect(showsVerdictReason(stageEntries(stages, [])[1]!)).toBe(false);
  });

  it("speaks when nothing else on the card would", () => {
    const stages = [stage("quality", "failure"), stage("package", "blocked")];

    expect(showsVerdictReason(stageEntries(stages, [])[1]!)).toBe(true);
  });

  it("always prints the reconciled states only this client can see", () => {
    const pkg = stage("package", "success", {
      runId: 1,
      messages: [warning],
      checks: [["promote-to-uat", "in_progress"]],
    });

    const [entry] = stageEntries([pkg], [{ id: 1, status: "completed", conclusion: "failure" }]);

    expect(showsVerdictReason(entry!)).toBe(true);
  });
});

describe("commitTitle", () => {
  const at = (minute: number) => `2026-09-25T10:${String(minute).padStart(2, "0")}:00Z`;

  it("takes the push run's title, which is the commit message", () => {
    expect(
      commitTitle([
        { event: "workflow_run", displayTitle: "dev · Release: Promote", createdAt: at(5) },
        { event: "push", displayTitle: "feat: add refunds", createdAt: at(1) },
      ]),
    ).toBe("feat: add refunds");
  });

  it("strips the branch prefix from an inherited chained title", () => {
    expect(
      commitTitle([{ event: "workflow_run", displayTitle: "dev · fix: guard amount", createdAt: at(1) }]),
    ).toBe("fix: guard amount");
  });

  it("has no title when the run-name fell back to a bare sha", () => {
    expect(
      commitTitle([{ event: "workflow_run", displayTitle: "dev · 6380118f2a9c", createdAt: at(1) }]),
    ).toBeNull();
    expect(commitTitle([])).toBeNull();
  });
});

describe("distinctCommitTitles", () => {
  it("drops a title shared by several commits, because it identifies none", () => {
    const repeated = { event: "workflow_run", displayTitle: "dev · Release: Promote DEV → UAT", createdAt: "" };
    const titles = distinctCommitTitles([
      { commitSha: "a", runs: [{ event: "push", displayTitle: "feat: refunds", createdAt: "" }] },
      { commitSha: "b", runs: [repeated] },
      { commitSha: "c", runs: [repeated] },
    ]);

    expect(titles.get("a")).toBe("feat: refunds");
    expect(titles.get("b")).toBeNull();
    expect(titles.get("c")).toBeNull();
  });
});

describe("headlineChipLabel", () => {
  it("says the report's words the way a person would", () => {
    expect(headlineChipLabel("failure")).toBe("Failed");
    expect(headlineChipLabel("success")).toBe("Passed");
    expect(headlineChipLabel("attention")).toBe("Needs attention");
    expect(headlineChipLabel("action_required")).toBe("Action required");
  });
});

describe("githubStatusChip", () => {
  it("maps GitHub's status and conclusion onto the card's tones", () => {
    expect(githubStatusChip("completed", "failure")).toEqual({ tone: "danger", label: "Failed" });
    expect(githubStatusChip("completed", "skipped")).toEqual({ tone: "muted", label: "Skipped" });
    expect(githubStatusChip("in_progress", null)).toEqual({ tone: "running", label: "Running" });
    expect(githubStatusChip("queued", null)).toEqual({ tone: "muted", label: "Queued" });
  });
});

describe("workflow run rows", () => {
  const stages = [stage("quality", "failure", { runId: 90 })];

  it("names a run by the stage our report says it executed", () => {
    expect(
      workflowRunLabel({ id: 90, name: "dev · x", displayTitle: "dev · x", runNumber: 3 }, stages),
    ).toBe("Quality workflow");
  });

  it("keeps a workflow's real name when it differs from the title", () => {
    expect(
      workflowRunLabel({ id: 1, name: "ALPHACI Env Guard", displayTitle: "feat: x", runNumber: 3 }, stages),
    ).toBe("ALPHACI Env Guard");
  });

  it("numbers a run it cannot otherwise name", () => {
    expect(
      workflowRunLabel({ id: 2, name: "dev · x", displayTitle: "dev · x", runNumber: 41 }, stages),
    ).toBe("Workflow run #41");
  });

  it("says how a run was started and how long it took", () => {
    expect(runEventLabel("workflow_run")).toBe("chained");
    expect(runEventLabel("push")).toBe("push");
    expect(
      runDuration({ status: "completed", createdAt: "2026-09-25T10:00:00Z", updatedAt: "2026-09-25T10:02:10Z" }),
    ).toBe("2m 10s");
    expect(runDuration({ status: "in_progress", createdAt: "", updatedAt: "" })).toBeNull();
  });
});

describe("commitHeadline — a late failure never leaves the headline green", () => {
  const ghRun = (id: number, conclusion: string) => ({
    id,
    headSha: "abc",
    createdAt: "2026-09-25T10:00:00Z",
    status: "completed",
    conclusion,
  });
  const report = (stages: StageReport[]): RunGroup => ({
    runId: 1,
    repoFullName: "o/r",
    branch: "dev",
    commitSha: "abc",
    startedAt: "2026-09-25T10:00:00Z",
    overallStatus: "success",
    stages,
  });

  it("reads attention when a stage's run failed after it reported success", () => {
    const [commit] = groupRunsByCommit(
      [ghRun(7, "failure")],
      [report([stage("package", "success", { runId: 7 })])],
      "dev",
    );

    expect(commitHeadline(commit!)).toEqual({ label: "attention", tone: "warning", fromReport: true });
  });

  it("stays success when GitHub agrees", () => {
    const [commit] = groupRunsByCommit(
      [ghRun(7, "success")],
      [report([stage("package", "success", { runId: 7 })])],
      "dev",
    );

    expect(commitHeadline(commit!).tone).toBe("success");
  });
});
