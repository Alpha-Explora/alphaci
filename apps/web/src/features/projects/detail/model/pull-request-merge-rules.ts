/**
 * What GitHub's `mergeable_state` means for the person deciding, in words.
 *
 * Pure so every state is testable. The old inline version fell through to
 * "GitHub reports this as 'unstable'" for the most common state of a pull
 * request with a red check, and told every author that a second reviewer was
 * needed even on a branch that requires no review at all — which read as
 * "you cannot merge this" when they could.
 */

export type MergeTone = "ok" | "caution" | "blocked" | "pending";

export interface MergeExplanation {
  tone: MergeTone;
  message: string;
}

export function explainMergeState(
  mergeableState: string,
  viewerIsAuthor: boolean,
): MergeExplanation {
  switch (mergeableState) {
    case "clean":
      return { tone: "ok", message: "Ready to merge." };
    case "unstable":
      // Mergeable, with checks that failed or are still running. Nothing on
      // the base branch requires them, or the state would be `blocked`.
      return {
        tone: "caution",
        message:
          "Some checks failed or are still running. The base branch does not require them, so this can still be merged — look at them first.",
      };
    case "has_hooks":
      return { tone: "ok", message: "Ready to merge; GitHub will run the repository's merge hooks." };
    case "behind":
      return {
        tone: "blocked",
        message:
          "The base branch has moved on, and this repository requires branches to be up to date before merging. Update the branch first.",
      };
    case "dirty":
      return {
        tone: "blocked",
        message:
          "The branch conflicts with its base and has to be updated before it can merge.",
      };
    case "draft":
      return {
        tone: "blocked",
        message: "This is a draft. Mark it ready for review before merging.",
      };
    case "blocked":
      return {
        tone: "blocked",
        message: viewerIsAuthor
          ? "A branch protection rule is not satisfied yet, usually a required review — and GitHub does not let you approve your own pull request, so a teammate has to."
          : "A branch protection rule on the base branch is not satisfied yet, usually a required review or check.",
      };
    case "unknown":
      return {
        tone: "pending",
        message:
          "GitHub is still working out whether this can merge. Reload in a moment.",
      };
    default:
      return { tone: "pending", message: `GitHub reports this as '${mergeableState}'.` };
  }
}

/** The merge button's label, in GitHub's own words for each method. */
export function mergeButtonLabel(method: "merge" | "squash" | "rebase"): string {
  if (method === "squash") return "Squash and merge";
  if (method === "rebase") return "Rebase and merge";
  return "Merge";
}
