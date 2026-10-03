import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { projectsRepository } from "../../../../../../src/features/projects/data/projects-repository";
import { CommitsSection } from "../../../../../../src/features/projects/detail/views/workspace/commits-section";
import { ApiError } from "../../../../../../src/shared/api/request";

jest.mock("../../../../../../src/features/projects/data/projects-repository", () => ({
  projectsRepository: { commits: jest.fn() },
}));

const repo = projectsRepository as jest.Mocked<typeof projectsRepository>;

function commit(letter: string, pullRequestNumber: number | null, message = `Commit ${letter}`) {
  return {
    sha: letter.repeat(40),
    shortSha: letter.repeat(7),
    message,
    authorLogin: "ana",
    authorName: "Ana",
    authoredAt: "2026-10-02T10:00:00Z",
    url: "https://github.com/o/r/commit/x",
    pullRequestNumber,
  };
}

function page(branch: string, items: unknown[], next: string | null = null) {
  return { branch, branches: ["main", "uat", "dev", "feature/x", "fix/y"], items, next } as never;
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

async function render(onOpenPullRequest?: (n: number) => void): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<CommitsSection projectId="p1" onOpenPullRequest={onOpenPullRequest} />);
  });
  return container;
}

function rows(container: HTMLElement): HTMLLIElement[] {
  return [...container.querySelectorAll<HTMLLIElement>("li.commits__row:not(.commits__row--skeleton)")];
}

function button(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === label);
}

