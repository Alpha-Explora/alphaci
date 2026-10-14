import {
  VISUAL_OFF_LINE,
  VISUAL_OFF_ON_DEV_LINE,
  VISUAL_PROMOTE_LINE,
  browserTestsVisual,
  visualCaptureOn,
  visualOffNotice,
  type BrowserTestsStatus,
} from "../../../../../../src/features/projects/detail/model/browser-test-rules";
import { workflowUpdateAccess } from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import {
  VISUAL_OFF_LABEL,
  studioVisualSummary,
  visualChipLabel,
  visualEmptyMessage,
} from "../../../../../../src/features/projects/detail/model/visual-check-rules";
import type { VisualChecksResponse } from "../../../../../../src/features/projects/detail/model/visual-check-types";

/* Whether a repository's verify workflow takes screenshots (the browser-tests
 * status's `visual`), and every label that depends on it. An older backend
 * does not send the field: that must read exactly as before, never as "off". */

function status(visual?: unknown): BrowserTestsStatus {
  const base: BrowserTestsStatus = {
    installed: true,
    branch: "dev",
    missingFiles: [],
    presentFiles: [],
    hasLockfile: true,
    playwrightVersion: "1.56.0",
    frontend: true,
    canAdd: true,
    reason: null,
  };
  return visual === undefined ? base : ({ ...base, visual } as BrowserTestsStatus);
}

const NOTHING: VisualChecksResponse = { branch: "uat", runId: null, canApprove: false, snapshots: [] };

function captured(statuses: Array<"passed" | "changed" | "new">): VisualChecksResponse {
  return {
    branch: "uat",
    runId: 7,
    commitSha: "abc1234",
    reportedAt: "2026-10-12T08:00:00Z",
    browser: "chromium",
    canApprove: true,
    snapshots: statuses.map((value, index) => ({
      name: `shot-${String(index)}.png`,
      status: value,
      baselineUrl: null,
      actualUrl: null,
      diffUrl: null,
      baselineApprovedBy: null,
      baselineApprovedAt: null,
      inheritedFrom: null,
      approved: false,
    })),
  };
}

describe("reading the workflow's visual setting", () => {
  it("is unknown when an older backend does not send it", () => {
    expect(browserTestsVisual(status())).toBeNull();
    expect(browserTestsVisual(null)).toBeNull();
  });

  it("reads each branch, with anything but a boolean as unknown", () => {
    expect(browserTestsVisual(status({ dev: true, uat: false }))).toEqual({ dev: true, uat: false });
    expect(browserTestsVisual(status({ dev: null, uat: null }))).toEqual({ dev: null, uat: null });
    expect(browserTestsVisual(status({ dev: "yes" }))).toEqual({ dev: null, uat: null });
    expect(browserTestsVisual(status(null))).toBeNull();
    expect(browserTestsVisual(status([true, false]))).toBeNull();
    expect(browserTestsVisual(status("off"))).toBeNull();
  });

  it("speaks for uat only: main is not reported and dev is never screenshotted", () => {
    const off = { dev: false, uat: false };
    expect(visualCaptureOn(off, "uat")).toBe(false);
    expect(visualCaptureOn({ dev: false, uat: true }, "uat")).toBe(true);
    expect(visualCaptureOn({ dev: true, uat: null }, "uat")).toBeNull();
    expect(visualCaptureOn(off, "main")).toBeNull();
    expect(visualCaptureOn(off, "dev")).toBeNull();
    expect(visualCaptureOn(null, "uat")).toBeNull();
  });
});

describe("the visual line in QA / PO Studio", () => {
  it("says off for this repo instead of 'not captured yet' when uat's workflow is off", () => {
    expect(studioVisualSummary(NOTHING, "uat", false)).toBe("Visual: off for this repo");
    expect(studioVisualSummary(null, "uat", false)).toBe(VISUAL_OFF_LABEL);
    expect(studioVisualSummary(captured([]), "uat", false)).toBe(VISUAL_OFF_LABEL);
  });

  it("keeps 'not captured yet' when visual is on or unknown (an older backend)", () => {
    expect(studioVisualSummary(NOTHING, "uat", true)).toBe("Visual: not captured on uat yet");
    expect(studioVisualSummary(NOTHING, "uat", null)).toBe("Visual: not captured on uat yet");
    expect(studioVisualSummary(NOTHING, "uat")).toBe("Visual: not captured on uat yet");
  });

  it("keeps what a run did capture, even when the workflow is off now", () => {
    expect(studioVisualSummary(captured(["changed", "new"]), "uat", false)).toBe("Visual: 1 changed · 1 new");
    expect(studioVisualSummary(captured(["passed"]), "uat", false)).toBe("Visual: no changes");
  });
});

