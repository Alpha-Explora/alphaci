import {
  PROJECT_DETAIL_TABS,
  canManageProjectAccess,
  canOpenQaStudio,
  resolveVisibleTab,
  shouldHighlightMyQaItems,
  showOverviewProductionReadiness,
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

describe("canOpenQaStudio", () => {
  it("allows QA Team, Team leads and Admins", () => {
    for (const role of ["qa", "lead", "admin"] as const) {
      expect(canOpenQaStudio(role)).toBe(true);
    }
  });

  it("refuses a Developer", () => {
    expect(canOpenQaStudio("member")).toBe(false);
  });

  it("refuses a session with no known role", () => {
    expect(canOpenQaStudio(null)).toBe(false);
    expect(canOpenQaStudio(undefined)).toBe(false);
  });
});

describe("shouldHighlightMyQaItems", () => {
  it("reads ?focus=my-qa-items off location.search, leading '?' and all", () => {
    expect(shouldHighlightMyQaItems("?focus=my-qa-items")).toBe(true);
  });

  it("reads it without a leading '?' too", () => {
    expect(shouldHighlightMyQaItems("focus=my-qa-items")).toBe(true);
  });

  it("ignores an unrelated or missing focus value", () => {
    expect(shouldHighlightMyQaItems("?focus=something-else")).toBe(false);
    expect(shouldHighlightMyQaItems("?other=1")).toBe(false);
  });

  it("is false for empty, null or undefined search strings", () => {
    expect(shouldHighlightMyQaItems("")).toBe(false);
    expect(shouldHighlightMyQaItems(null)).toBe(false);
    expect(shouldHighlightMyQaItems(undefined)).toBe(false);
  });

  it("still finds it alongside other query params", () => {
    expect(shouldHighlightMyQaItems("?tab=overview&focus=my-qa-items")).toBe(true);
  });
});

describe("canManageProjectAccess", () => {
  it("allows only Team leads and Admins", () => {
    expect(canManageProjectAccess("lead")).toBe(true);
    expect(canManageProjectAccess("admin")).toBe(true);
    expect(canManageProjectAccess("qa")).toBe(false);
    expect(canManageProjectAccess("member")).toBe(false);
    expect(canManageProjectAccess(undefined)).toBe(false);
    expect(canManageProjectAccess(null)).toBe(false);
  });
});

describe("showOverviewProductionReadiness", () => {
  it("is for Developers, with the QA capability on", () => {
    expect(showOverviewProductionReadiness("member", true)).toBe(true);
    expect(showOverviewProductionReadiness("member", false)).toBe(false);
  });

  it("leaves Leads, Admins and QA Team to QA Studio", () => {
    for (const role of ["lead", "admin", "qa"] as const) {
      expect(showOverviewProductionReadiness(role, true)).toBe(false);
    }
    expect(showOverviewProductionReadiness(undefined, true)).toBe(false);
  });
});
