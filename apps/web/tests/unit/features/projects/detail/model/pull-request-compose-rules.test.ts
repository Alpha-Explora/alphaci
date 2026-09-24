import {
  describeComparison,
  suggestTitle,
} from "../../../../../../src/features/projects/detail/model/pull-request-compose-rules";
import type { BranchComparisonResponse } from "../../../../../../src/features/projects/detail/data/project-workspace-api";

const commit = (headline: string) => ({
  sha: "abc",
  headline,
  author: null,
  authoredAt: null,
});

function compare(
  aheadBy: number,
  behindBy: number,
  existingNumber: number | null = null,
): BranchComparisonResponse {
  return {
    repoFullName: "org/repo",
    base: "main",
    head: "feature",
    existingPullRequest:
      existingNumber === null
        ? null
        : {
            number: existingNumber,
            title: "Add login",
            state: "open",
            draft: false,
            merged: false,
            htmlUrl: "",
            headRef: "feature",
            baseRef: "main",
            author: null,
            authorAvatarUrl: null,
            createdAt: "",
            updatedAt: "",
            additions: null,
            deletions: null,
            changedFiles: null,
          },
    comparison: {
      status: "ahead",
      aheadBy,
      behindBy,
      totalCommits: aheadBy,
      commits: [],
      files: [],
      filesTruncated: false,
    },
  };
}

describe("describeComparison", () => {
  it("stays quiet for the clean case", () => {
    expect(describeComparison(compare(2, 0))).toEqual({
      canCreate: true,
      tone: "ready",
      message: "",
    });
  });

  it("points at a pull request that is already open instead of letting GitHub refuse a second", () => {
    const readiness = describeComparison(compare(2, 0, 12));
    expect(readiness).toMatchObject({
      canCreate: false,
      tone: "blocked",
      action: { kind: "open-existing", number: 12 },
    });
    expect(readiness.message).toContain("#12: Add login");
  });

  it("checks for an open pull request before anything else", () => {
    // Even a pair that is behind reports the open pull request first: it is
    // the more useful answer, and the only one with somewhere to go.
    expect(describeComparison(compare(0, 3, 12)).action).toEqual({
      kind: "open-existing",
      number: 12,
    });
  });

  it("blocks identical branches, with nothing to offer", () => {
    const readiness = describeComparison(compare(0, 0));
    expect(readiness).toMatchObject({ canCreate: false, tone: "blocked" });
    expect(readiness.action).toBeUndefined();
    expect(readiness.message).toContain("same commit");
  });

  it("offers a swap when head is only behind, the usual sign of reversed pickers", () => {
    const readiness = describeComparison(compare(0, 3));
    expect(readiness).toMatchObject({
      canCreate: false,
      tone: "blocked",
      action: { kind: "swap" },
    });
    expect(readiness.message).toContain("main is 3 commits ahead");
  });

  it("allows a diverged pair but warns that the base has moved", () => {
    const readiness = describeComparison(compare(2, 1));
    expect(readiness).toMatchObject({ canCreate: true, tone: "warning" });
    expect(readiness.message).toContain("main has 1 commit that feature does not");
  });
});

describe("suggestTitle", () => {
  it("uses the only commit's headline, a sentence someone already wrote", () => {
    expect(suggestTitle("feature/x", [commit("Add login form")])).toBe(
      "Add login form",
    );
  });

  it("turns the branch name back into words when there are several commits", () => {
    expect(
      suggestTitle("feature/add-login_page", [commit("a"), commit("b")]),
    ).toBe("Add login page");
  });

  it("falls back to the branch name when it has no words left", () => {
    expect(suggestTitle("feature/--", [])).toBe("feature/--");
  });
});
