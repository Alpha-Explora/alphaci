import { groupRunsByPipelineBranch } from "@/features/projects/detail/model/runs-by-branch";
import { PIPELINE_BRANCHES } from "@/shared/api/pipeline-branches";

function run(headBranch: string, createdAt: string) {
  return { headBranch, createdAt };
}

describe("groupRunsByPipelineBranch", () => {
  it("keeps every declared branch even when nothing ran on it", () => {
    // The behaviour that separates this from a groupBy. An empty uat means
    // nothing has been promoted, and a vanished section cannot say that.
    const sections = groupRunsByPipelineBranch([
      run("dev", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual([...PIPELINE_BRANCHES]);
    expect(sections[1]!.runs).toEqual([]);
    expect(sections[2]!.runs).toEqual([]);
  });

  it("orders sections by the promotion flow, not alphabetically", () => {
    const sections = groupRunsByPipelineBranch([
      run("main", "2026-09-10T10:00:00Z"),
      run("uat", "2026-09-10T09:00:00Z"),
      run("dev", "2026-09-10T08:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual(["dev", "uat", "main"]);
  });

  it("puts a branch outside the flow after the declared ones and marks it", () => {
    const sections = groupRunsByPipelineBranch([
      run("feature/spike", "2026-09-10T12:00:00Z"),
      run("dev", "2026-09-10T08:00:00Z"),
    ]);

    expect(sections.map((s) => s.branch)).toEqual([
      "dev",
      "uat",
      "main",
      "feature/spike",
    ]);
    expect(sections.at(-1)!.isPipelineBranch).toBe(false);
    expect(sections[0]!.isPipelineBranch).toBe(true);
  });

  it("never invents an empty section for an undeclared branch", () => {
    // Declared branches earn a placeholder because their emptiness is a fact.
    // An arbitrary branch with no runs is not a fact about anything.
    const sections = groupRunsByPipelineBranch([]);

    expect(sections).toHaveLength(PIPELINE_BRANCHES.length);
    expect(sections.every((s) => s.runs.length === 0)).toBe(true);
  });

  it("sorts runs within a branch newest first", () => {
    const sections = groupRunsByPipelineBranch([
      run("dev", "2026-09-10T08:00:00Z"),
      run("dev", "2026-09-10T12:00:00Z"),
      run("dev", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections[0]!.runs.map((r) => r.createdAt)).toEqual([
      "2026-09-10T12:00:00Z",
      "2026-09-10T10:00:00Z",
      "2026-09-10T08:00:00Z",
    ]);
  });

  it("orders two undeclared branches by their most recent activity", () => {
    const sections = groupRunsByPipelineBranch([
      run("chore/old", "2026-09-01T10:00:00Z"),
      run("feature/new", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections.slice(3).map((s) => s.branch)).toEqual([
      "feature/new",
      "chore/old",
    ]);
  });

  it("renders rather than throws when a timestamp is unusable", () => {
    // Losing one row's position beats a run list that will not render.
    const sections = groupRunsByPipelineBranch([
      run("dev", "not-a-date"),
      run("dev", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections[0]!.runs).toHaveLength(2);
    expect(sections[0]!.runs[0]!.createdAt).toBe("2026-09-10T10:00:00Z");
  });

  it("does not duplicate a declared branch that has runs", () => {
    const sections = groupRunsByPipelineBranch([
      run("uat", "2026-09-10T10:00:00Z"),
    ]);

    expect(sections.filter((s) => s.branch === "uat")).toHaveLength(1);
    expect(sections.find((s) => s.branch === "uat")!.runs).toHaveLength(1);
  });
});
