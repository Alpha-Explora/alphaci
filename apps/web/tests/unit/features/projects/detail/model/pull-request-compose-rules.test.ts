import {
  applyPreset,
  canCreatePullRequest,
  defaultPresetId,
  mostRecentOwnBranch,
  ownBranches,
  presetFor,
  defaultComposeBase,
  describeComparison,
  selectableBaseBranches,
  suggestTitle,
} from "../../../../../../src/features/projects/detail/model/pull-request-compose-rules";
import type { BranchComparisonResponse } from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

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

/**
 * Phase 1 security gates: what this composer offers as a base
 * (PERSONA_WORKFLOW_SPEC.md §5, §8.1).
 */
describe("selectableBaseBranches", () => {
  it("excludes main, keeping every other branch in order", () => {
    expect(selectableBaseBranches(["main", "dev", "uat", "feature/x"])).toEqual([
      "dev",
      "uat",
      "feature/x",
    ]);
  });

  it("is empty when main is the only branch", () => {
    expect(selectableBaseBranches(["main"])).toEqual([]);
  });
});

describe("defaultComposeBase", () => {
  it("prefers dev over the repository's own default branch", () => {
    // The bug this fixes: `getProjectBranches().defaultBranch` is `main` on
    // this product, and the composer used to open on it directly.
    expect(defaultComposeBase(["main", "dev", "uat"])).toBe("dev");
  });

  it("falls back to uat when dev has not been cut yet", () => {
    expect(defaultComposeBase(["main", "uat", "feature/x"])).toBe("uat");
  });

  it("falls back to the first selectable branch when neither dev nor uat exists", () => {
    expect(defaultComposeBase(["main", "feature/x", "feature/y"])).toBe(
      "feature/x",
    );
  });

  it("is empty when main is the only branch", () => {
    expect(defaultComposeBase(["main"])).toBe("");
  });
});

describe("canCreatePullRequest", () => {
  const ROLES: ReadonlyArray<AppRole> = ["admin", "lead", "member"];

  it("blocks every role from proposing a merge into main here", () => {
    for (const role of ROLES) {
      expect(canCreatePullRequest(role, "main")).toBe(false);
    }
  });

  it("blocks QA from opening a pull request at all", () => {
    expect(canCreatePullRequest("qa", "dev")).toBe(false);
    expect(canCreatePullRequest("qa", "main")).toBe(false);
  });

  it("allows admin, lead and member into dev or uat", () => {
    for (const role of ROLES) {
      for (const base of ["dev", "uat"]) {
        expect(canCreatePullRequest(role, base)).toBe(true);
      }
    }
  });

  it("denies a session with no known role, even for a non-main base", () => {
    expect(canCreatePullRequest(undefined, "dev")).toBe(false);
    expect(canCreatePullRequest(null, "dev")).toBe(false);
  });
});

describe("Phase 3 pull request presets", () => {
  const branches = ["dev", "uat", "feature/lloyd-login", "feature/lloyd-nav", "feature/sam-x"];
  const lead = { branches, role: "lead" as AppRole, login: "Lloyd" };

  it("Feature -> Dev bases on dev and heads on the most recent own branch", () => {
    expect(applyPreset("feature-to-dev", lead)).toEqual({
      base: "dev",
      head: "feature/lloyd-nav",
    });
  });

  it("Feature -> Dev leaves the head empty when there is no own branch", () => {
    expect(applyPreset("feature-to-dev", { ...lead, login: "nobody" })).toEqual({
      base: "dev",
      head: "",
    });
  });

  it("Dev -> UAT is dev into uat", () => {
    expect(applyPreset("dev-to-uat", lead)).toEqual({ base: "uat", head: "dev" });
  });

  it("Custom applies nothing so the pickers stay free", () => {
    expect(applyPreset("custom", lead)).toBeNull();
  });

  it("never applies a preset whose base is main", () => {
    for (const id of ["feature-to-dev", "dev-to-uat", "custom"] as const) {
      expect(applyPreset(id, lead)?.base).not.toBe("main");
    }
  });

  it("disables a preset whose branch is missing, with a reason", () => {
    const noUat = { ...lead, branches: ["dev", "feature/lloyd-x"] };
    expect(presetFor("dev-to-uat", noUat)).toMatchObject({ available: false });
    expect(presetFor("dev-to-uat", noUat).reason).toContain("uat");
    expect(applyPreset("dev-to-uat", noUat)).toBeNull();

    const noDev = { ...lead, branches: ["uat"] };
    expect(presetFor("feature-to-dev", noDev).available).toBe(false);
    expect(presetFor("dev-to-uat", noDev).reason).toContain("dev");
    expect(presetFor("custom", noDev).available).toBe(true);
  });

  it("offers nothing to a role that may not open pull requests", () => {
    for (const role of ["qa", undefined, null, "root" as AppRole]) {
      const context = { ...lead, role };
      expect(presetFor("feature-to-dev", context).available).toBe(false);
      expect(defaultPresetId(context)).toBe("custom");
    }
  });

  it("defaults to Feature -> Dev, then the next available, then Custom", () => {
    expect(defaultPresetId(lead)).toBe("feature-to-dev");
    expect(defaultPresetId({ ...lead, branches: ["uat"] })).toBe("custom");
    expect(defaultPresetId({ ...lead, branches: [] })).toBe("custom");
  });

  it("recognises own branches by the feature/<login>- convention for non-members", () => {
    expect(ownBranches(lead)).toEqual(["feature/lloyd-login", "feature/lloyd-nav"]);
    expect(mostRecentOwnBranch({ ...lead, login: undefined })).toBe("");
  });

  it("trusts the server-scoped list for a member, minus the pipeline branches", () => {
    const member = { branches: ["dev", "uat", "fix/typo"], role: "member" as AppRole };
    expect(ownBranches(member)).toEqual(["fix/typo"]);
  });
});
