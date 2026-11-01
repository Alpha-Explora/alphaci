import {
  actorLabel,
  commitSourceShortLabel,
  completionLabel,
  exportErrorMessage,
  formatReportDate,
  orderedItems,
  percentFloor,
  previousSignoffs,
  qaStudioHref,
  reportBaseName,
  reportErrorCopy,
  reportFilename,
  reportPageHref,
  reportSeverityLabel,
  reportStateLabel,
  reportVerdictLabel,
  reportVerdictTone,
  runStatusLabel,
  sanitizeFilenamePart,
  summaryBreakdown,
} from "../../../../../src/features/checklists/model/qa-report-rules";
import { itemStatusLabel } from "../../../../../src/features/checklists/model/qa-run-rules";
import { targetPersonaLabel, verificationTypeLabel } from "../../../../../src/features/checklists/model/checklist-rules";
import { apiError } from "../checklist-fixtures";
import { frozenReport } from "../qa-report-fixtures";
import { runItem } from "../qa-run-fixtures";

describe("report labels", () => {
  it("names every status, persona, verification type and severity as the report prints them", () => {
    expect(
      (["pending", "in_progress", "passed", "failed", "blocked", "returned_to_dev"] as const).map(itemStatusLabel),
    ).toEqual(["Pending", "In progress", "Passed", "Failed", "Blocked", "Returned to dev"]);
    expect((["developer", "qa", "all"] as const).map(targetPersonaLabel)).toEqual(["Developer", "QA Team", "Everyone"]);
    expect((["manual", "playwright", "unit_test", "bruno"] as const).map(verificationTypeLabel)).toEqual([
      "Manual check",
      "Playwright E2E",
      "Unit test",
      "Bruno API",
    ]);
    expect((["blocker", "major", "minor", null] as const).map(reportSeverityLabel)).toEqual([
      "Blocker",
      "Major",
      "Minor",
      "Unrated",
    ]);
  });

  it("labels verdicts, including a run nobody signed", () => {
    expect(reportVerdictLabel("APPROVED")).toBe("Approved");
    expect(reportVerdictLabel("REJECTED")).toBe("Rejected");
    expect(reportVerdictLabel("CONDITIONAL")).toBe("Conditional");
    expect(reportVerdictLabel(null)).toBe("Not signed off");
    expect(reportVerdictTone("APPROVED")).toBe("success");
    expect(reportVerdictTone("CONDITIONAL")).toBe("warning");
    expect(reportVerdictTone("REJECTED")).toBe("danger");
    expect(reportVerdictTone(null)).toBe("neutral");
  });

  it("labels run status, commit source, actors and the frozen/live note", () => {
    expect(runStatusLabel("open")).toBe("Open");
    expect(runStatusLabel("signed_off")).toBe("Signed off");
    expect(commitSourceShortLabel("deployment")).toBe("Deployed");
    expect(commitSourceShortLabel("branch_head")).toBe("Branch head");
    expect(commitSourceShortLabel(null)).toBe("");
    expect(actorLabel({ login: "ana" })).toBe("@ana");
    expect(actorLabel(null)).toBe("Unknown");
    expect(reportStateLabel(true)).toBe("Frozen at sign-off");
    expect(reportStateLabel(false)).toBe("Live — not signed off");
  });
});

describe("formatReportDate", () => {
  it("prints ISO order with the zone", () => {
    expect(formatReportDate("2026-09-25T06:30:00.000Z", "UTC")).toBe("2026-09-25 06:30 UTC");
    expect(formatReportDate("2026-09-25T20:05:00.000Z", "Asia/Manila")).toBe("2026-09-26 04:05 GMT+8");
  });

  it("uses a dash for a missing or unreadable date", () => {
    expect(formatReportDate(null)).toBe("—");
    expect(formatReportDate("not a date")).toBe("—");
  });
});

