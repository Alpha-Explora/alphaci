import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import { CodeTabPanel } from "../../../../../../src/features/projects/detail/views/code-tab-panel";
import { CommitsTabPanel } from "../../../../../../src/features/projects/detail/views/commits-tab-panel";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { commits: jest.fn() },
}));
jest.mock("../../../../../../src/features/projects/detail/views/workspace/code-tab", () => ({
  CodeTab: () => <div data-testid="files-only">files</div>,
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

const project = { id: "p1" } as never;

function vmFor(overrides: Record<string, unknown> = {}) {
  return {
    commitsBranch: null,
    visibleTabs: ["overview", "code", "commits", "pulls"],
    openPullRequest: jest.fn(),
    ...overrides,
  } as never;
}

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
  return container;
}

function commits(branch: string) {
  return {
    branch,
    branches: ["dev", "uat", "main"],
    items: [
      {
        sha: "a".repeat(40),
        shortSha: "aaaaaaa",
        message: "Add checkout",
        authorLogin: "ana",
        authorName: "Ana",
        authoredAt: "2026-10-02T10:00:00Z",
        url: "",
        pullRequestNumber: 7,
      },
    ],
    next: null,
  } as never;
}

describe("Code tab panel", () => {
  it("renders the files only: no commits list, no commits request", async () => {
    const container = await mount(<CodeTabPanel project={project} vm={vmFor()} />);
    expect(container.querySelector("[data-testid='files-only']")).not.toBeNull();
    expect(container.querySelector(".commits")).toBeNull();
    expect(container.textContent).not.toContain("Commits");
    expect(repo.commits).not.toHaveBeenCalled();
  });
});

describe("Commits tab panel", () => {
  it("asks for the server's default branch, with one selector and the PR link opening Pull requests", async () => {
    repo.commits.mockResolvedValue(commits("dev"));
    const vm = vmFor();
    const container = await mount(<CommitsTabPanel project={project} vm={vm} />);
    await poll(() => container.querySelector("li.commits__row:not(.commits__row--skeleton)") !== null);

    expect(container.querySelector("#project-detail-panel-commits")).not.toBeNull();
    expect(container.querySelectorAll("select")).toHaveLength(1);
    expect(repo.commits).toHaveBeenCalledWith("p1", { branch: null, limit: 30 });
    await act(async () => container.querySelector<HTMLAnchorElement>("a.commits__text--link")!.click());
    expect((vm as { openPullRequest: jest.Mock }).openPullRequest).toHaveBeenCalledWith(7);
  });

  it("opens on the branch a deep link names", async () => {
    repo.commits.mockResolvedValue(commits("uat"));
    const container = await mount(<CommitsTabPanel project={project} vm={vmFor({ commitsBranch: "uat" })} />);
    await poll(() => container.querySelector("li.commits__row:not(.commits__row--skeleton)") !== null);
    expect(repo.commits).toHaveBeenCalledWith("p1", { branch: "uat", limit: 30 });
    expect(container.querySelector<HTMLSelectElement>("select")!.value).toBe("uat");
  });

  it("sends Browse files to the Code tab at that commit, only when the viewer has the Code tab", async () => {
    repo.commits.mockResolvedValue(commits("dev"));
    const vm = vmFor({ openCodeAt: jest.fn() });
    const container = await mount(<CommitsTabPanel project={project} vm={vm} />);
    await poll(() => container.querySelector(".commits__browse") !== null);
    await act(async () => container.querySelector<HTMLButtonElement>(".commits__browse")!.click());
    expect((vm as { openCodeAt: jest.Mock }).openCodeAt).toHaveBeenCalledWith({
      sha: "a".repeat(40),
      shortSha: "aaaaaaa",
      branch: "dev",
    });

    act(() => root?.unmount());
    root = null;
    const noCode = await mount(
      <CommitsTabPanel project={project} vm={vmFor({ visibleTabs: ["overview", "commits"], openCodeAt: jest.fn() })} />,
    );
    await poll(() => noCode.querySelector("li.commits__row:not(.commits__row--skeleton)") !== null);
    expect(noCode.querySelector(".commits__browse")).toBeNull();
  });
});
