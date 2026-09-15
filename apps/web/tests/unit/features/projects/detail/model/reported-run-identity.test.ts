import {
  indexReportedIdentities,
  reportedBranch,
  reportedCommitSha,
} from "@/features/projects/detail/model/reported-run-identity";
import { groupRunsByPipelineBranch } from "@/features/projects/detail/model/runs-by-branch";
import type { RunGroup, StageReport } from "@/shared/api/contracts";

/*
 * The values below are from Alphaexplora-Sandbox/testsandbox-fe, where the tab
 * showed "dev - no runs" and "uat - no runs" while GitHub had runs for both.
 *
 * The scaffolder pushed five commits in about thirty seconds, so `fb0b76b1`
 * was main's head by the time the chained stages ran, and GitHub stamped every
 * one of them with that commit and with `main` - including runs whose own
 * display title read "dev - ci: add ALPHACI workflow".
 */
const HEAD = "fb0b76b1";
const TRIGGERING = "317f7de9";

function stage(runId: number, name: StageReport["stage"] = "quality"): StageReport {
  return {
    stage: name,
    status: "failure",
    runId,
    friendlyMessages: [],
    githubRunUrl: `https://github.com/o/r/actions/runs/${String(runId)}`,
    updatedAt: "",
  };
}

function report(
  branch: string,
  commitSha: string,
  stages: StageReport[],
): RunGroup {
  return {
    runId: stages[0]?.runId ?? 0,
    repoFullName: "Alphaexplora-Sandbox/testsandbox-fe",
    branch,
    commitSha,
    startedAt: "2026-09-14T04:38:00Z",
    overallStatus: "failure",
    stages,
  };
}

/** A chained run as GitHub describes it: default branch, branch head. */
function chainedRun(id: number) {
  return {
    id,
    headBranch: "main",
    headSha: HEAD,
    createdAt: "2026-09-14T04:38:13Z",
  };
}

describe("reported run identity", () => {
  it("files a mislabelled chained run under the branch we recorded", () => {
    const index = indexReportedIdentities([
      report("dev", TRIGGERING, [stage(34806829015)]),
    ]);

    expect(reportedBranch(chainedRun(34806829015), index)).toBe("dev");
  });

  it("files it under the commit that triggered it, not the branch head", () => {
    const index = indexReportedIdentities([
      report("dev", TRIGGERING, [stage(34806829015)]),
    ]);

    expect(reportedCommitSha(chainedRun(34806829015), index)).toBe(TRIGGERING);
  });

  it("keeps GitHub's labels for a run we never graded", () => {
    // access is push-triggered, so GitHub's labels are already right, and an
    // unreported run is one we know nothing better about.
    const index = indexReportedIdentities([]);
    const run = {
      id: 34806738674,
      headBranch: "dev",
      headSha: HEAD,
      createdAt: "2026-09-14T04:37:27Z",
    };

    expect(reportedBranch(run, index)).toBe("dev");
    expect(reportedCommitSha(run, index)).toBe(HEAD);
  });

  /*
   * Two unknowns are not a match. An absent run id is still a usable Map key,
   * so indexing it would file every id-less stage under one entry and hand the
   * first one's branch to any id-less run that came looking.
   */
  it("never matches a stage with no run id to a run with no run id", () => {
    const orphan = { stage: "quality", status: "failure", friendlyMessages: [], githubRunUrl: "", updatedAt: "" } as unknown as StageReport;
    const index = indexReportedIdentities([report("uat", "deadbeef", [orphan])]);

    const idless = { headBranch: "main", headSha: HEAD, createdAt: "" } as unknown as {
      id: number;
      headBranch: string;
      headSha: string;
    };

    expect(index.size).toBe(0);
    expect(reportedBranch(idless, index)).toBe("main");
    expect(reportedCommitSha(idless, index)).toBe(HEAD);
  });
});

/*
 * The symptom the whole change exists for: GitHub labels 27 of 31 runs `main`,
 * so grouping on its labels left two declared branches reading "no runs" while
 * the runs were sitting in the list under the wrong heading.
 */
describe("groupRunsByPipelineBranch, with mislabelled chained runs", () => {
  it("puts a dev pipeline under dev even though GitHub called it main", () => {
    const sections = groupRunsByPipelineBranch(
      [chainedRun(34806829015), chainedRun(34806818467)],
      [
        report("dev", TRIGGERING, [stage(34806829015)]),
        report("uat", TRIGGERING, [stage(34806818467)]),
      ],
    );

    const byBranch = new Map(sections.map((s) => [s.branch, s]));
    expect(byBranch.get("dev")?.commits).toHaveLength(1);
    expect(byBranch.get("uat")?.commits).toHaveLength(1);
    expect(byBranch.get("main")?.commits).toHaveLength(0);
  });

  it("attaches the report, so the stage stops reading as never started", () => {
    // Quality ran seven times and reported real failures. It rendered as
    // "Stage never started" only because the report was filed under the
    // triggering commit and the run group under the branch head.
    const sections = groupRunsByPipelineBranch(
      [chainedRun(34806787075)],
      [report("dev", TRIGGERING, [stage(34806787075)])],
    );

    const dev = sections.find((s) => s.branch === "dev");
    expect(dev?.commits[0]?.commitSha).toBe(TRIGGERING);
    expect(dev?.commits[0]?.report).not.toBeNull();
  });
});
