import {
  PROJECT_DETAIL_TABS,
  resolveVisibleTab,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

describe("visibleProjectDetailTabs", () => {
  it("gives Team leads and Admins every tab, in strip order", () => {
    for (const role of ["admin", "lead"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).toEqual(PROJECT_DETAIL_TABS);
      expect(tabs.indexOf("checklists")).toBe(tabs.indexOf("pulls") + 1);
      expect(tabs.indexOf("qa")).toBe(tabs.indexOf("environment") + 1);
    }
  });

  it("hides Environment from QA Team, but keeps Checklists and QA Studio", () => {
    // Environment is gated on its own (ENV_VARS_LEAD_ONLY), independent of
    // the checklists capability flag.
    const tabs = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "environment"));
    expect(tabs).toContain("checklists");
    expect(tabs).toContain("qa");
    expect(tabs).not.toContain("environment");
  });

  it("hides Environment and QA Studio from a Developer, but keeps Checklists", () => {
    const tabs = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(tabs).toContain("checklists");
    expect(tabs).not.toContain("qa");
    expect(tabs).not.toContain("environment");
    expect(tabs).toEqual(
      PROJECT_DETAIL_TABS.filter((tab) => tab !== "qa" && tab !== "environment"),
    );
  });

  it("leaves Environment exactly as the role decides when the checklists capability is off", () => {
    // Checklists and QA Studio disappear for everyone; Environment does not
    // follow that flag — it stays visible for admin/lead and hidden for
    // qa/member regardless of it.
    for (const role of ["admin", "lead"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: false });
      expect(tabs).toEqual(
        PROJECT_DETAIL_TABS.filter((tab) => tab !== "checklists" && tab !== "qa"),
      );
      expect(tabs).toContain("environment");
    }
    for (const role of ["qa", "member"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: false });
      expect(tabs).toEqual(
        PROJECT_DETAIL_TABS.filter(
          (tab) => tab !== "checklists" && tab !== "qa" && tab !== "environment",
        ),
      );
    }
  });

  it("hides Checklists, QA Studio and Environment from a session with no app role", () => {
    for (const role of [undefined, null]) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).not.toContain("checklists");
      expect(tabs).not.toContain("qa");
      expect(tabs).not.toContain("environment");
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

  it("sends a Developer or QA Team member who deep-links to #environment to Overview", () => {
    for (const role of ["member", "qa"] as const) {
      const visible = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(resolveVisibleTab("environment", visible)).toBe("overview");
    }
  });
});
