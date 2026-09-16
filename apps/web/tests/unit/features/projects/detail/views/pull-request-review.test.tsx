import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PullRequestsTab } from "../../../../../../src/features/projects/detail/views/workspace/pull-requests-tab";
import {
  getProjectPullRequests,
  getProjectPullRequestFiles,
  getProjectPullRequestDetail,
  mergeProjectPullRequest,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectPullRequests: jest.fn(),
    getProjectPullRequestFiles: jest.fn(),
    getProjectPullRequestDetail: jest.fn(),
    mergeProjectPullRequest: jest.fn(),
  }),
);

const mockedList = getProjectPullRequests as jest.MockedFunction<
  typeof getProjectPullRequests
>;
const mockedFiles = getProjectPullRequestFiles as jest.MockedFunction<
  typeof getProjectPullRequestFiles
>;
const mockedDetail = getProjectPullRequestDetail as jest.MockedFunction<
  typeof getProjectPullRequestDetail
>;
const mockedMerge = mergeProjectPullRequest as jest.MockedFunction<
  typeof mergeProjectPullRequest
>;

const pr = {
  number: 1,
  title: "Update ALPHACI workflow configuration",
  state: "open" as const,
  draft: false,
  merged: false,
  htmlUrl: "https://github.com/o/r/pull/1",
  headRef: "alphaci/workflow-update-20260910140909",
  baseRef: "main",
  author: "LloydLim1",
  authorAvatarUrl: null,
  createdAt: "2026-09-10T14:09:00Z",
  updatedAt: "2026-09-10T14:09:00Z",
  additions: 4,
  deletions: 4,
  changedFiles: 4,
};

/**
 * The tab used to offer one link: "Review and merge on GitHub". These assert
 * the decision can now be made here — the checks are shown, the reason GitHub
 * is holding it back is said in words, and merging is possible without leaving.
 */
describe("PullRequestsTab review panel", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  async function render() {
    await act(async () => {
      root = createRoot(host);
      root.render(<PullRequestsTab projectId="p1" />);
    });
    // The panel loads when a row expands.
    const toggle = host.querySelector<HTMLButtonElement>(".ws-pr__head");
    await act(async () => toggle?.click());
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    mockedList.mockResolvedValue({
      repoFullName: "o/r",
      pullsUrl: "https://github.com/o/r/pulls",
      pullRequests: [pr],
    });
    mockedFiles.mockResolvedValue([]);
    mockedDetail.mockResolvedValue({
      repoFullName: "o/r",
      pullRequest: {
        ...pr,
        mergeable: true,
        mergeableState: "blocked",
        headSha: "b7460f77",
        body: null,
      },
      checks: [
        {
          name: "ALPHACI Env Guard / env-guard",
          status: "completed",
          conclusion: "success",
          detailsUrl: "https://github.com/o/r/runs/1",
          startedAt: null,
          completedAt: null,
        },
        {
          name: "SonarCloud Code Analysis",
          status: "completed",
          conclusion: "success",
          detailsUrl: null,
          startedAt: null,
          completedAt: null,
        },
      ],
      viewerIsAuthor: true,
    });
    mockedMerge.mockResolvedValue({
      merged: false,
      message:
        "At least 1 approving review is required by reviewers with write access.",
      sha: null,
    });
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  it("shows the checks in the system instead of linking out for them", async () => {
    await render();

    expect(host.textContent).toContain("ALPHACI Env Guard / env-guard");
    expect(host.textContent).toContain("SonarCloud Code Analysis");
  });

  it("no longer offers 'Review and merge on GitHub' as the way forward", async () => {
    await render();

    expect(host.textContent).not.toContain("Review and merge on GitHub");
    // GitHub stays reachable, just not as the only route.
    expect(host.textContent).toContain("Open on GitHub");
  });

  it("explains a blocked pull request rather than only reporting it", async () => {
    await render();

    expect(host.textContent).toContain("branch protection rule");
  });

  it("says a viewer cannot approve their own pull request", async () => {
    // GitHub refuses it outright, so the UI has to account for it rather than
    // offer an action that can only fail.
    await render();

    expect(host.textContent).toContain("does not allow approving your own");
  });

  it("repeats GitHub's refusal verbatim after a failed merge", async () => {
    await render();

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeDefined();

    await act(async () => merge?.click());

    expect(host.textContent).toContain(
      "At least 1 approving review is required",
    );
  });

  it("does not offer merge on a pull request already merged", async () => {
    mockedDetail.mockResolvedValue({
      repoFullName: "o/r",
      pullRequest: {
        ...pr,
        merged: true,
        mergeable: null,
        mergeableState: "clean",
        headSha: "b7460f77",
        body: null,
      },
      checks: [],
      viewerIsAuthor: false,
    });

    await render();

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeUndefined();
    expect(host.textContent).toContain("is merged");
  });
});
