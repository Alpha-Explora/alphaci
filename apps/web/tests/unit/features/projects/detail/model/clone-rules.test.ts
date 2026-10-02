import {
  CLONE_METHODS,
  cloneMethodOption,
  cloneNoun,
  cloneValue,
  nextCloneMethodIndex,
  repositoryHost,
} from "../../../../../../src/features/projects/detail/model/clone-rules";

describe("clone switch keys and wording", () => {
  it("moves with the arrows (wrapping), jumps with Home/End, ignores other keys", () => {
    expect(nextCloneMethodIndex(0, "ArrowRight")).toBe(1);
    expect(nextCloneMethodIndex(2, "ArrowRight")).toBe(0);
    expect(nextCloneMethodIndex(0, "ArrowLeft")).toBe(2);
    expect(nextCloneMethodIndex(1, "Home")).toBe(0);
    expect(nextCloneMethodIndex(0, "End")).toBe(2);
    expect(nextCloneMethodIndex(1, "Enter")).toBeNull();
  });

  it("calls the CLI value a command and the others a URL", () => {
    expect(cloneNoun("https")).toBe("URL");
    expect(cloneNoun("ssh")).toBe("URL");
    expect(cloneNoun("cli")).toBe("command");
  });
});

describe("clone rules", () => {
  it("offers HTTPS, SSH and GitHub CLI, in GitHub's order", () => {
    expect(CLONE_METHODS.map((option) => option.label)).toEqual(["HTTPS", "SSH", "GitHub CLI"]);
    expect(cloneMethodOption("ssh").hint).toBe("Use a password-protected SSH key.");
  });

  it("builds each value for a github.com repository", () => {
    const name = "Alphaexplora-Sandbox/logistics2cicd-fe";
    expect(cloneValue("https", name)).toBe("https://github.com/Alphaexplora-Sandbox/logistics2cicd-fe.git");
    expect(cloneValue("ssh", name)).toBe("git@github.com:Alphaexplora-Sandbox/logistics2cicd-fe.git");
    expect(cloneValue("cli", name)).toBe("gh repo clone Alphaexplora-Sandbox/logistics2cicd-fe");
  });

  it("follows the repository's own host when it is not github.com", () => {
    const url = "https://github.example.com/acme/api";
    expect(repositoryHost(url)).toBe("github.example.com");
    expect(cloneValue("https", "acme/api", url)).toBe("https://github.example.com/acme/api.git");
    expect(cloneValue("ssh", "acme/api", url)).toBe("git@github.example.com:acme/api.git");
    expect(cloneValue("cli", "acme/api", url)).toBe("gh repo clone github.example.com/acme/api");
  });

  it("falls back to github.com for a missing or malformed URL", () => {
    expect(repositoryHost(null)).toBe("github.com");
    expect(repositoryHost("not a url")).toBe("github.com");
  });

  it("offers nothing for a name that is not owner/repo", () => {
    expect(cloneValue("https", "")).toBeNull();
    expect(cloneValue("https", "just-a-repo")).toBeNull();
    expect(cloneValue("ssh", "a/b; rm -rf /")).toBeNull();
    expect(cloneValue("cli", undefined)).toBeNull();
  });
});
