import {
  resolveVisibleTab,
  commitsBranchFromUrl,
  hostingFocusFromHash,
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

  it("opens the retired #environment on Hosting, asking it to focus Variables", () => {
    expect(tabFromHash("#environment")).toBe("hosting");
    expect(tabFromHash("environment")).toBe("hosting");
    expect(hostingFocusFromHash("#environment")).toBe("variables");
  });

  it("keeps #hosting as it was: Hosting, with nothing to focus", () => {
    expect(tabFromHash("#hosting")).toBe("hosting");
    expect(hostingFocusFromHash("#hosting")).toBeNull();
    expect(hostingFocusFromHash("")).toBeNull();
    expect(hostingFocusFromHash(null)).toBeNull();
  });

  it("lands an old #environment link on Hosting for every role that has Hosting", () => {
    for (const role of ["member", "admin", null] as const) {
      const visible = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(resolveVisibleTab(tabFromHash("#environment") ?? "overview", visible)).toBe("hosting");
    }
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
