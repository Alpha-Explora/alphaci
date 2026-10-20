import {
  commitAuthorLabel,
  commitCountLabel,
  entryCommit,
} from "@/features/projects/detail/model/code-commit-rules";

const commit = {
  sha: "a",
  shortSha: "a",
  message: "m",
  committedAt: "2026-10-01T00:00:00Z",
  authorLogin: null,
  authorName: "Dev",
  authorAvatarUrl: null,
};

describe("code commit rules", () => {
  it("counts commits the way GitHub labels them", () => {
    expect(commitCountLabel(1)).toBe("1 Commit");
    expect(commitCountLabel(288)).toBe("288 Commits");
    expect(commitCountLabel(1288)).toBe("1,288 Commits");
  });

  it("finds an entry's commit, and nothing while the commits are unknown", () => {
    const commits = { path: "", ref: "main", latest: null, totalCommits: null, entries: { a: commit, b: null } };
    expect(entryCommit(commits, "a")).toBe(commit);
    expect(entryCommit(commits, "b")).toBeNull();
    expect(entryCommit(commits, "missing")).toBeNull();
    expect(entryCommit(null, "a")).toBeNull();
  });

  it("names the GitHub login, else the git author", () => {
    expect(commitAuthorLabel({ authorLogin: "dev-one", authorName: "Dev" })).toBe("dev-one");
    expect(commitAuthorLabel({ authorLogin: null, authorName: "Dev" })).toBe("Dev");
    expect(commitAuthorLabel({ authorLogin: null, authorName: null })).toBe("Unknown author");
  });
});

