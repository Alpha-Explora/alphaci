import {
  appendCommitsPage,
  branchOptions,
  commitAuthor,
  commitPullRequestLabel,
  commitsEmptyMessage,
  commitsLoadMoreLabel,
  commitTitle,
  isAlphaciBot,
  isDirectPush,
  normalizeCommitsPage,
  shaCopyLabel,
  shortShaOf,
} from "../../../../../../src/features/projects/detail/model/commit-list-rules";
import {
  githubReadFailure,
  needsGithubSignIn,
} from "../../../../../../src/features/projects/detail/model/github-read-failure";
import { ApiError } from "../../../../../../src/shared/api/request";

const SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function commit(overrides: Record<string, unknown> = {}) {
  return {
    sha: SHA,
    shortSha: "a1b2c3d",
    message: "Add checkout\n\nLonger body.",
    authorLogin: "ana",
    authorName: "Ana Dev",
    authoredAt: "2026-10-02T11:00:00Z",
    url: "https://github.com/org/repo/commit/a1b2c3d",
    pullRequestNumber: 12,
    ...overrides,
  };
}

describe("commitTitle", () => {
  it("is the first non-empty line, trimmed", () => {
    expect(commitTitle("Add checkout\n\nbody")).toBe("Add checkout");
    expect(commitTitle("\r\n  Fix login  \r\nmore")).toBe("Fix login");
  });

  it("says so when there is no message", () => {
    expect(commitTitle("")).toBe("(no message)");
    expect(commitTitle(null)).toBe("(no message)");
    expect(commitTitle(" \n ")).toBe("(no message)");
  });
});

describe("commitAuthor", () => {
  it("prefers the login, then the name", () => {
    expect(commitAuthor("ana", "Ana Dev")).toBe("ana");
    expect(commitAuthor(null, "Ana Dev")).toBe("Ana Dev");
    expect(commitAuthor(" ", "")).toBe("Unknown author");
    expect(commitAuthor(undefined, undefined)).toBe("Unknown author");
  });
});

describe("shortShaOf", () => {
  it("uses the server's short form, else seven characters", () => {
    expect(shortShaOf(SHA, "a1b2c3d4")).toBe("a1b2c3d4");
    expect(shortShaOf(SHA, null)).toBe("a1b2c3d");
    expect(shortShaOf(SHA)).toBe("a1b2c3d");
  });
});

describe("isDirectPush", () => {
  it.each([
    ["dev", null, true],
    ["uat", null, true],
    ["main", null, true],
    ["main", 4, false],
    ["feature/x", null, false],
    [null, null, false],
  ])("%s with PR %p -> %p", (branch, pr, expected) => {
    expect(isDirectPush(branch as string | null, pr as number | null)).toBe(expected);
  });
});

describe("normalizeCommitsPage", () => {
  it("reads a full page", () => {
    const page = normalizeCommitsPage({
      branch: "dev",
      branches: ["main", "dev", "feature/x"],
      items: [commit(), commit({ sha: "b".repeat(40), shortSha: "bbbbbbb", pullRequestNumber: null })],
      next: "cursor-1",
    });
    expect(page.branch).toBe("dev");
    expect(page.branches).toEqual(["main", "dev", "feature/x"]);
    expect(page.next).toBe("cursor-1");
    expect(page.items[0]).toEqual({
      sha: SHA,
      shortSha: "a1b2c3d",
      title: "Add checkout",
      author: "ana",
      authoredAt: "2026-10-02T11:00:00Z",
      pullRequestNumber: 12,
      directPush: false,
      alphaciSetup: false,
    });
    expect(page.items[1]).toMatchObject({ pullRequestNumber: null, directPush: true });
  });

  it("never tags a direct push off the promotion branches", () => {
    const page = normalizeCommitsPage({ branch: "feature/x", branches: [], items: [commit({ pullRequestNumber: null })], next: null });
    expect(page.items[0].directPush).toBe(false);
  });

  it("degrades a thin row and drops one without a SHA", () => {
    const page = normalizeCommitsPage({
      branch: "main",
      items: [
        { sha: SHA, pullRequestNumber: "12", authorName: "Ana Dev" },
        { message: "no sha" },
        "junk",
        null,
      ],
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      shortSha: "a1b2c3d",
      title: "(no message)",
      author: "Ana Dev",
      authoredAt: "",
      // A non-number PR number is no PR at all, so on main it is a direct push.
      pullRequestNumber: null,
      directPush: true,
    });
    expect(page.branches).toEqual([]);
    expect(page.next).toBeNull();
  });

  it("dedupes branch names and survives junk", () => {
    expect(normalizeCommitsPage({ branches: ["dev", "dev", 3, " "] }).branches).toEqual(["dev"]);
    expect(normalizeCommitsPage(null)).toEqual({ branch: null, branches: [], items: [], next: null });
    expect(normalizeCommitsPage([])).toEqual({ branch: null, branches: [], items: [], next: null });
  });
});

describe("appendCommitsPage", () => {
  it("adds older commits after the shown ones, skipping repeats, and moves the cursor", () => {
    const first = normalizeCommitsPage({ branch: "dev", branches: ["dev"], items: [commit()], next: "c1" });
    const second = normalizeCommitsPage({
      branch: "dev",
      items: [commit(), commit({ sha: "c".repeat(40) })],
      next: null,
    });
    const merged = appendCommitsPage(first, second);
    expect(merged.items.map((row) => row.sha)).toEqual([SHA, "c".repeat(40)]);
    expect(merged.next).toBeNull();
    expect(merged.branches).toEqual(["dev"]);
  });
});

