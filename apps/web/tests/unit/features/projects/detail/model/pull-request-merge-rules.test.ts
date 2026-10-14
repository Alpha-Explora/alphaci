import {
  canMergeViaWorkspace,
  explainMergeState,
  mergeButtonLabel,
  workspaceMergeGate,
} from "../../../../../../src/features/projects/detail/model/pull-request-merge-rules";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

describe("explainMergeState", () => {
  it("calls a clean pull request ready", () => {
    expect(explainMergeState("clean", false)).toEqual({
      tone: "ok",
      message: "Ready to merge.",
    });
  });

  it("explains 'unstable' as mergeable with non-required failing checks, not as a raw word", () => {
    const { tone, message } = explainMergeState("unstable", false);
    expect(tone).toBe("caution");
    expect(message).toContain("can still be merged");
    expect(message).not.toContain("'unstable'");
  });

  it("does not tell an author they need a reviewer when nothing is blocking", () => {
    // The old copy told every author a second reviewer was needed, even on a
    // branch with no review rule — which read as "you cannot merge".
    for (const state of ["clean", "unstable", "has_hooks"]) {
      expect(explainMergeState(state, true).message).not.toMatch(/review/i);
    }
  });

  it("names self-approval only when a protection rule is actually blocking", () => {
    expect(explainMergeState("blocked", true).message).toContain(
      "does not let you approve your own",
    );
    expect(explainMergeState("blocked", false).message).not.toContain(
      "your own",
    );
  });

  it.each([
    ["behind", "up to date"],
    ["dirty", "conflicts"],
    ["draft", "draft"],
  ])("blocks '%s' and says why", (state, phrase) => {
    const { tone, message } = explainMergeState(state, false);
    expect(tone).toBe("blocked");
    expect(message).toContain(phrase);
  });

  it("treats a state it does not know as pending, naming it", () => {
    expect(explainMergeState("mystery", false)).toEqual({
      tone: "pending",
      message: "GitHub reports this as 'mystery'.",
    });
  });
});

describe("mergeButtonLabel", () => {
  it("uses GitHub's words for each method", () => {
    expect(mergeButtonLabel("merge")).toBe("Merge");
    expect(mergeButtonLabel("squash")).toBe("Squash and merge");
    expect(mergeButtonLabel("rebase")).toBe("Rebase and merge");
  });
});

/**
 * Phase 1 security gates: the two 403s the backend sends for
 * `POST .../pull-requests/:number/merge` (PERSONA_WORKFLOW_SPEC.md §5, §8.1).
 */
describe("workspaceMergeGate / canMergeViaWorkspace", () => {
  const ROLES: ReadonlyArray<AppRole> = ["admin", "lead", "member"];

  it("blocks every role from merging into main through the workspace", () => {
    for (const role of ROLES) {
      expect(workspaceMergeGate(role, "main", "uat")).toEqual({
        allowed: false,
        reason: "main-via-qa-studio",
      });
      expect(canMergeViaWorkspace(role, "main", "uat")).toBe(false);
    }
  });

  it("blocks QA from merging anything here, even a non-main base", () => {
    expect(workspaceMergeGate("qa", "dev", "feature/x")).toEqual({
      allowed: false,
      reason: "qa-role",
    });
    expect(canMergeViaWorkspace("qa", "uat", "dev")).toBe(false);
  });

  it("gives QA's block priority when the base is also main", () => {
    expect(workspaceMergeGate("qa", "main", "uat")).toEqual({
      allowed: false,
      reason: "qa-role",
    });
  });

  it("allows a Developer feature -> dev and dev -> uat", () => {
    expect(canMergeViaWorkspace("member", "dev", "feature/x")).toBe(true);
    expect(canMergeViaWorkspace("member", "uat", "dev")).toBe(true);
  });

  it("restricts a Developer's other routes (feature -> uat, uat -> dev)", () => {
    expect(workspaceMergeGate("member", "uat", "feature/x")).toEqual({
      allowed: false,
      reason: "route-restricted",
    });
    expect(canMergeViaWorkspace("member", "dev", "uat")).toBe(false);
  });

  it("lets leads and admins merge any non-main route", () => {
    for (const role of ["lead", "admin"] as const) {
      expect(canMergeViaWorkspace(role, "uat", "feature/x")).toBe(true);
      expect(canMergeViaWorkspace(role, "dev", "uat")).toBe(true);
      expect(canMergeViaWorkspace(role, "dev", "feature/x")).toBe(true);
    }
  });

  it("denies a session with no known role, even for a non-main base", () => {
    expect(canMergeViaWorkspace(undefined, "dev", "feature/x")).toBe(false);
    expect(canMergeViaWorkspace(null, "dev", "feature/x")).toBe(false);
  });
});
