import {
  explainMergeState,
  mergeButtonLabel,
} from "../../../../../../src/features/projects/detail/model/pull-request-merge-rules";

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
