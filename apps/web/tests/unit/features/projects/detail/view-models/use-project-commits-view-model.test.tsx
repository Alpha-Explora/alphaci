import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import {
  useProjectCommitsViewModel,
  type ProjectCommitsViewModel,
} from "../../../../../../src/features/projects/detail/view-models/use-project-commits-view-model";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { commits: jest.fn() },
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

function commit(sha: string, pullRequestNumber: number | null = 7) {
  return {
    sha: sha.repeat(40).slice(0, 40),
    shortSha: sha.repeat(7).slice(0, 7),
    message: `Commit ${sha}`,
    authorLogin: "ana",
    authorName: "Ana",
    authoredAt: "2026-10-02T10:00:00Z",
    url: "https://github.com/o/r/commit/x",
    pullRequestNumber,
  };
}

function page(branch: string, items: unknown[], next: string | null = null) {
  return { branch, branches: ["main", "uat", "dev", "feature/x"], items, next } as never;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let root: Root | null = null;
let latest: ProjectCommitsViewModel | null = null;

function Harness({ projectId, onRender }: Readonly<{ projectId: string; onRender: (vm: ProjectCommitsViewModel) => void }>) {
  onRender(useProjectCommitsViewModel({ projectId }));
  return null;
}

function vm(): ProjectCommitsViewModel {
  if (!latest) throw new Error("not rendered");
  return latest;
}

async function render(projectId = "p1") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness projectId={projectId} onRender={(value) => (latest = value)} />);
  });
}

async function poll(check: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  latest = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

describe("useProjectCommitsViewModel", () => {
  it("asks for the server's default branch first, then shows its commits and the selector's options", async () => {
    repo.commits.mockResolvedValue(page("dev", [commit("a"), commit("b", null)]));
    await render();
    await poll(() => vm().status === "ready");

    expect(repo.commits).toHaveBeenCalledWith("p1", { branch: null, limit: 30 });
    expect(vm().branch).toBe("dev");
    expect(vm().branchOptions).toEqual(["dev", "uat", "main"]);
    expect(vm().rows.map((row) => row.directPush)).toEqual([false, true]);
    expect(vm().hasMore).toBe(false);
  });

  it("reads as loading on a branch switch, keeps the options, and ignores a slow answer for the old branch", async () => {
    const slowDev = deferred<never>();
    repo.commits.mockResolvedValueOnce(page("dev", [commit("a")]));
    await render();
    await poll(() => vm().status === "ready");

    repo.commits.mockReturnValueOnce(slowDev.promise).mockResolvedValueOnce(page("main", [commit("m", null)]));
    await act(async () => vm().selectBranch("uat"));
    expect(vm().status).toBe("loading");
    expect(vm().branch).toBe("uat");
    expect(vm().branchOptions).toEqual(["dev", "uat", "main"]);

    await act(async () => vm().selectBranch("main"));
    await poll(() => vm().status === "ready");
    expect(vm().branch).toBe("main");
    // The uat answer arrives late and must not replace main's commits.
    await act(async () => {
      slowDev.resolve(page("uat", [commit("u")]));
      await Promise.resolve();
    });
    expect(vm().branch).toBe("main");
    expect(vm().rows.map((row) => row.title)).toEqual(["Commit m"]);
    expect(repo.commits).toHaveBeenLastCalledWith("p1", { branch: "main", limit: 30 });
  });

  it("does nothing when the shown branch is picked again", async () => {
    repo.commits.mockResolvedValue(page("dev", [commit("a")]));
    await render();
    await poll(() => vm().status === "ready");
    await act(async () => vm().selectBranch("dev"));
    expect(repo.commits).toHaveBeenCalledTimes(1);
  });

  it("loads older commits on the shown branch with the cursor passed back unchanged", async () => {
    repo.commits
      .mockResolvedValueOnce(page("dev", [commit("a")], "cursor-1"))
      .mockResolvedValueOnce(page("dev", [commit("a"), commit("c")], null));
    await render();
    await poll(() => vm().hasMore);

    await act(async () => {
      await vm().loadMore();
    });
    expect(repo.commits).toHaveBeenLastCalledWith("p1", { branch: "dev", limit: 30, before: "cursor-1" });
    expect(vm().rows.map((row) => row.title)).toEqual(["Commit a", "Commit c"]);
    expect(vm().hasMore).toBe(false);
    expect(vm().loadingMore).toBe(false);
  });

  it("keeps the shown commits when an older page fails", async () => {
    repo.commits.mockResolvedValueOnce(page("dev", [commit("a")], "cursor-1")).mockRejectedValueOnce(new Error("boom"));
    await render();
    await poll(() => vm().hasMore);
    await act(async () => {
      await vm().loadMore();
    });
    expect(vm().loadMoreError).toBe("Unable to load older commits. Try again in a moment.");
    expect(vm().rows).toHaveLength(1);
  });

  it("maps a stale GitHub session to sign in again", async () => {
    repo.commits.mockRejectedValue(new ApiError("x", 401, { code: "GITHUB_REAUTH" }));
    await render("p 1");
    await poll(() => vm().status === "error");
    expect(vm().error).toBe("GitHub needs you to sign in again before ALPHACI can show this repository's commits.");
    expect(vm().signInHref).toBe("/login?next=/projects/p%201");
  });

  it("says a 404 is not visible, and retries on demand", async () => {
    repo.commits.mockRejectedValueOnce(new ApiError("x", 404)).mockResolvedValueOnce(page("dev", []));
    await render();
    await poll(() => vm().status === "error");
    expect(vm().error).toBe("This repository is not available to you, or it no longer exists.");
    expect(vm().signInHref).toBeNull();

    await act(async () => vm().retry());
    await poll(() => vm().status === "ready");
    expect(vm().rows).toEqual([]);
    expect(repo.commits).toHaveBeenCalledTimes(2);
  });
});
