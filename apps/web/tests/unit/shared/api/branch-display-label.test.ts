import {
  branchDisplayLabel,
  isPullRequestRef,
} from "@/shared/api/pipeline-branches";

/*
 * A run triggered by a pull request carries `refs/pull/4/merge`, which reaches
 * us as the branch `4/merge`. Rendered literally it sits in the runs list
 * beside dev, uat and main looking like a branch nobody recognises — and there
 * is one per pull request, so they accumulate. Four were already in the data
 * for a single sandbox repository.
 */
describe("branchDisplayLabel", () => {
  it("names a pull request's merge ref as the pull request", () => {
    expect(branchDisplayLabel("4/merge")).toBe("PR #4");
    expect(branchDisplayLabel("127/merge")).toBe("PR #127");
  });

  it("leaves a real branch exactly as reported", () => {
    // The value joins a run to its reports and to GitHub. Only the label may
    // change; renaming anywhere else would break that join.
    for (const branch of ["dev", "uat", "main", "release/2026-09", "4-merge"]) {
      expect(branchDisplayLabel(branch)).toBe(branch);
    }
  });

  it("does not treat a branch that merely looks similar as a pull request", () => {
    expect(branchDisplayLabel("feature/4/merge")).toBe("feature/4/merge");
    expect(branchDisplayLabel("merge")).toBe("merge");
    expect(branchDisplayLabel("v4/merge-queue")).toBe("v4/merge-queue");
  });

  it("reports which refs are pull requests", () => {
    expect(isPullRequestRef("4/merge")).toBe(true);
    expect(isPullRequestRef("dev")).toBe(false);
    expect(isPullRequestRef("feature/4/merge")).toBe(false);
  });
});
