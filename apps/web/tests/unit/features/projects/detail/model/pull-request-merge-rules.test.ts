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
      expect(workspaceMergeGate(role, "main")).toEqual({
        allowed: false,
        reason: "main-via-qa-studio",
      });
      expect(canMergeViaWorkspace(role, "main")).toBe(false);
    }
  });

  it("blocks QA from merging anything here, even a non-main base", () => {
    expect(workspaceMergeGate("qa", "dev")).toEqual({
      allowed: false,
      reason: "qa-role",
    });
    expect(canMergeViaWorkspace("qa", "uat")).toBe(false);
  });

  it("gives QA's block priority when the base is also main", () => {
    // Both reasons could apply; the role reason is the more specific one, and
    // the one the view uses to decide whether to say anything at all.
    expect(workspaceMergeGate("qa", "main")).toEqual({
      allowed: false,
      reason: "qa-role",
    });
  });

  it("allows admin, lead and member to merge into dev or uat", () => {
    for (const role of ROLES) {
      for (const base of ["dev", "uat"]) {
        expect(canMergeViaWorkspace(role, base)).toBe(true);
      }
    }
  });

  it("denies a session with no known role, even for a non-main base", () => {
    expect(canMergeViaWorkspace(undefined, "dev")).toBe(false);
    expect(canMergeViaWorkspace(null, "dev")).toBe(false);
  });
});
