import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PullRequestsTab } from "../../../../../../src/features/projects/detail/views/workspace/pull-requests-tab";
import { CreatePullRequestView } from "../../../../../../src/features/projects/detail/views/workspace/create-pull-request-view";
import type { AppRole } from "../../../../../../src/shared/api/contracts";
import {
  getProjectBranches,
  getProjectPullRequests,
  getProjectPullRequestFiles,
  getProjectPullRequestDetail,
  mergeProjectPullRequest,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";

jest.mock(
  "../../../../../../src/features/projects/detail/data/project-workspace-api",
  () => ({
    getProjectBranches: jest.fn(),
    compareProjectBranches: jest.fn(),
    createProjectPullRequest: jest.fn(),
    getProjectPullRequests: jest.fn(),
    getProjectPullRequestFiles: jest.fn(),
    getProjectPullRequestDetail: jest.fn(),
    mergeProjectPullRequest: jest.fn(),
  }),
);

const mockedBranches = getProjectBranches as jest.MockedFunction<
  typeof getProjectBranches
>;
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
  // Not `main`: that base is Phase 1's own gate (see the
  // "Phase 1 security gates" describe block below), and every test above it
  // is about ordinary merge-readiness behaviour, unrelated to the gate.
  baseRef: "dev",
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

  async function render(appRole: AppRole = "member", onOpenQaStudio?: () => void) {
    await act(async () => {
      root = createRoot(host);
      root.render(
        <PullRequestsTab
          projectId="p1"
          appRole={appRole}
          onOpenQaStudio={onOpenQaStudio}
        />,
      );
    });
    // The panel loads when a row expands.
    const toggle = host.querySelector<HTMLButtonElement>(".ws-pr__head");
    await act(async () => toggle?.click());
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    mockedBranches.mockResolvedValue({
      defaultBranch: "main",
      branches: [
        { name: "main", protected: true, commitSha: "a" },
        { name: "dev", protected: false, commitSha: "d" },
        { name: "feature", protected: false, commitSha: "b" },
      ],
    });
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

    // The fixture is `blocked`; on a branch with no review rule the sentence
    // is deliberately absent (see pull-request-merge-rules.test.ts).
    expect(host.textContent).toContain("does not let you approve your own");
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

/**
 * Phase 1 security gates (PERSONA_WORKFLOW_SPEC.md §3, §5, §8.1): what each
 * role sees for merging into `main`, and for opening a pull request at all.
 * Shares the same fixtures and mocks as the describe block above.
 */
describe("PullRequestsTab, Phase 1 security gates", () => {
  let root: Root | null = null;
  let host: HTMLDivElement;

  async function render(appRole: AppRole = "member", onOpenQaStudio?: () => void) {
    await act(async () => {
      root = createRoot(host);
      root.render(
        <PullRequestsTab
          projectId="p1"
          appRole={appRole}
          onOpenQaStudio={onOpenQaStudio}
        />,
      );
    });
    const toggle = host.querySelector<HTMLButtonElement>(".ws-pr__head");
    await act(async () => toggle?.click());
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);

    mockedBranches.mockResolvedValue({
      defaultBranch: "main",
      branches: [
        { name: "main", protected: true, commitSha: "a" },
        { name: "dev", protected: false, commitSha: "d" },
        { name: "feature", protected: false, commitSha: "b" },
      ],
    });
    mockedList.mockResolvedValue({
      repoFullName: "o/r",
      pullsUrl: "https://github.com/o/r/pulls",
      pullRequests: [pr],
    });
    mockedFiles.mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root?.unmount());
    host.remove();
    jest.clearAllMocks();
  });

  function detailWithBase(baseRef: string, headRef: string = pr.headRef) {
    return {
      repoFullName: "o/r",
      pullRequest: {
        ...pr,
        baseRef,
        headRef,
        mergeable: true,
        mergeableState: "clean",
        headSha: "b7460f77",
        body: null,
      },
      checks: [],
      viewerIsAuthor: false,
    };
  }

  it("does not offer Merge into main, and explains why, for a Team Lead", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("main"));

    await render("lead");

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeUndefined();
    expect(host.textContent).toContain(
      "Merges into main go through QA Studio — Ready for production.",
    );
  });

  it("lets a Team Lead follow the main-merge notice into QA Studio", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("main"));
    const onOpenQaStudio = jest.fn();

    await render("lead", onOpenQaStudio);

    const link = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Go to QA Studio",
    );
    expect(link).toBeDefined();
    await act(async () => link?.click());
    expect(onOpenQaStudio).toHaveBeenCalled();
  });

  it("gives a Developer the same main-merge notice, with no QA Studio link", async () => {
    // A Developer cannot open QA Studio at all, so nothing here should
    // promise a tab that is not there.
    mockedDetail.mockResolvedValue(detailWithBase("main"));
    const onOpenQaStudio = jest.fn();

    await render("member", onOpenQaStudio);

    expect(host.textContent).toContain("Merges into main go through QA Studio");
    const link = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Go to QA Studio",
    );
    expect(link).toBeUndefined();
  });

  it("hides Merge for a Developer on feature -> uat, with the route note", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("uat", "feature/x"));

    await render("member");

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeUndefined();
    expect(host.textContent).toContain(
      "Developers merge feature → dev and dev → uat pull requests. Ask a Team lead to merge this one.",
    );
  });

  it("still offers Merge to a Developer on dev -> uat", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("uat", "dev"));

    await render("member");

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeDefined();
  });

  it("still offers Merge to a Team Lead on feature -> uat", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("uat", "feature/x"));

    await render("lead");

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeDefined();
  });

  it("hides the merge action entirely for QA, on any base", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("dev"));

    await render("qa");

    expect(host.textContent).not.toContain("Merges into main");
    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeUndefined();
  });

  it("still offers the ordinary Merge button for a non-main base", async () => {
    mockedDetail.mockResolvedValue(detailWithBase("dev"));

    await render("lead");

    const merge = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Merge",
    );
    expect(merge).toBeDefined();
  });

  it("hides the 'New pull request' entry point for QA", async () => {
    await render("qa");

    expect(host.textContent).not.toContain("New pull request");
  });

  it("offers 'New pull request' to a Developer, and never lists main as a base", async () => {
    await render("member");

    const button = [...host.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "New pull request",
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());

    const baseSelect = host.querySelector<HTMLSelectElement>(".ws-select");
    expect(baseSelect).toBeDefined();
    const baseOptions = [...(baseSelect?.querySelectorAll("option") ?? [])].map(
      (option) => option.value,
    );
    // A Developer only opens into dev or uat; "feature" is not a base.
    expect(baseOptions).toEqual(["dev"]);
    // Custom could produce feature -> uat, so a Developer is not offered it.
    expect(host.textContent).toContain("Feature → Dev");
    expect(host.textContent).not.toContain("Custom");
    expect(baseOptions).not.toContain("main");
  });
});

/**
 * `CreatePullRequestView` reached directly — a stale UI state, or a link
 * typed by hand — rather than through the "New pull request" button
 * `PullRequestsTab` already hides for QA.
 */
describe("CreatePullRequestView, reached directly by QA", () => {
  beforeEach(() => {
    // The hook behind this view is called unconditionally regardless of
    // role (see the component's own comment), so it still needs somewhere
    // to resolve even though QA never sees what it loads.
    mockedBranches.mockResolvedValue({
      defaultBranch: "main",
      branches: [{ name: "main", protected: true, commitSha: "a" }],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a short notice instead of the compose form", async () => {
    let root: Root | null = null;
    const host = document.createElement("div");
    document.body.appendChild(host);

    await act(async () => {
      root = createRoot(host);
      root.render(
        <CreatePullRequestView
          projectId="p1"
          appRole="qa"
          onCancel={jest.fn()}
          onCreated={jest.fn()}
          onViewExisting={jest.fn()}
        />,
      );
    });

    expect(host.textContent).toContain("QA does not open pull requests.");
    expect(host.querySelector(".ws-compose__branches")).toBeNull();

    act(() => root?.unmount());
    host.remove();
  });
});
