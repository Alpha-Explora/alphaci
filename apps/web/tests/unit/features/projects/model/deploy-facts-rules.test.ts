import {
  deployDotTone,
  deployDurationLabel,
  deployStatusWord,
  deployTriggerLabel,
  withPreviewCommitMessages,
} from "../../../../../src/features/projects/model/deploy-facts-rules";
import type {
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
} from "../../../../../src/shared/api/contracts";

describe("deploy facts", () => {
  it("names a replaced deploy, and keeps its dot quiet", () => {
    expect(deployStatusWord("superseded")).toBe("Replaced");
    expect(deployStatusWord("ready")).toBe("Live");
    expect(deployStatusWord("something_new")).toBe("something_new");
    expect(deployDotTone("superseded")).toBe("idle");
    expect(deployDotTone("failed")).toBe("danger");
  });

  it("says what started a deploy in words", () => {
    expect(deployTriggerLabel("api")).toBe("API");
    expect(deployTriggerLabel("new_commit")).toBe("New commit");
    expect(deployTriggerLabel("service_suspended")).toBe("Service suspended");
    expect(deployTriggerLabel(null)).toBeNull();
    expect(deployTriggerLabel("  ")).toBeNull();
  });

  it("times a finished deploy from when the host began it", () => {
    expect(
      deployDurationLabel({
        createdAt: "2026-10-17T17:42:00.835Z",
        startedAt: "2026-10-17T17:42:04.578Z",
        readyAt: "2026-10-17T17:42:25.078Z",
      }),
    ).toBe("21s");
    expect(
      deployDurationLabel({ createdAt: "2026-10-17T17:40:00.000Z", readyAt: "2026-10-17T17:41:05.000Z" }),
    ).toBe("1m 05s");
    expect(deployDurationLabel({ createdAt: "2026-10-17T17:40:00.000Z", readyAt: null })).toBeNull();
  });

  it("fills a Hosting row's missing message from the previews' lookup", () => {
    const row = { id: "dep-1", commitMessage: null } as ProjectDeploymentHistoryItem;
    const kept = { id: "dep-2", commitMessage: "own" } as ProjectDeploymentHistoryItem;
    const previews = [
      {
        recentDeploys: [
          { id: "dep-1", commitMessage: "fix(a11y): labels" },
          { id: "dep-2", commitMessage: "other" },
        ],
      },
    ] as unknown as ProjectBranchPreview[];

    expect(withPreviewCommitMessages([row, kept], previews).map((deploy) => deploy.commitMessage)).toEqual([
      "fix(a11y): labels",
      "own",
    ]);
    expect(withPreviewCommitMessages([row], null)[0]?.commitMessage).toBeNull();
  });
});