describe("branchOptions", () => {
  it("offers dev, uat and main in promotion order, whichever the repository has", () => {
    expect(branchOptions(["main", "feature/a", "dev", "uat", "fix/b"], "dev")).toEqual(["dev", "uat", "main"]);
    expect(branchOptions(["main", "dev"], "dev")).toEqual(["dev", "main"]);
  });

  it("always offers the shown branch, even a deep-linked one or without a list", () => {
    expect(branchOptions(["main", "feature/a"], "feature/a")).toEqual(["main", "feature/a"]);
    expect(branchOptions([], "main")).toEqual(["main"]);
    expect(branchOptions([], null)).toEqual([]);
  });
});

describe("ALPHACI's GitHub App", () => {
  it.each([
    ["alphaci-enterprise[bot]", "x", true],
    ["AlphaCI-Enterprise[bot]", null, true],
    [null, "alphaci-enterprise[bot]", true],
    ["dependabot[bot]", "dependabot[bot]", false],
    ["alphaci-dev", "Alpha CI", false],
    ["ana", "alphaci[bot]x", false],
    [null, null, false],
  ])("login %p name %p -> %p", (login, name, expected) => {
    expect(isAlphaciBot(login as string | null, name as string | null)).toBe(expected);
  });

  it("is not a direct push, whichever branch; a person's commit without a PR is", () => {
    expect(isDirectPush("dev", null, true)).toBe(false);
    expect(isDirectPush("dev", null, false)).toBe(true);
  });

  it("labels the setup commit, tags the person's push, links the PR commit, leaves feature branches plain", () => {
    const rows = (branch: string, items: Record<string, unknown>[]) =>
      normalizeCommitsPage({ branch, branches: [], items, next: null }).items;
    const [setup, person, viaPr, dependabot] = rows("dev", [
      commit({ sha: "1".repeat(40), authorLogin: "alphaci-enterprise[bot]", authorName: "alphaci-enterprise[bot]", pullRequestNumber: null }),
      commit({ sha: "2".repeat(40), pullRequestNumber: null }),
      commit({ sha: "3".repeat(40), pullRequestNumber: 9 }),
      commit({ sha: "4".repeat(40), authorLogin: "dependabot[bot]", pullRequestNumber: null }),
    ]);
    expect([setup.alphaciSetup, setup.directPush]).toEqual([true, false]);
    expect([person.alphaciSetup, person.directPush]).toEqual([false, true]);
    expect([viaPr.alphaciSetup, viaPr.directPush, viaPr.pullRequestNumber]).toEqual([false, false, 9]);
    // Other bots keep today's behaviour.
    expect([dependabot.alphaciSetup, dependabot.directPush]).toEqual([false, true]);
    const [onFeature] = rows("feature/x", [commit({ sha: "5".repeat(40), pullRequestNumber: null })]);
    expect([onFeature.alphaciSetup, onFeature.directPush]).toEqual([false, false]);
  });
});

describe("labels", () => {
  it("words the empty list, the PR link, Load more and the copy button", () => {
    expect(commitsEmptyMessage("uat")).toBe("No commits on uat yet.");
    expect(commitsEmptyMessage(null)).toBe("No commits yet.");
    expect(commitPullRequestLabel(12)).toBe("Open pull request #12 in Pull requests");
    expect(commitsLoadMoreLabel(false)).toBe("Load more");
    expect(commitsLoadMoreLabel(true)).toBe("Loading...");
    expect(shaCopyLabel("a1b2c3d", false)).toBe("a1b2c3d");
    expect(shaCopyLabel("a1b2c3d", true)).toBe("Copied");
  });
});

describe("githubReadFailure", () => {
  const input = {
    projectId: "p 1",
    subject: "show this repository's commits",
    notFound: "Not yours.",
    fallback: "Could not read.",
  };

  it("asks for a fresh sign-in on 401 or GITHUB_REAUTH", () => {
    const expected = {
      kind: "reauth",
      message: "GitHub needs you to sign in again before ALPHACI can show this repository's commits.",
      signInHref: "/login?next=/projects/p%201",
    };
    expect(githubReadFailure(new ApiError("x", 401), input)).toEqual(expected);
    expect(githubReadFailure(new ApiError("x", 400, { code: "github_reauth" }), input)).toEqual(expected);
    expect(githubReadFailure(new ApiError("x", 409, { error: { code: "GITHUB_REAUTH" } }), input)).toEqual(expected);
    expect(needsGithubSignIn(new ApiError("x", 401))).toBe(true);
  });

  it("says a 404 is not visible, and anything else is the fallback", () => {
    expect(githubReadFailure(new ApiError("x", 404), input)).toEqual({ kind: "not-found", message: "Not yours.", signInHref: null });
    expect(githubReadFailure(new ApiError("x", 502), input)).toEqual({ kind: "error", message: "Could not read.", signInHref: null });
    expect(githubReadFailure(new Error("network"), input).kind).toBe("error");
    expect(githubReadFailure(null, input).kind).toBe("error");
    expect(needsGithubSignIn(new ApiError("x", 403))).toBe(false);
  });
});
