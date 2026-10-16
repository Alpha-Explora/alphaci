import {
  canRunDriftRepair,
  driftAffectedFiles,
  driftFindingTitle,
  driftPullRequestUrl,
  driftRepairBaseBranch,
  driftRepairActionFor,
} from "@/features/projects/detail/model/drift-finding-rules";

describe("drift finding rules", () => {
  it("titles a stale CI address in plain language and leaves other codes as they are", () => {
    expect(driftFindingTitle({ code: "ci_api_url_stale" })).toBe(
      "CI points at an old AlphaCI address",
    );
    expect(driftFindingTitle({ code: "workflow_files_missing" })).toBe(
      "workflow_files_missing",
    );
  });

  it("offers the CI address repair for its finding, and no repair for kinds this panel does not repair", () => {
    expect(driftRepairActionFor({ code: "ci_api_url_stale" })).toBe(
      "repair_ci_api_url",
    );
    expect(
      driftRepairActionFor({ code: "branch_protection_missing" }),
    ).toBeNull();
  });

  it("lets only a product owner or an admin run the repair, as the backend does", () => {
    expect(canRunDriftRepair("lead")).toBe(true);
    expect(canRunDriftRepair("admin")).toBe(true);
    expect(canRunDriftRepair("member")).toBe(false);
    expect(canRunDriftRepair("qa")).toBe(false);
    expect(canRunDriftRepair(null)).toBe(false);
  });

  it("lists affected files as branch and path, and ignores malformed entries", () => {
    expect(
      driftAffectedFiles({
        details: {
          files: [
            { branch: "dev", path: ".github/workflows/ci.yml" },
            { branch: "main" },
            "not-an-object",
          ],
        },
      }),
    ).toEqual(["dev: .github/workflows/ci.yml"]);
    expect(driftAffectedFiles({ details: {} })).toEqual([]);
  });
});

describe("driftPullRequestUrl", () => {
  it("returns the pull request a repair opened, and null when it opened none", () => {
    expect(
      driftPullRequestUrl({
        result: { pullRequestUrl: "https://github.com/acme/shop/pull/3" },
      }),
    ).toBe("https://github.com/acme/shop/pull/3");
    expect(driftPullRequestUrl({ result: {} })).toBeNull();
    expect(driftPullRequestUrl({ result: { pullRequestUrl: "" } })).toBeNull();
    expect(driftPullRequestUrl({})).toBeNull();
  });
});

describe("driftRepairBaseBranch", () => {
  it("names the base branch detection recorded, and nothing for an older finding", () => {
    expect(driftRepairBaseBranch({ details: { baseBranch: "develop" } })).toBe(
      "develop",
    );
    expect(driftRepairBaseBranch({ details: {} })).toBeNull();
  });
});
