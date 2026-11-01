import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  getProjectPullRequestDetail,
  mergeProjectPullRequest,
  type PullRequestDetailResponse,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import {
  usePullRequestReviewViewModel,
  type PullRequestReviewViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-pull-request-review-view-model";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectPullRequestDetail: jest.fn(),
    mergeProjectPullRequest: jest.fn(),
  }),
);

const mockDetail = getProjectPullRequestDetail as jest.MockedFunction<
  typeof getProjectPullRequestDetail
>;
const mockMerge = mergeProjectPullRequest as jest.MockedFunction<
  typeof mergeProjectPullRequest
>;

const DETAIL: PullRequestDetailResponse = {
  repoFullName: "org/repo",
  checks: [],
  viewerIsAuthor: true,
  pullRequest: {
    number: 1,
    title: "Logistics management platform",
    state: "open",
    draft: false,
    merged: false,
    htmlUrl: "",
    headRef: "feat/logistics",
    baseRef: "dev",
    author: "LloydLim1",
    authorAvatarUrl: null,
    createdAt: "",
    updatedAt: "",
    additions: null,
    deletions: null,
    changedFiles: null,
    mergeable: true,
    mergeableState: "unstable",
    headSha: "aa89d92",
    body: null,
  },
};

let vm: PullRequestReviewViewModel | null = null;
const onMerged = jest.fn();

function Probe() {
  const model = usePullRequestReviewViewModel({
    projectId: "p1",
    pullNumber: 1,
    enabled: true,
    onMerged,
  });
  useLayoutEffect(() => {
    vm = model;
  }, [model]);
  return null;
}

function current(): PullRequestReviewViewModel {
  if (!vm) throw new Error("the ViewModel has not rendered");
  return vm;
}

describe("usePullRequestReviewViewModel merging", () => {
  let root: Root;

  beforeEach(async () => {
    vm = null;
    jest.resetAllMocks();
    mockDetail.mockResolvedValue(DETAIL);
    root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("merges with a merge commit unless told otherwise", async () => {
    mockMerge.mockResolvedValue({ merged: true, message: "Merged.", sha: "x" });

    await act(async () => {
      await current().merge();
    });

    expect(mockMerge).toHaveBeenCalledWith("p1", 1, "merge");
  });

  it("sends the method the person picked", async () => {
    mockMerge.mockResolvedValue({ merged: true, message: "Merged.", sha: "x" });

    act(() => current().setMergeMethod("squash"));
    await act(async () => {
      await current().merge();
    });

    expect(mockMerge).toHaveBeenCalledWith("p1", 1, "squash");
  });

  it("tells the list once GitHub reports the merge happened", async () => {
    mockMerge.mockResolvedValue({ merged: true, message: "Merged.", sha: "x" });

    await act(async () => {
      await current().merge();
    });

    expect(onMerged).toHaveBeenCalledWith(1);
    expect(current().mergeFailed).toBe(false);
  });

  it("keeps GitHub's refusal on screen and does not report a merge", async () => {
    mockMerge.mockResolvedValue({
      merged: false,
      message: "Squash merges are not allowed on this repository.",
      sha: null,
    });

    await act(async () => {
      await current().merge();
    });

    expect(onMerged).not.toHaveBeenCalled();
    expect(current().mergeFailed).toBe(true);
    expect(current().mergeMessage).toBe(
      "Squash merges are not allowed on this repository.",
    );
  });

  /** Phase 1 security gate: MAIN_MERGE_VIA_QA_STUDIO (PERSONA_WORKFLOW_SPEC.md §8.1). */
  it("shows the backend's MAIN_MERGE_VIA_QA_STUDIO sentence, not the raw server message", async () => {
    mockMerge.mockRejectedValue(
      new ApiError("Request failed with status 403", 403, {
        code: "MAIN_MERGE_VIA_QA_STUDIO",
        message: "generic backend text",
      }),
    );

    await act(async () => {
      await current().merge();
    });

    expect(current().mergeFailed).toBe(true);
    expect(current().mergeMessage).toBe(
      "Merges into main go through PO Studio — Ready for production.",
    );
  });
});
