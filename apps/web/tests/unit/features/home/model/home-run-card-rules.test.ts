import {
  runCardHref,
  runCardReason,
  runCardStages,
  stageDotTone,
} from "../../../../../src/features/home/model/home-run-card-rules";
import type { FriendlyMessage, StageReport, StageStatus } from "../../../../../src/shared/api/contracts";
import { run } from "../home-persona-fixtures";

const ESC = String.fromCharCode(27);

function message(title: string, severity: FriendlyMessage["severity"] = "error", detail = ""): FriendlyMessage {
  return { severity, title, detail, hint: "" };
}

function stage(id: StageReport["stage"], status: StageStatus, messages: FriendlyMessage[] = []): StageReport {
  return { stage: id, status, runId: 1, friendlyMessages: messages, githubRunUrl: "", updatedAt: "2026-10-13T00:00:00Z" };
}

function failedRun(stages: StageReport[]) {
  return { ...run("shop-fe", "dev", "failure", "2026-10-13T00:00:00Z"), stages };
}

describe("stage dot tone", () => {
  it("keeps every known stage status, stalled and blocked included", () => {
    for (const status of ["success", "failure", "running", "cancelled", "pending", "blocked", "stalled"] as const) {
      expect(stageDotTone(status)).toBe(status);
    }
  });

  it("reads an unknown or missing status as pending", () => {
    expect(stageDotTone("queued")).toBe("pending");
    expect(stageDotTone(undefined)).toBe("pending");
    expect(stageDotTone(null)).toBe("pending");
  });

  it("lists the four stages in pipeline order, unreported ones pending", () => {
    const stages = runCardStages(failedRun([stage("verify", "blocked"), stage("quality", "stalled")]));
    expect(stages).toEqual([
      { id: "access", status: "pending" },
      { id: "quality", status: "stalled" },
      { id: "package", status: "pending" },
      { id: "verify", status: "blocked" },
    ]);
  });
});

describe("run card reason", () => {
  it("names the first failing stage and its error message", () => {
    const reason = runCardReason(
      failedRun([
        stage("access", "success", [message("Access ok", "success")]),
        stage("verify", "failure", [message("Later stage")]),
        stage("quality", "failure", [message("Lint ran", "info"), message("3 tests failed")]),
      ]),
    );
    expect(reason).toBe("Quality: 3 tests failed");
  });

  it("uses the first message when none is an error, and the detail when the title is empty", () => {
    expect(runCardReason(failedRun([stage("package", "failure", [message("Image push refused", "warning")])]))).toBe(
      "Package: Image push refused",
    );
    expect(runCardReason(failedRun([stage("package", "failure", [message("", "error", "Registry said no")])]))).toBe(
      "Package: Registry said no",
    );
  });

  it("counts a stalled stage as the one that stopped the run", () => {
    expect(runCardReason(failedRun([stage("verify", "stalled", [message("No report after 30 minutes")])]))).toBe(
      "Verify: No report after 30 minutes",
    );
  });

  it("strips terminal colour codes from the message", () => {
    const coloured = `${ESC}[2mexpect(${ESC}[22mlocator${ESC}[2m).toBeVisible()${ESC}[22m failed`;
    expect(runCardReason(failedRun([stage("verify", "failure", [message(coloured)])]))).toBe(
      "Verify: expect(locator).toBeVisible() failed",
    );
  });

  it("says nothing for a run that did not fail, or a failure with no message", () => {
    const passing = { ...failedRun([stage("quality", "failure", [message("x")])]), overallStatus: "success" as const };
    expect(runCardReason(passing)).toBeNull();
    expect(runCardReason(failedRun([stage("quality", "failure")]))).toBeNull();
    expect(runCardReason(failedRun([stage("quality", "failure", [message("", "error", "")])]))).toBeNull();
  });
});

describe("run card link", () => {
  const ids = new Map([["acme/shop-fe", "p-shop-fe"]]);

  it("opens the repository's Pipeline tab in ALPHACI, matching names without case", () => {
    expect(runCardHref({ repoFullName: "ACME/Shop-FE" }, ids)).toBe("/projects/p-shop-fe#pipeline");
  });

  it("falls back to the runs page for an unknown repository or no ids", () => {
    expect(runCardHref({ repoFullName: "acme/other" }, ids)).toBe("/runs");
    expect(runCardHref({ repoFullName: "acme/shop-fe" }, null)).toBe("/runs");
    expect(runCardHref({ repoFullName: "" }, ids)).toBe("/runs");
  });
});
