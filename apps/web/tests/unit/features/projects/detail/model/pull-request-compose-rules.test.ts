import { suggestTitle } from "../../../../../../src/features/projects/detail/model/pull-request-compose-rules";

const commit = (headline: string) => ({
  sha: "abc",
  headline,
  author: null,
  authoredAt: null,
});

describe("suggestTitle", () => {
  it("uses the only commit's headline, a sentence someone already wrote", () => {
    expect(suggestTitle("feature/x", [commit("Add login form")])).toBe(
      "Add login form",
    );
  });

  it("turns the branch name back into words when there are several commits", () => {
    expect(
      suggestTitle("feature/add-login_page", [commit("a"), commit("b")]),
    ).toBe("Add login page");
  });

  it("falls back to the branch name when it has no words left", () => {
    expect(suggestTitle("feature/--", [])).toBe("feature/--");
  });
});