describe("Commits on the Code tab", () => {
  it("lists commits newest first: short SHA, title, author, relative time with the exact one on hover", async () => {
    repo.commits.mockResolvedValue(page("dev", [commit("a", 12, "Add checkout\n\nbody"), commit("b", null)]));
    const container = await render(jest.fn());
    await poll(() => rows(container).length === 2);

    const [first, second] = rows(container);
    expect(first.querySelector(".commits__sha")?.textContent).toBe("aaaaaaa");
    expect(first.querySelector(".commits__sha")?.getAttribute("title")).toBe("a".repeat(40));
    expect(first.querySelector(".commits__text")?.textContent).toBe("Add checkout");
    expect(first.textContent).toContain("ana");
    const time = first.querySelector("time")!;
    expect(time.getAttribute("dateTime")).toBe("2026-10-02T10:00:00Z");
    expect(time.getAttribute("title")).toBeTruthy();
    expect(time.textContent).toMatch(/ago|just now/);
    expect(second.querySelector(".commits__text")?.textContent).toBe("Commit b");
  });

  it("tags a direct push on dev, uat or main, never a commit a pull request brought in", async () => {
    repo.commits.mockResolvedValue(page("dev", [commit("a", 12), commit("b", null)]));
    const container = await render();
    await poll(() => rows(container).length === 2);

    const [viaPr, direct] = rows(container);
    expect(viaPr.querySelector(".commits__tag")).toBeNull();
    expect(direct.querySelector(".commits__tag")?.textContent).toBe("Direct push");
    expect(direct.getAttribute("data-direct-push")).toBe("true");
  });

  it("does not tag a commit without a pull request on another branch", async () => {
    repo.commits.mockResolvedValue(page("feature/x", [commit("b", null)]));
    const container = await render();
    await poll(() => rows(container).length === 1);
    expect(container.querySelector(".commits__tag")).toBeNull();
    // An other branch shows in the select, not the segments.
    const select = container.querySelector<HTMLSelectElement>("select.commits__select")!;
    expect(select.value).toBe("feature/x");
    expect([...container.querySelectorAll(".commits__segment[aria-pressed='true']")]).toHaveLength(0);
  });

  it("links a commit's title to its pull request in the Pull requests tab", async () => {
    const onOpen = jest.fn();
    repo.commits.mockResolvedValue(page("dev", [commit("a", 12), commit("b", null)]));
    const container = await render(onOpen);
    await poll(() => rows(container).length === 2);

    const link = rows(container)[0].querySelector<HTMLAnchorElement>("a.commits__text")!;
    expect(link.getAttribute("title")).toBe("Open pull request #12 in Pull requests");
    expect(rows(container)[0].querySelector(".commits__pr")?.textContent).toBe("#12");
    expect(rows(container)[1].querySelector("a")).toBeNull();
    await act(async () => link.click());
    expect(onOpen).toHaveBeenCalledWith(12);
  });

  it("switches branch with the segmented control and with the select", async () => {
    repo.commits
      .mockResolvedValueOnce(page("dev", [commit("a", 1)]))
      .mockResolvedValueOnce(page("main", [commit("m", null)]))
      .mockResolvedValueOnce(page("fix/y", [commit("f", null)]));
    const container = await render();
    await poll(() => rows(container).length === 1);

    const segments = [...container.querySelectorAll<HTMLButtonElement>(".commits__segment")];
    expect(segments.map((b) => b.textContent)).toEqual(["dev", "uat", "main"]);
    expect(segments.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    const options = [...container.querySelectorAll("select.commits__select option")].map((o) => o.textContent);
    expect(options).toEqual(["Other branches", "feature/x", "fix/y"]);

    await act(async () => segments[2].click());
    await poll(() => container.textContent?.includes("Commit m") ?? false);
    expect(repo.commits).toHaveBeenLastCalledWith("p1", { branch: "main", limit: 30 });
    expect(button(container, "main")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".commits__tag")?.textContent).toBe("Direct push");

    const select = container.querySelector<HTMLSelectElement>("select.commits__select")!;
    await act(async () => {
      select.value = "fix/y";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await poll(() => container.textContent?.includes("Commit f") ?? false);
    expect(repo.commits).toHaveBeenLastCalledWith("p1", { branch: "fix/y", limit: 30 });
    expect(container.querySelector<HTMLSelectElement>("select.commits__select")!.value).toBe("fix/y");
    expect(container.querySelector(".commits__tag")).toBeNull();
  });

  it("loads more with the cursor, appending older commits", async () => {
    repo.commits
      .mockResolvedValueOnce(page("dev", [commit("a", 1)], "cursor-1"))
      .mockResolvedValueOnce(page("dev", [commit("c", null)], null));
    const container = await render();
    await poll(() => button(container, "Load more") !== undefined);

    await act(async () => button(container, "Load more")!.click());
    await poll(() => rows(container).length === 2);
    expect(repo.commits).toHaveBeenLastCalledWith("p1", { branch: "dev", limit: 30, before: "cursor-1" });
    expect(button(container, "Load more")).toBeUndefined();
  });

  it("copies the full SHA", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    repo.commits.mockResolvedValue(page("dev", [commit("a", 1)]));
    const container = await render();
    await poll(() => rows(container).length === 1);

    const sha = container.querySelector<HTMLButtonElement>(".commits__sha")!;
    expect(sha.getAttribute("aria-label")).toBe("Copy commit SHA aaaaaaa");
    await act(async () => sha.click());
    expect(writeText).toHaveBeenCalledWith("a".repeat(40));
    expect(sha.textContent).toBe("Copied");
  });

  it("shows a skeleton while loading, then the empty state", async () => {
    let resolve!: (value: never) => void;
    repo.commits.mockReturnValue(new Promise<never>((done) => (resolve = done)));
    const container = await render();
    expect(container.querySelector("[aria-label='Loading commits']")).not.toBeNull();
    await act(async () => resolve(page("uat", [])));
    await poll(() => container.textContent?.includes("No commits on uat yet.") ?? false);
  });

  it("offers sign in again for a stale GitHub session", async () => {
    repo.commits.mockRejectedValue(new ApiError("x", 401));
    const container = await render();
    await poll(() => container.querySelector(".commits__reauth") !== null);
    expect(container.textContent).toContain("GitHub needs you to sign in again");
    expect(container.querySelector<HTMLAnchorElement>(".commits__reauth a")?.getAttribute("href")).toBe("/login?next=/projects/p1");
  });

  it("offers a retry for any other failure", async () => {
    repo.commits.mockRejectedValueOnce(new ApiError("x", 502)).mockResolvedValueOnce(page("dev", [commit("a", 1)]));
    const container = await render();
    await poll(() => container.textContent?.includes("Commits could not be read from GitHub.") ?? false);
    await act(async () => button(container, "Retry")!.click());
    await poll(() => rows(container).length === 1);
  });
});
