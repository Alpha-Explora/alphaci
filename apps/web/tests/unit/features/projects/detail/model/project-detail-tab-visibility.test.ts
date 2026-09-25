import {
  PROJECT_DETAIL_TABS,
  resolveVisibleTab,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("visibleProjectDetailTabs", () => {
  it("adds Checklists after Pull requests when the capability is on, for every role", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).toEqual(PROJECT_DETAIL_TABS);
      expect(tabs.indexOf("checklists")).toBe(tabs.indexOf("pulls") + 1);
    }
  });

  it("leaves every other tab exactly as it was when the capability is off", () => {
    const tabs = visibleProjectDetailTabs("lead", { qaChecklistsEnabled: false });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "checklists"));
  });

  it("hides Checklists from a session with no app role", () => {
    expect(visibleProjectDetailTabs(undefined, { qaChecklistsEnabled: true })).not.toContain(
      "checklists",
    );
  });

  it("falls back to Overview when the selected tab disappears", () => {
    const visible = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false });
    expect(resolveVisibleTab("checklists", visible)).toBe("overview");
    expect(resolveVisibleTab("runs", visible)).toBe("runs");
  });
});
