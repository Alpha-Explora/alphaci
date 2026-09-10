import {
  commitHeadline,
  commitStageProblems,
  groupRunsByCommit,
  stagePillTone,
} from "@/features/projects/detail/model/runs-by-commit";
import type { RunGroup, StageReport } from "@/shared/api/contracts";

function run(headSha: string, createdAt: string) {
  return { headSha, createdAt };
}

function stage(
  name: StageReport["stage"],
  status: StageReport["status"],
  messages: StageReport["friendlyMessages"] = [],
): StageReport {
  return {
    stage: name,
    status,
    friendlyMessages: messages,
    githubRunUrl: "https://github.com/o/r/actions/runs/1",
    updatedAt: "",
  };
}

function report(commitSha: string, stages: StageReport[]): RunGroup {
  return {
    runId: 1,
    repoFullName: "o/r",
    branch: "dev",
    commitSha,
    startedAt: "2026-09-10T10:00:00Z",
    overallStatus: "failure",
    stages,
  };
}

describe("groupRunsByCommit", () => {
  it("gathers the chained workflows of one commit into one execution", () => {
    // The backend is explicit that the stages of one execution share only the
    // commit SHA, because each chained workflow gets its own run_id.
    const commits = groupRunsByCommit(
      [
        run("abc", "2026-09-10T10:00:00Z"),
        run("abc", "2026-09-10T10:02:00Z"),
        run("abc", "2026-09-10T10:01:00Z"),
      ],
      [],
    );

    expect(commits).toHaveLength(1);
    expect(commits[0]!.runs).toHaveLength(3);
    // Newest hoisted, so the row header describes the latest attempt.
    expect(commits[0]!.latest.createdAt).toBe("2026-09-10T10:02:00Z");
  });

  it("attaches our report to the commit it graded", () => {
    const commits = groupRunsByCommit(
      [run("abc", "2026-09-10T10:00:00Z")],
      [report("abc", [stage("access", "success")])],
    );

    expect(commits[0]!.report).not.toBeNull();
    expect(commits[0]!.report!.commitSha).toBe("abc");
  });

  it("leaves the report null when GitHub ran something we never graded", () => {
    // The case the stage resolver exists for: a workflow rejected at startup
    // executes nothing, so it cannot report, and null is the honest answer.
    const commits = groupRunsByCommit(
      [run("ungraded", "2026-09-10T10:00:00Z")],
      [report("other", [stage("access", "success")])],
    );

    expect(commits[0]!.report).toBeNull();
  });

  it("keeps the freshest report when a commit was re-run", () => {
    const commits = groupRunsByCommit(
      [run("abc", "2026-09-10T10:00:00Z")],
      [
        report("abc", [stage("quality", "failure")]),
        report("abc", [stage("quality", "success")]),
      ],
    );

    expect(commits[0]!.report!.stages[0]!.status).toBe("failure");
  });

  it("orders commits newest first", () => {
    const commits = groupRunsByCommit(
      [
        run("older", "2026-09-10T08:00:00Z"),
        run("newer", "2026-09-10T12:00:00Z"),
      ],
      [],
    );

    expect(commits.map((c) => c.commitSha)).toEqual(["newer", "older"]);
  });
});

describe("commitStageProblems", () => {
  it("returns nothing when there is no report to read", () => {
    expect(commitStageProblems(null)).toEqual([]);
  });

  it("keeps every stage that did not pass, message or not", () => {
    // A passing stage needs no words; the pill already said it. A blocked one
    // does, even carrying no message of its own — it is part of the story of
    // why the pipeline stopped.
    const problems = commitStageProblems(
      report("abc", [
        stage("access", "success"),
        stage("quality", "stalled", [
          {
            severity: "error",
            title: "Stage never started",
            detail: "d",
            hint: "h",
          },
        ]),
        stage("package", "blocked", []),
      ]),
    );

    expect(problems.map((s) => s.stage)).toEqual(["quality", "package"]);
  });
});

describe("stagePillTone", () => {
  it("treats a stalled stage as a failure, because it is one", () => {
    expect(stagePillTone("stalled")).toBe("failure");
    expect(stagePillTone("failure")).toBe("failure");
  });

  it("leaves blocked neutral, as a consequence rather than a second fault", () => {
    expect(stagePillTone("blocked")).toBe("neutral");
    expect(stagePillTone("pending")).toBe("neutral");
  });

  it("maps the plainly good and in-flight states", () => {
    expect(stagePillTone("success")).toBe("success");
    expect(stagePillTone("running")).toBe("running");
  });
});

describe("commitHeadline", () => {
  const ghRun = (conclusion: string | null, status = "completed") => ({
    headSha: "abc",
    createdAt: "2026-09-10T10:00:00Z",
    status,
    conclusion,
  });

  it("takes the headline from the report, not the newest run", () => {
    // The screenshot bug: the package workflow went green, so the newest run
    // said success while the pipeline as a whole had a failed quality stage.
    const [commit] = groupRunsByCommit(
      [ghRun("success")],
      [
        {
          ...report("abc", [stage("quality", "failure")]),
          overallStatus: "failure",
        },
      ],
    );

    const headline = commitHeadline(commit!);
    expect(headline.label).toBe("failure");
    expect(headline.tone).toBe("failure");
    expect(headline.fromReport).toBe(true);
  });

  it("falls back to the run when nothing graded the commit", () => {
    const [commit] = groupRunsByCommit([ghRun("success")], []);

    const headline = commitHeadline(commit!);
    expect(headline.label).toBe("success");
    expect(headline.fromReport).toBe(false);
  });

  it("reads an unfinished run as running", () => {
    const [commit] = groupRunsByCommit([ghRun(null, "in_progress")], []);

    expect(commitHeadline(commit!).tone).toBe("running");
  });

  it("does not paint a partial pipeline green", () => {
    const [commit] = groupRunsByCommit(
      [ghRun("success")],
      [{ ...report("abc", []), overallStatus: "partial" }],
    );

    expect(commitHeadline(commit!).tone).toBe("neutral");
  });
});

describe("commitStageProblems — silence is the bug", () => {
  it("keeps a failed stage that captured no explanation", () => {
    // Requiring a message hid exactly the case the tab exists for: a red pill
    // with nothing said. The view can then name the gap instead of showing
    // nothing at all.
    const problems = commitStageProblems(
      report("abc", [stage("quality", "failure", [])]),
    );

    expect(problems.map((s) => s.stage)).toEqual(["quality"]);
  });

  it("stays quiet about stages that have not run yet", () => {
    const problems = commitStageProblems(
      report("abc", [
        stage("access", "success"),
        stage("quality", "running"),
        stage("package", "pending"),
      ]),
    );

    expect(problems).toEqual([]);
  });
});
