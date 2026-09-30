import { browseRefFor } from "../../../../../../src/features/projects/detail/model/browse-ref";

describe("browseRefFor", () => {
  it("keeps the default branch when it is listed", () => {
    expect(browseRefFor(["dev", "main"], "main")).toBe("main");
  });

  it("falls back to dev when the role-filtered list has no default branch", () => {
    expect(browseRefFor(["feature/a-1", "dev", "uat"], "main")).toBe("dev");
  });

  it("falls back to the first listed branch when there is no dev either", () => {
    expect(browseRefFor(["feature/a-1", "feature/a-2"], "main")).toBe("feature/a-1");
  });

  it("returns the default branch for an empty list", () => {
    expect(browseRefFor([], "main")).toBe("main");
  });
});
