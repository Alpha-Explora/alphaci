import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CodeTab } from "../../../../../../src/features/projects/detail/views/workspace/code-tab";
import {
  getProjectBranches,
  getProjectFileCommits,
  getProjectFiles,
} from "../../../../../../src/features/projects/detail/data/project-workspace-api";

jest.mock("../../../../../../src/features/projects/detail/data/project-workspace-api", () => ({
  getProjectBranches: jest.fn(),
  getProjectFiles: jest.fn(),
  getProjectFileCommits: jest.fn(),
}));

const branches = getProjectBranches as jest.Mock;
const files = getProjectFiles as jest.Mock;
const fileCommits = getProjectFileCommits as jest.Mock;

const commit = (message: string, committedAt = "2026-10-01T08:00:00Z") => ({
  sha: "6a251c8aaaaaaa",
  shortSha: "6a251c8",
  message,
  committedAt,
  authorLogin: "antoneeeeems",
  authorName: "Anton",
  authorAvatarUrl: null,
});

const ROOT = {
  path: "",
  ref: "main",
  file: null,
  entries: [
    { name: ".github", path: ".github", type: "dir", size: 0, sha: "d1" },
    { name: "README.md", path: "README.md", type: "file", size: 1900, sha: "f1" },
  ],
};

let root: Root | null = null;
let container: HTMLElement;

beforeEach(() => {
  branches.mockResolvedValue({ branches: [{ name: "main" }], defaultBranch: "main" });
  files.mockResolvedValue(ROOT);
  fileCommits.mockResolvedValue({
    path: "",
    ref: "main",
    latest: commit("Gate FE Sonar quality on main PRs"),
    totalCommits: 288,
    entries: {
      ".github": commit("Gate FE Sonar quality on main PRs"),
      "README.md": commit("docs: record trini hopecard service split correction", "2026-09-20T08:00:00Z"),
    },
  });
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  jest.clearAllMocks();
});

async function poll(check: () => boolean, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error("condition not met");
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<CodeTab projectId="p1" />);
  });
}

const row = (name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button.code-tree__row")].find(
    (button) => button.querySelector(".ws-tree__name")?.textContent === name,
  );

describe("CodeTab commit column", () => {
  it("shows each entry's last commit and when, and the folder's latest commit with the count", async () => {
    await mount();
    await poll(() => container.textContent?.includes("288 Commits") ?? false);

    expect(fileCommits).toHaveBeenCalledWith("p1", { path: "", ref: "main" });

    const readme = row("README.md")!;
    expect(readme.querySelector(".code-tree__message")?.textContent).toBe(
      "docs: record trini hopecard service split correction",
    );
    expect(readme.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-20T08:00:00Z");

    const bar = container.querySelector(".code-commit-bar")!;
    expect(bar.textContent).toContain("antoneeeeems");
    expect(bar.textContent).toContain("Gate FE Sonar quality on main PRs");
    expect(bar.textContent).toContain("6a251c8");
    // ALPHACI is the only place people are sent: no GitHub links.
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
  });

  it("lists the files first and fills the column in when the commits arrive", async () => {
    let resolveCommits: (value: unknown) => void = () => {};
    fileCommits.mockReturnValue(new Promise((resolve) => (resolveCommits = resolve)));

    await mount();
    await poll(() => row("README.md") !== undefined);
    expect(row("README.md")!.querySelector(".code-tree__message")?.textContent).toBe("");
    expect(container.textContent).toContain("Loading the latest commit");

    await act(async () => {
      resolveCommits({
        path: "",
        ref: "main",
        latest: commit("Gate FE Sonar quality on main PRs"),
        totalCommits: 1,
        entries: { "README.md": commit("readme edit") },
      });
    });
    await poll(() => container.textContent?.includes("1 Commit") ?? false);
    expect(row("README.md")!.querySelector(".code-tree__message")?.textContent).toBe("readme edit");
  });

  it("keeps the file list as it was when the commits cannot be read", async () => {
    fileCommits.mockRejectedValue(new Error("GitHub path commits failed (502)"));

    await mount();
    await poll(() => fileCommits.mock.calls.length > 0);
    await poll(() => !container.textContent?.includes("Loading the latest commit"));

    expect(row("README.md")).toBeDefined();
    expect(container.querySelector(".code-commit-bar")).toBeNull();
    expect(container.textContent).not.toContain("could not be read");
  });

  it("asks again for the folder that is opened", async () => {
    await mount();
    await poll(() => fileCommits.mock.calls.length === 1);
    files.mockResolvedValue({
      path: ".github",
      ref: "main",
      file: null,
      entries: [{ name: "workflows", path: ".github/workflows", type: "dir", size: 0, sha: "d2" }],
    });

    await act(async () => row(".github")!.click());
    await poll(() => fileCommits.mock.calls.length === 2);
    expect(fileCommits).toHaveBeenLastCalledWith("p1", { path: ".github", ref: "main" });
  });
});