describe("the Verify stage chip and empty state on Pipeline runs", () => {
  it("says off for this repo, whether or not the stage was opened", () => {
    expect(visualChipLabel(null, false)).toBe("Visual: off for this repo");
    expect(visualChipLabel(NOTHING, false)).toBe(VISUAL_OFF_LABEL);
    expect(visualChipLabel(captured([]), false)).toBe(VISUAL_OFF_LABEL);
  });

  it("is unchanged when visual is on or unknown", () => {
    expect(visualChipLabel(null, true)).toBeNull();
    expect(visualChipLabel(null, null)).toBeNull();
    expect(visualChipLabel(null)).toBeNull();
    expect(visualChipLabel(captured(["changed"]), true)).toBe("Visual: 1 changed");
    expect(visualChipLabel(captured(["changed"]), false)).toBe("Visual: 1 changed");
    expect(visualChipLabel(captured(["passed"]), false)).toBeNull();
  });

  it("explains an empty panel as off, not pending, when the workflow is off", () => {
    expect(visualEmptyMessage("uat", false)).toBe(
      "Visual testing is off in this repository's workflow, so no screenshots are taken on uat.",
    );
    expect(visualEmptyMessage("uat", true)).toBe(
      "No visual checks reported for uat yet. They run with the browser tests after each deploy.",
    );
    expect(visualEmptyMessage("main", null)).toBe(
      "No visual checks reported for main yet. They run with the browser tests after each deploy.",
    );
  });
});

describe("the Browser tests card's notice", () => {
  it("says nothing when visual is on, unknown, or not reported", () => {
    expect(visualOffNotice(null)).toBeNull();
    expect(visualOffNotice({ dev: true, uat: true })).toBeNull();
    expect(visualOffNotice({ dev: null, uat: null })).toBeNull();
    expect(visualOffNotice({ dev: true, uat: null })).toBeNull();
    expect(visualOffNotice({ dev: null, uat: true })).toBeNull();
  });

  it("offers the workflow update pull request when dev is off", () => {
    expect(visualOffNotice({ dev: false, uat: false })).toEqual({ line: VISUAL_OFF_LINE, fix: "update-workflow" });
    expect(visualOffNotice({ dev: false, uat: null })).toEqual({ line: VISUAL_OFF_ON_DEV_LINE, fix: "update-workflow" });
    expect(visualOffNotice({ dev: false, uat: true })).toEqual({ line: VISUAL_OFF_ON_DEV_LINE, fix: "update-workflow" });
  });

  it("says to promote when dev is on and uat is off", () => {
    expect(visualOffNotice({ dev: true, uat: false })).toEqual({ line: VISUAL_OFF_LINE, fix: "promote" });
    expect(VISUAL_PROMOTE_LINE).toBe("Turned on in dev. Promote to uat to start capturing screenshots.");
  });

  it("says off with no fix to offer when dev's workflow could not be read", () => {
    expect(visualOffNotice({ dev: null, uat: false })).toEqual({ line: VISUAL_OFF_LINE, fix: "none" });
  });

  it("uses the agreed sentence", () => {
    expect(VISUAL_OFF_LINE).toBe("Visual testing is off in this repository's workflow.");
  });
});

describe("who may be sent to the workflow update pull request", () => {
  const offered = {
    workflowTabVisible: true,
    updatePrEnabled: true,
    settingsPreviewEnabled: true,
    projectWorkflowSettings: true as boolean | undefined,
  };

  it("opens it for a role that can create the pull request", () => {
    expect(workflowUpdateAccess({ ...offered, appRole: "member" })).toBe("open");
    expect(workflowUpdateAccess({ ...offered, appRole: "lead" })).toBe("open");
    expect(workflowUpdateAccess({ ...offered, appRole: "admin" })).toBe("open");
  });

  it("gives the role reason to a role that cannot, or without the Workflow tab", () => {
    expect(workflowUpdateAccess({ ...offered, appRole: "qa" })).toBe("role");
    expect(workflowUpdateAccess({ ...offered, appRole: undefined })).toBe("role");
    expect(workflowUpdateAccess({ ...offered, appRole: "admin", workflowTabVisible: false })).toBe("role");
  });

  it("offers nothing where the deployment or project has no update pull request", () => {
    expect(workflowUpdateAccess({ ...offered, appRole: "admin", updatePrEnabled: false })).toBe("unavailable");
    expect(workflowUpdateAccess({ ...offered, appRole: "admin", settingsPreviewEnabled: false })).toBe("unavailable");
    expect(workflowUpdateAccess({ ...offered, appRole: "admin", projectWorkflowSettings: undefined })).toBe("unavailable");
    expect(workflowUpdateAccess({ ...offered, appRole: "qa", projectWorkflowSettings: false })).toBe("unavailable");
  });
});
