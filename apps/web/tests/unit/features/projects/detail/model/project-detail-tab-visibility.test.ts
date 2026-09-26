import {
  PROJECT_DETAIL_TABS,
  resolveVisibleTab,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("visibleProjectDetailTabs", () => {
  it("gives QA Team, Team leads and Admins Checklists after Pull requests and QA Studio after Environment", () => {
    for (const role of ["admin", "lead", "qa"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).toEqual(PROJECT_DETAIL_TABS);
      expect(tabs.indexOf("checklists")).toBe(tabs.indexOf("pulls") + 1);
      expect(tabs.indexOf("qa")).toBe(tabs.indexOf("environment") + 1);
    }
  });

  it("gives a Developer Checklists but not QA Studio", () => {
    const tabs = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(tabs).toContain("checklists");
    expect(tabs).not.toContain("qa");
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "qa"));
  });

  it("leaves every other tab exactly as it was when the capability is off", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: false });
      expect(tabs).toEqual(
        PROJECT_DETAIL_TABS.filter((tab) => tab !== "checklists" && tab !== "qa"),
      );
    }
  });

  it("hides Checklists and QA Studio from a session with no app role", () => {
    for (const role of [undefined, null]) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).not.toContain("checklists");
      expect(tabs).not.toContain("qa");
    }
  });

  it("falls back to Overview when the selected tab disappears", () => {
    const visible = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false });
    expect(resolveVisibleTab("checklists", visible)).toBe("overview");
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("runs", visible)).toBe("runs");
  });

  it("sends a Developer who deep-links to #qa to Overview, while Checklists stays reachable", () => {
    const visible = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("checklists", visible)).toBe("checklists");
  });
});
