import { promotionReadiness } from "@/features/projects/detail/model/promotion-readiness";
import type { StageCheck } from "@/shared/api/contracts";

const check = (name: string, conclusion: string): StageCheck => ({
  name,
  conclusion,
});

/*
 * These are the real package-stage checks from stpetertestfe, which is why the
 * four skipped deploy jobs are here: the stage runs one per branch and skips
 * the ones that do not apply. Reporting those as blockers would send a reader
 * after jobs that were never meant to run on this branch.
 */
const PACKAGE_CHECKS = [
  check("validate-access", "success"),
  check("build", "success"),
  check("resolve-targets", "success"),
  check("production-gate / Production Readiness", "success"),
  check("promote-to-uat", "skipped"),
  check("promote-to-main", "skipped"),
  check("deploy-vercel-frontend-dev", "skipped"),
  check("deploy-vercel-frontend-uat", "skipped"),
  check("deploy-vercel-frontend-main", "failure"),
];

describe("promotionReadiness", () => {
  it("says a promotion pull request was opened", () => {
    const result = promotionReadiness("dev", [
      check("build", "success"),
      check("deploy-vercel-frontend-dev", "success"),
      check("promote-to-uat", "success"),
    ]);

    expect(result).toEqual({ state: "opened", target: "uat", blockedBy: [] });
  });

  it("names the failure that stopped the promotion", () => {
    const result = promotionReadiness("dev", [
      check("build", "success"),
      check("deploy-vercel-frontend-dev", "failure"),
      check("promote-to-uat", "skipped"),
    ]);

    expect(result.state).toBe("blocked");
    expect(result.target).toBe("uat");
    expect(result.blockedBy).toEqual(["deploy-vercel-frontend-dev"]);
  });

  /*
   * A dev run legitimately skips the uat and main deploy jobs. Listing them as
   * reasons would hand the reader work that was never theirs.
   */
  it("does not blame another branch's job", () => {
    const result = promotionReadiness("dev", PACKAGE_CHECKS);

    expect(result.blockedBy).not.toContain("deploy-vercel-frontend-main");
    expect(result.blockedBy).not.toContain("deploy-vercel-frontend-uat");
  });

  it("blames a main deploy only when main is the branch that ran", () => {
    const result = promotionReadiness("uat", [
      check("build", "success"),
      check("deploy-vercel-frontend-uat", "failure"),
      check("promote-to-main", "skipped"),
    ]);

    expect(result.state).toBe("blocked");
    expect(result.target).toBe("main");
    expect(result.blockedBy).toEqual(["deploy-vercel-frontend-uat"]);
  });

  /*
   * Skipped with nothing failing. We genuinely do not know why, and saying so
   * beats inventing a cause — the failed-job hints told people to build locally
   * when a registry push had failed, which is the same mistake.
   */
  it("says the promotion did not run rather than guessing why", () => {
    const result = promotionReadiness("dev", [
      check("build", "success"),
      check("promote-to-uat", "skipped"),
    ]);

    expect(result.state).toBe("did-not-run");
    expect(result.blockedBy).toEqual([]);
  });

  it("is not applicable to a branch that promotes nowhere", () => {
    expect(promotionReadiness("main", PACKAGE_CHECKS).state).toBe(
      "not-applicable",
    );
  });

  /*
   * A pipeline generated before per-tool reporting sends no checks. "Not known"
   * must not render as "did not promote".
   */
  it("is not applicable when the stage reported no checks", () => {
    expect(promotionReadiness("dev", undefined).state).toBe("not-applicable");
    expect(promotionReadiness("dev", []).state).toBe("not-applicable");
  });

  it("is not applicable when the stage carries no promotion job at all", () => {
    expect(
      promotionReadiness("dev", [check("build", "success")]).state,
    ).toBe("not-applicable");
  });
});

/*
 * The report is a snapshot taken when the package stage reports, and the
 * promotion job finishes AFTER that. "No promotion pull request was opened"
 * was false for every commit caught mid-flight; the live run settles it.
 */
describe("promotionReadiness — a promotion still running at report time", () => {
  const inFlight = [
    check("build", "success"),
    check("deploy-render-api-dev", "success"),
    check("promote-to-uat", "in_progress"),
  ];

  it("says it was in progress, not that it did not happen", () => {
    expect(promotionReadiness("dev", inFlight)).toEqual({
      state: "in-progress",
      target: "uat",
      blockedBy: [],
    });
  });

  it("stays in progress while GitHub is still running the package run", () => {
    expect(
      promotionReadiness("dev", inFlight, { status: "in_progress", conclusion: null }).state,
    ).toBe("in-progress");
  });

  it("reads opened once GitHub finished the package run green", () => {
    expect(
      promotionReadiness("dev", inFlight, { status: "completed", conclusion: "success" }).state,
    ).toBe("opened");
  });

  it("reads failed when GitHub finished the package run as failed", () => {
    expect(
      promotionReadiness("dev", inFlight, { status: "completed", conclusion: "failure" }).state,
    ).toBe("failed");
  });

  it("does not let the live run override a finished promotion job", () => {
    expect(
      promotionReadiness(
        "dev",
        [check("promote-to-uat", "success")],
        { status: "completed", conclusion: "failure" },
      ).state,
    ).toBe("opened");
  });
});
