import { groupRunsByPipelineBranch } from "@/features/projects/detail/model/runs-by-branch";
import { PIPELINE_BRANCHES } from "@/shared/api/pipeline-branches";

/** A GitHub run. `sha` defaults per-call so each run is its own commit. */
function run(headBranch: string, createdAt: string, headSha = createdAt) {
  return { headBranch, headSha, createdAt };
}

describe("groupRunsByPipelineBranch", () => {
  it("keeps every declared branch even when nothing ran on it", () => {
    // The behaviour that separates this from a groupBy. An empty uat means
    // nothing has been promoted, and a vanished section cannot say that.
    const sections = groupRunsByPipelineBranch([
      run("dev", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual([...PIPELINE_BRANCHES]);
    expect(sections[1]!.commits).toEqual([]);
    expect(sections[2]!.commits).toEqual([]);
  });

  it("orders sections by the promotion flow, not alphabetically", () => {
    const sections = groupRunsByPipelineBranch([
      run("main", "2026-09-10T10:00:00Z"),
      run("uat", "2026-09-10T09:00:00Z"),
      run("dev", "2026-09-10T08:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual(["dev", "uat", "main"]);
  });

  it("leaves out runs on branches outside the flow", () => {
    // Every pull request added its merge ref and its head branch to the
    // picker, which buried the three tiers the tab exists to navigate.
    const sections = groupRunsByPipelineBranch([
      run("7/merge", "2026-09-10T13:00:00Z"),
      run("fix/sonar-quality-fixes", "2026-09-10T12:00:00Z"),
      run("dev", "2026-09-10T08:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual([...PIPELINE_BRANCHES]);
    expect(sections[0]!.commits).toHaveLength(1);
  });

  it("never invents an empty section for an undeclared branch", () => {
    // Declared branches earn a placeholder because their emptiness is a fact.
    // An arbitrary branch with no runs is not a fact about anything.
    const sections = groupRunsByPipelineBranch([]);

    expect(sections).toHaveLength(PIPELINE_BRANCHES.length);
    expect(sections.every((s) => s.commits.length === 0)).toBe(true);
  });

  it("collapses the workflows of one commit into a single entry", () => {
    // access, quality and package are three runs of ONE execution. Listed flat
    // they repeated the commit three times, which is what made the tab noisy.
    const sections = groupRunsByPipelineBranch([
      run("dev", "2026-09-10T10:00:00Z", "abc1234"),
      run("dev", "2026-09-10T10:01:00Z", "abc1234"),
      run("dev", "2026-09-10T10:02:00Z", "abc1234"),
    ]);

    expect(sections[0]!.commits).toHaveLength(1);
    expect(sections[0]!.commits[0]!.runs).toHaveLength(3);
    expect(sections[0]!.commits[0]!.commitSha).toBe("abc1234");
  });

  it("sorts commits within a branch newest first", () => {
    const sections = groupRunsByPipelineBranch([
      run("dev", "2026-09-10T08:00:00Z", "older"),
      run("dev", "2026-09-10T12:00:00Z", "newest"),
      run("dev", "2026-09-10T10:00:00Z", "middle"),
    ]);

    expect(sections[0]!.commits.map((c) => c.commitSha)).toEqual([
      "newest",
      "middle",
      "older",
    ]);
  });

  it("renders rather than throws when a timestamp is unusable", () => {
    // Losing one row's position beats a run list that will not render.
    const sections = groupRunsByPipelineBranch([
      run("dev", "not-a-date", "broken"),
      run("dev", "2026-09-10T10:00:00Z", "fine"),
    ]);

    expect(sections[0]!.commits).toHaveLength(2);
    expect(sections[0]!.commits[0]!.commitSha).toBe("fine");
  });

  it("does not duplicate a declared branch that has runs", () => {
    const sections = groupRunsByPipelineBranch([
      run("uat", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections.filter((s) => s.branch === "uat")).toHaveLength(1);
    expect(sections.find((s) => s.branch === "uat")!.commits).toHaveLength(1);
  });
});