describe("percentFloor and completion", () => {
  it("rounds down, so 100% means every item passed", () => {
    expect(percentFloor(3, 5)).toBe(60);
    expect(percentFloor(2, 3)).toBe(66);
    expect(percentFloor(199, 200)).toBe(99);
    expect(percentFloor(5, 5)).toBe(100);
  });

  it("uses integer arithmetic (29/100 is 29, not 28)", () => {
    expect(percentFloor(29, 100)).toBe(29);
    expect(percentFloor(57, 100)).toBe(57);
  });

  it("is 0 for empty or invalid input and never above 100", () => {
    expect(percentFloor(0, 0)).toBe(0);
    expect(percentFloor(1, 0)).toBe(0);
    expect(percentFloor(-1, 4)).toBe(0);
    expect(percentFloor(Number.NaN, 4)).toBe(0);
    expect(percentFloor(6, 5)).toBe(100);
  });

  it("builds the completion sentence from the same two integers", () => {
    expect(completionLabel({ passed: 3, totalItems: 5 })).toBe("3 / 5 passed (60%)");
    expect(completionLabel({ passed: 0, totalItems: 0 })).toBe("0 / 0 passed (0%)");
  });

  it("breaks the summary down in bar order, dropping zero counts", () => {
    expect(summaryBreakdown(frozenReport().summary)).toEqual([
      { status: "passed", count: 3 },
      { status: "failed", count: 1 },
      { status: "blocked", count: 1 },
    ]);
  });
});

describe("items and sign-offs", () => {
  it("orders items by position", () => {
    const items = [runItem(2), runItem(0), runItem(1)];
    expect(orderedItems(items).map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("keeps only superseded sign-offs, oldest first (matches the backend Markdown)", () => {
    const history = frozenReport().signoffHistory;
    const older = { ...history[0], signedAt: "2026-09-20T00:00:00.000Z", verdict: "APPROVED" as const };
    const previous = previousSignoffs([older, ...history]);
    expect(previous.map((entry) => entry.verdict)).toEqual(["APPROVED", "REJECTED"]);
  });
});

describe("file names and links", () => {
  it("sanitises a file-name segment to [A-Za-z0-9._-]", () => {
    expect(sanitizeFilenamePart("tone/orders-api")).toBe("tone-orders-api");
    expect(sanitizeFilenamePart("feat/checkout v2 ✓")).toBe("feat-checkout-v2");
    expect(sanitizeFilenamePart("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFilenamePart("release_1.2")).toBe("release_1.2");
    expect(sanitizeFilenamePart("--rm -rf")).toBe("rm-rf");
    expect(sanitizeFilenamePart("")).toBe("unknown");
    expect(sanitizeFilenamePart(null)).toBe("unknown");
    expect(sanitizeFilenamePart("///")).toBe("unknown");
  });

  it("names the report repo-branch-sha7", () => {
    const report = frozenReport();
    expect(reportBaseName(report)).toBe("QA-Report-orders-api-feat-checkout-a1b2c3d");
    expect(reportFilename(report, "json")).toBe("QA-Report-orders-api-feat-checkout-a1b2c3d.json");
    const unnamed = { ...report, project: { ...report.project, repoFullName: "" } };
    expect(reportFilename(unnamed, "md")).toBe("QA-Report-orders-api-feat-checkout-a1b2c3d.md");
  });

  it("links to the print page and back to QA Studio", () => {
    expect(reportPageHref("p/1", "r 1")).toBe("/projects/p%2F1/qa/report/r%201");
    expect(reportPageHref("p1", "r1", { print: true })).toBe("/projects/p1/qa/report/r1?print=1");
    expect(qaStudioHref("p1")).toBe("/projects/p1#qa");
  });
});

describe("error copy", () => {
  it("explains a missing report, an expired session and anything else", () => {
    expect(reportErrorCopy(apiError(404))).toEqual(
      expect.objectContaining({ title: "This report is not available", signIn: false }),
    );
    expect(reportErrorCopy(apiError(401)).signIn).toBe(true);
    expect(reportErrorCopy(new Error("boom")).title).toBe("The report did not load");
  });

  it("phrases export failures for the action that failed", () => {
    expect(exportErrorMessage("copy-clipboard", new Error("denied"))).toMatch(/blocked clipboard access/);
    expect(exportErrorMessage("copy-fetch", apiError(500))).toMatch(/could not be fetched/);
    expect(exportErrorMessage("download", apiError(500))).toMatch(/could not be downloaded/);
    expect(exportErrorMessage("download", apiError(404))).toMatch(/not available/);
  });
});
