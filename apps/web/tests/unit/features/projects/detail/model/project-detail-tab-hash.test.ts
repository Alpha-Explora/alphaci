import {
  resolveVisibleTab,
  commitsBranchFromUrl,
  tabFromHash,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("tabFromHash", () => {
  it("reads a known tab id from the URL hash", () => {
    expect(tabFromHash("#qa")).toBe("qa");
    expect(tabFromHash("hosting")).toBe("hosting");
  });

  it("reads #commits, with the branch of ?branch= only on that tab", () => {
    expect(tabFromHash("#commits")).toBe("commits");
    expect(commitsBranchFromUrl("#commits", "?branch=uat")).toBe("uat");
    expect(commitsBranchFromUrl("#commits", "")).toBeNull();
    expect(commitsBranchFromUrl("#code", "?branch=uat")).toBeNull();
    expect(commitsBranchFromUrl(null, "?branch=uat")).toBeNull();
  });

  it("ignores empty or unknown hashes", () => {
    expect(tabFromHash("")).toBeNull();
    expect(tabFromHash(null)).toBeNull();
    expect(tabFromHash("#main-content")).toBeNull();
  });

  it("cannot reveal a gated tab: visibility still decides", () => {
    const hidden = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false });
    expect(resolveVisibleTab(tabFromHash("#qa") ?? "overview", hidden)).toBe("overview");
  });
});
