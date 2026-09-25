import {
  resolveVisibleTab,
  tabFromHash,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("tabFromHash", () => {
  it("reads a known tab id from the URL hash", () => {
    expect(tabFromHash("#qa")).toBe("qa");
    expect(tabFromHash("hosting")).toBe("hosting");
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
