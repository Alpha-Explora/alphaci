import {
  DRIFT_REPAIR_LEAD_ONLY_MESSAGE,
  canRunDriftRepair,
  driftRepairActionForCode,
  driftRepairErrorMessage,
  driftSourceLabel,
} from "@/features/projects/detail/model/project-detail-tab-rules";
import type { AppRole } from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

describe("driftRepairActionForCode (branch protection)", () => {
  it.each([
    "branch_protection_missing",
    "branch_force_push_allowed",
    "branch_deletion_allowed",
  ])("maps %s to repair_branch_protection", (code) => {
    expect(driftRepairActionForCode(code, false)).toBe("repair_branch_protection");
    expect(driftRepairActionForCode(code, true)).toBe("repair_branch_protection");
  });

  it("leaves branch_dev_protected detect-only", () => {
    expect(driftRepairActionForCode("branch_dev_protected", true)).toBeNull();
  });

  it("keeps the existing mappings", () => {
    expect(driftRepairActionForCode("ci_token_missing", false)).toBe("rotate_ci_token");
    expect(driftRepairActionForCode("workflow_files_missing", true)).toBe(
      "create_workflow_update_pr",
    );
  });
});

describe("canRunDriftRepair", () => {
  it.each<[AppRole, boolean]>([
    ["lead", true],
    ["admin", true],
    ["member", false],
    ["qa", false],
  ])("repair_branch_protection for %s -> %s", (role, expected) => {
    expect(canRunDriftRepair("repair_branch_protection", role)).toBe(expected);
  });

  it("denies a missing role", () => {
    expect(canRunDriftRepair("repair_branch_protection", undefined)).toBe(false);
    expect(canRunDriftRepair("repair_branch_protection", null)).toBe(false);
  });

  it("leaves every other action allowed", () => {
    expect(canRunDriftRepair("rotate_ci_token", "member")).toBe(true);
    expect(canRunDriftRepair("detach_target", undefined)).toBe(true);
  });
});

describe("driftSourceLabel", () => {
  const live = { source: "github_live" as const };
  const local = { source: "local_snapshot" as const };

  it("says Live check when every finding is live", () => {
    expect(driftSourceLabel([live, live])).toBe("Live check");
  });
  it("says Local snapshot when none are live, and when empty", () => {
    expect(driftSourceLabel([local])).toBe("Local snapshot");
    expect(driftSourceLabel([])).toBe("Local snapshot");
  });
  it("says both when mixed", () => {
    expect(driftSourceLabel([live, local])).toBe("Local snapshot + live check");
  });
});

describe("driftRepairErrorMessage", () => {
  it("maps 403 to the lead-only note", () => {
    expect(driftRepairErrorMessage(new ApiError("x", 403, { message: "nope" }))).toBe(
      DRIFT_REPAIR_LEAD_ONLY_MESSAGE,
    );
  });
  it("shows the server reason for other errors", () => {
    expect(
      driftRepairErrorMessage(new ApiError("x", 400, { message: "No GitHub token" })),
    ).toBe("No GitHub token");
  });
  it("falls back otherwise", () => {
    expect(driftRepairErrorMessage(new Error("boom"))).toBe("Unable to run repair action.");
  });
});
