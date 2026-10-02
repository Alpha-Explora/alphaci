import {
  PROJECT_DETAIL_TABS,
  canManageEnvVars,
  canOpenQaStudio,
  projectDetailTabsForRole,
  resolveVisibleTab,
  shouldHighlightMyQaItems,
  showOverviewProductionReadiness,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

describe("visibleProjectDetailTabs", () => {
  it("gives Admins every tab, in strip order", () => {
    const tabs = visibleProjectDetailTabs("admin", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS);
    expect(tabs.indexOf("checklists")).toBe(tabs.indexOf("pulls") + 1);
    expect(tabs.indexOf("qa")).toBe(tabs.indexOf("environment") + 1);
  });

  it("gives a Product owner only Overview, Checklists, QA Studio, Audit and Settings", () => {
    expect(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: true })).toEqual([
      "overview",
      "checklists",
      "qa",
      "audit",
      "settings",
    ]);
  });

  it("drops a Product owner's Checklists and QA Studio while the capability is off", () => {
    expect(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: false })).toEqual([
      "overview",
      "audit",
      "settings",
    ]);
  });

  it("gives a Developer every tab except QA Studio, Environment and Hosting included", () => {
    const tabs = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "qa"));
    expect(tabs).toContain("environment");
    expect(tabs).toContain("hosting");
    expect(tabs).toContain("checklists");
  });

  it("hides Environment from QA Team, but keeps Checklists and QA Studio", () => {
    const tabs = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "environment"));
    expect(tabs).toContain("checklists");
    expect(tabs).toContain("qa");
  });

  it("leaves Environment exactly as the role decides when the checklists capability is off", () => {
    // Checklists and QA Studio disappear for everyone; Environment does not
    // follow that flag.
    for (const role of ["admin", "member"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: false });
      expect(tabs).toContain("environment");
      expect(tabs).not.toContain("checklists");
      expect(tabs).not.toContain("qa");
    }
    for (const role of ["qa", "lead"] as const) {
      expect(visibleProjectDetailTabs(role, { qaChecklistsEnabled: false })).not.toContain("environment");
    }
  });

  it("hides Checklists, QA Studio and Environment from a session with no app role", () => {
    for (const role of [undefined, null]) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).toEqual(
        PROJECT_DETAIL_TABS.filter(
          (tab) => tab !== "checklists" && tab !== "qa" && tab !== "environment",
        ),
      );
    }
  });

  it("gives an unknown role (a newer backend) no more than a session with no role", () => {
    const tabs = visibleProjectDetailTabs("auditor" as AppRole, { qaChecklistsEnabled: true });
    expect(tabs).toEqual(visibleProjectDetailTabs(undefined, { qaChecklistsEnabled: true }));
  });

  it("offers QA Studio exactly to the roles that may open it", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      expect(projectDetailTabsForRole(role).has("qa")).toBe(canOpenQaStudio(role));
    }
  });

  it("offers Environment exactly to the roles that may change variables", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      expect(projectDetailTabsForRole(role).has("environment")).toBe(canManageEnvVars(role));
    }
  });

  it("falls back to Overview when the selected tab disappears", () => {
    const visible = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false });
    expect(resolveVisibleTab("checklists", visible)).toBe("overview");
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("runs", visible)).toBe("runs");
  });

  it("sends a Developer who deep-links to #qa to Overview, while Checklists and Environment stay reachable", () => {
    const visible = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("checklists", visible)).toBe("checklists");
    expect(resolveVisibleTab("environment", visible)).toBe("environment");
  });

  it("sends a QA Team member who deep-links to #environment to Overview", () => {
    const visible = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("environment", visible)).toBe("overview");
  });

  it("sends a Product owner who deep-links to a hidden tab to Overview", () => {
    const visible = visibleProjectDetailTabs("lead", { qaChecklistsEnabled: true });
    for (const hidden of ["code", "pulls", "runs", "workflow", "hosting", "environment"] as const) {
      expect(resolveVisibleTab(hidden, visible)).toBe("overview");
    }
    expect(resolveVisibleTab("audit", visible)).toBe("audit");
    expect(resolveVisibleTab("qa", visible)).toBe("qa");
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
