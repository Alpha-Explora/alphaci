import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  compareProjectBranches,
  createProjectPullRequest,
  getProjectBranches,
  type BranchComparisonResponse,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";
import {
  useCreatePullRequestViewModel,
  type CreatePullRequestViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-create-pull-request-view-model";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectBranches: jest.fn(),
    compareProjectBranches: jest.fn(),
    createProjectPullRequest: jest.fn(),
  }),
);

const mockBranches = getProjectBranches as jest.MockedFunction<
  typeof getProjectBranches
>;
const mockCompare = compareProjectBranches as jest.MockedFunction<
  typeof compareProjectBranches
>;
const mockCreate = createProjectPullRequest as jest.MockedFunction<
  typeof createProjectPullRequest
>;

function comparison(
  head: string,
  overrides: Partial<BranchComparisonResponse["comparison"]> = {},
): BranchComparisonResponse {
  return {
    repoFullName: "org/repo",
    base: "main",
    head,
    existingPullRequest: null,
    comparison: {
      status: "ahead",
      aheadBy: 1,
      behindBy: 0,
      totalCommits: 1,
      commits: [
        { sha: "abc1234", headline: `Work on ${head}`, author: null, authoredAt: null },
      ],
      files: [],
      filesTruncated: false,
      ...overrides,
    },
  };
}

const PR = {
  number: 7,
  title: "Work on feature",
  state: "open" as const,
  draft: false,
  merged: false,
  htmlUrl: "https://github.com/org/repo/pull/7",
  headRef: "feature",
  baseRef: "main",
  author: "lloydlim1",
  authorAvatarUrl: null,
  createdAt: "",
  updatedAt: "",
  additions: null,
  deletions: null,
  changedFiles: null,
};

let vm: CreatePullRequestViewModel | null = null;
const onCreated = jest.fn();

function Probe() {
  const model = useCreatePullRequestViewModel({ projectId: "p1", onCreated });
  useLayoutEffect(() => {
    vm = model;
  }, [model]);
  return null;
}

function current(): CreatePullRequestViewModel {
  if (!vm) throw new Error("the ViewModel has not rendered");
  return vm;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** A promise the test resolves by hand, to order two in-flight requests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useCreatePullRequestViewModel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vm = null;
    jest.resetAllMocks();
    mockBranches.mockResolvedValue({
      defaultBranch: "main",
      branches: [
        { name: "main", protected: true, commitSha: "a" },
        { name: "feature", protected: false, commitSha: "b" },
        { name: "other", protected: false, commitSha: "c" },
      ],
    });
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    await flush();
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("opens on the default branch as the base, waiting for a head", () => {
    expect(current().status).toBe("choosing");
    expect(current().base).toBe("main");
    expect(current().head).toBe("");
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("compares once a head is chosen and suggests a title from the commit", async () => {
    mockCompare.mockResolvedValue(comparison("feature"));

    act(() => current().setHead("feature"));
    expect(current().status).toBe("comparing");
    await flush();

    expect(mockCompare).toHaveBeenCalledWith("p1", "main", "feature");
    expect(current().status).toBe("ready");
    expect(current().title).toBe("Work on feature");
    expect(current().canSubmit).toBe(true);
  });

  it("keeps the newest comparison when an older one answers last", async () => {
    const slow = deferred<BranchComparisonResponse>();
    mockCompare
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(comparison("other"));

    act(() => current().setHead("feature"));
    act(() => current().setHead("other"));
    await flush();
    await act(async () => {
      slow.resolve(comparison("feature"));
      await slow.promise;
    });

    expect(current().compare?.head).toBe("other");
  });

  it("does not overwrite a title the person typed when the branch changes", async () => {
    mockCompare.mockResolvedValue(comparison("feature"));
    act(() => current().setHead("feature"));
    await flush();

    act(() => current().setTitle("My own words"));
    mockCompare.mockResolvedValue(comparison("other"));
    act(() => current().setHead("other"));
    await flush();

    expect(current().title).toBe("My own words");
  });

  it("will not submit when there is nothing to merge", async () => {
    mockCompare.mockResolvedValue(
      comparison("feature", { status: "identical", aheadBy: 0, commits: [] }),
    );
    act(() => current().setHead("feature"));
    await flush();

    expect(current().readiness?.canCreate).toBe(false);
    expect(current().canSubmit).toBe(false);
    await act(async () => {
      await current().submit();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows GitHub's refusal and keeps the form as it was", async () => {
    mockCompare.mockResolvedValue(comparison("feature"));
    mockCreate.mockResolvedValue({
      created: false,
      message: "Your GitHub account does not have write access to org/repo.",
    });
    act(() => current().setHead("feature"));
    await flush();
    act(() => current().setBody("Why this change"));

    await act(async () => {
      await current().submit();
    });

    expect(current().status).toBe("ready");
    expect(current().submitMessage).toContain("does not have write access");
    expect(current().body).toBe("Why this change");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("hands the created pull request to the caller", async () => {
    mockCompare.mockResolvedValue(comparison("feature"));
    mockCreate.mockResolvedValue({ created: true, pullRequest: PR });
    act(() => current().setHead("feature"));
    await flush();
    act(() => current().setDraft(true));

    await act(async () => {
      await current().submit();
    });

    expect(mockCreate).toHaveBeenCalledWith("p1", {
      base: "main",
      head: "feature",
      title: "Work on feature",
      draft: true,
    });
    expect(onCreated).toHaveBeenCalledWith(PR);
  });

  it("retries the branch list, not a comparison, when the list failed", async () => {
    act(() => root.unmount());
    mockBranches.mockReset();
    mockBranches.mockRejectedValueOnce(new Error("down"));
    root = createRoot(container);
    await act(async () => {
      root.render(<Probe />);
    });
    await flush();
    expect(current().status).toBe("error");

    mockBranches.mockResolvedValueOnce({
      defaultBranch: "main",
      branches: [{ name: "main", protected: true, commitSha: "a" }],
    });
    act(() => current().retry());
    await flush();

    expect(current().status).toBe("choosing");
    expect(mockCompare).not.toHaveBeenCalled();
  });
});
