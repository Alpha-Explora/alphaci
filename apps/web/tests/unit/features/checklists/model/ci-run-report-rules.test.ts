import {
  ciOverallLabel,
  ciOverallTone,
  ciRunReportBaseName,
  ciRunReportFilename,
  ciRunReportPageHref,
  ciRunReportQuery,
  ciRunReportRefFromQuery,
  ciShortSha,
  ciStageStatusLabel,
  ciStageTitle,
  ciStageTone,
  ciSummaryLine,
  normalizeCiRunReport,
} from "../../../../../src/features/checklists/model/ci-run-report-rules";
import { CI_REF, CI_SHA, ciRunReportWire } from "../ci-run-report-fixtures";

describe("normalizeCiRunReport", () => {
  it("reads the execution, its summary, failures and stages", () => {
    const report = normalizeCiRunReport(ciRunReportWire());
    expect(report).toMatchObject({ ...CI_REF, schemaVersion: "ci-run-report/v1", overallStatus: "failure" });
    expect(report?.summary).toEqual({ stages: 4, passed: 1, failed: 1, inProgress: 0, notRun: 2 });
    expect(report?.failures).toHaveLength(1);
    expect(report?.failures[0]?.items).toHaveLength(2);
    expect(report?.stages.map((stage) => stage.stage)).toEqual(["access", "quality", "package", "verify"]);
  });

  it("keeps a stage's figures and checks, and null for one that reported none", () => {
    const report = normalizeCiRunReport(ciRunReportWire());
    expect(report?.stages[1]?.results?.tests?.failed).toBe(2);
    expect(report?.stages[1]?.checks).toHaveLength(2);
    expect(report?.stages[1]?.hasLogs).toBe(true);
    expect(report?.stages[0]?.results).toBeNull();
    expect(report?.stages[2]?.reportedAt).toBeNull();
  });

  it("drops a stage with no name or status, and treats missing lists as empty", () => {
    const report = normalizeCiRunReport(
      ciRunReportWire({ stages: [{ stage: "quality" }, null, { stage: "access", status: "success" }], failures: undefined }),
    );
    expect(report?.stages.map((stage) => stage.stage)).toEqual(["access"]);
    expect(report?.failures).toEqual([]);
    expect(report?.stages[0]?.messages).toEqual([]);
  });

  it("zeroes a malformed summary instead of drawing NaN", () => {
    expect(normalizeCiRunReport(ciRunReportWire({ summary: { stages: "4" } }))?.summary).toEqual({
      stages: 0,
      passed: 0,
      failed: 0,
      inProgress: 0,
      notRun: 0,
    });
    expect(normalizeCiRunReport(ciRunReportWire({ summary: null }))?.summary.stages).toBe(0);
  });

  it.each([
    ["nothing", null],
    ["a string", "report"],
    ["no repository", ciRunReportWire({ repoFullName: "" })],
    ["no branch", ciRunReportWire({ branch: undefined })],
    ["no commit", ciRunReportWire({ commitSha: null })],
  ])("returns null for %s", (_label, value) => {
    expect(normalizeCiRunReport(value)).toBeNull();
  });
});

describe("CI run report names and links", () => {
  it("names the file like the backend: repo (not owner/repo), branch, short sha", () => {
    expect(ciRunReportBaseName(CI_REF)).toBe("CI-Results-orders-api-uat-a1b2c3d");
    expect(ciRunReportFilename(CI_REF, "json")).toBe("CI-Results-orders-api-uat-a1b2c3d.json");
    expect(ciRunReportFilename(CI_REF, "pdf")).toBe("CI-Results-orders-api-uat-a1b2c3d.pdf");
  });

  it("sanitises every part of the file name", () => {
    expect(ciRunReportBaseName({ repoFullName: "acme/orders api", branch: "../feat/x y", commitSha: "" })).toBe(
      "CI-Results-orders-api-feat-x-y-unknown",
    );
  });

  it("builds the query the endpoint and the print page share, encoding what needs it", () => {
    expect(ciRunReportQuery({ repoFullName: "a/b", branch: "feat/x y", commitSha: "abc1234" }, { format: "md" })).toBe(
      "repoFullName=a%2Fb&branch=feat%2Fx+y&commitSha=abc1234&format=md",
    );
  });

  it("links the print page, with print=1 only when asked", () => {
    expect(ciRunReportPageHref(CI_REF)).toBe(`/runs/report?repoFullName=acme%2Forders-api&branch=uat&commitSha=${CI_SHA}`);
    expect(ciRunReportPageHref(CI_REF, { print: true })).toBe(
      `/runs/report?repoFullName=acme%2Forders-api&branch=uat&commitSha=${CI_SHA}&print=1`,
    );
  });

  it("reads the execution back from a page's query, or null when any part is missing", () => {
    const params = new URLSearchParams(`repoFullName=acme/orders-api&branch=uat&commitSha=${CI_SHA}&print=1`);
    expect(ciRunReportRefFromQuery(params)).toEqual(CI_REF);
    expect(ciRunReportRefFromQuery(new URLSearchParams("repoFullName=a/b&branch=uat"))).toBeNull();
    expect(ciRunReportRefFromQuery(new URLSearchParams("repoFullName=%20&branch=uat&commitSha=x"))).toBeNull();
    expect(ciRunReportRefFromQuery(null)).toBeNull();
  });
});

describe("CI run report wording", () => {
  it("titles stages and words their status", () => {
    expect(ciStageTitle("verify")).toBe("Verify");
    expect(ciStageStatusLabel("blocked")).toBe("Blocked by an earlier failure");
    expect(ciStageStatusLabel("pending")).toBe("Not run yet");
    expect(ciOverallLabel("partial")).toBe("Partial");
  });

  it("maps outcomes to tones: failure danger, partial and blocked warning, running neutral", () => {
    expect(ciOverallTone("success")).toBe("success");
    expect(ciOverallTone("failure")).toBe("danger");
    expect(ciOverallTone("partial")).toBe("warning");
    expect(ciOverallTone("running")).toBe("neutral");
    expect(ciStageTone("failure")).toBe("danger");
    expect(ciStageTone("blocked")).toBe("warning");
    expect(ciStageTone("stalled")).toBe("warning");
    expect(ciStageTone("pending")).toBe("neutral");
  });

  it("sums the stages up, naming failures and not-run only when there are some", () => {
    expect(ciSummaryLine({ stages: 4, passed: 1, failed: 1, inProgress: 0, notRun: 2 })).toBe(
      "1 of 4 stages passed, 1 failed, 2 not run",
    );
    expect(ciSummaryLine({ stages: 4, passed: 4, failed: 0, inProgress: 0, notRun: 0 })).toBe("4 of 4 stages passed");
  });

  it("shortens a sha", () => {
    expect(ciShortSha(CI_SHA)).toBe("a1b2c3d");
  });
});
