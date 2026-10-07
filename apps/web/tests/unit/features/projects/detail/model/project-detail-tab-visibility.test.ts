import {
  PROJECT_DETAIL_TABS,
  canManageEnvVars,
  checklistsTabCarriesProjectQa,
  canOpenPoStudio,
  canOpenQaStudio,
  projectDetailTabsForRole,
  resolveVisibleTab,
  seesProjectAsProduct,
  shouldHighlightMyQaItems,
  showOverviewProductionReadiness,
  studioTabFor,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";
import type { AppRole } from "../../../../../../src/shared/api/contracts";

describe("visibleProjectDetailTabs", () => {
  it("gives Admins every tab, in strip order", () => {
    const tabs = visibleProjectDetailTabs("admin", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS);
    expect(tabs.indexOf("checklists")).toBe(tabs.indexOf("pulls") + 1);
    expect(tabs.indexOf("qa")).toBe(tabs.indexOf("environment") + 1);
    expect(tabs.indexOf("po")).toBe(tabs.indexOf("qa") + 1);
  });

  it("gives a Product owner only Overview, Checklists, PO Studio, Audit and Settings", () => {
    expect(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: true })).toEqual([
      "overview",
      "checklists",
      "po",
      "audit",
      "settings",
    ]);
  });

  it("drops a Product owner's Checklists and PO Studio while the capability is off", () => {
    expect(visibleProjectDetailTabs("lead", { qaChecklistsEnabled: false })).toEqual([
      "overview",
      "audit",
      "settings",
    ]);
  });

  it("gives a Developer every tab except the studios, Environment and Hosting included", () => {
    const tabs = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(PROJECT_DETAIL_TABS.filter((tab) => tab !== "qa" && tab !== "po"));
    expect(tabs).toContain("environment");
    expect(tabs).toContain("hosting");
    expect(tabs).toContain("checklists");
  });

  /* QA checks the uat build and its UI in QA Studio: the Product owner's set, with QA Studio for PO Studio. */
  it("gives QA Team the Product owner's five tabs, with QA Studio in place of PO Studio", () => {
    const tabs = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true });
    expect(tabs).toEqual(["overview", "checklists", "qa", "audit", "settings"]);
    for (const hidden of ["code", "pulls", "runs", "workflow", "hosting", "environment"] as const) {
      expect(tabs).not.toContain(hidden);
    }
  });

  it("drops QA Team's Checklists and QA Studio while the capability is off", () => {
    expect(visibleProjectDetailTabs("qa", { qaChecklistsEnabled: false })).toEqual([
      "overview",
      "audit",
      "settings",
    ]);
  });

  it("leaves Environment exactly as the role decides when the checklists capability is off", () => {
    // Checklists and QA Studio disappear for everyone; Environment does not
    // follow that flag.
    for (const role of ["admin", "member"] as const) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: false });
      expect(tabs).toContain("environment");
      expect(tabs).not.toContain("checklists");
      expect(tabs).not.toContain("qa");
      expect(tabs).not.toContain("po");
    }
    for (const role of ["qa", "lead"] as const) {
      expect(visibleProjectDetailTabs(role, { qaChecklistsEnabled: false })).not.toContain("environment");
    }
  });

  it("hides Checklists, the studios and Environment from a session with no app role", () => {
    for (const role of [undefined, null]) {
      const tabs = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(tabs).toEqual(
        PROJECT_DETAIL_TABS.filter(
          (tab) => tab !== "checklists" && tab !== "qa" && tab !== "po" && tab !== "environment",
        ),
      );
    }
  });

  it("gives an unknown role (a newer backend) no more than a session with no role", () => {
    const tabs = visibleProjectDetailTabs("auditor" as AppRole, { qaChecklistsEnabled: true });
    expect(tabs).toEqual(visibleProjectDetailTabs(undefined, { qaChecklistsEnabled: true }));
  });

  it("offers each studio exactly to the roles that may open it", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      expect(projectDetailTabsForRole(role).has("qa")).toBe(canOpenQaStudio(role));
      expect(projectDetailTabsForRole(role).has("po")).toBe(canOpenPoStudio(role));
    }
  });

  it("offers Environment exactly to the roles that may change variables", () => {
    for (const role of ["admin", "lead", "qa", "member"] as const) {
      expect(projectDetailTabsForRole(role).has("environment")).toBe(canManageEnvVars(role));
    }
  });

  it("falls back to Overview when the selected tab disappears", () => {
    const visible = visibleProjectDetailTabs("admin", { qaChecklistsEnabled: false });
    expect(resolveVisibleTab("checklists", visible)).toBe("overview");
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("po", visible)).toBe("overview");
    expect(resolveVisibleTab("runs", visible)).toBe("runs");
  });

  it("sends QA Team who deep-links to a code or delivery tab to Overview", () => {
    const visible = visibleProjectDetailTabs("qa", { qaChecklistsEnabled: true });
    for (const tab of ["code", "pulls", "runs", "workflow", "hosting", "environment"] as const) {
      expect(resolveVisibleTab(tab, visible)).toBe("overview");
    }
    expect(resolveVisibleTab("qa", visible)).toBe("qa");
    // A Product owner's link brings QA to their own studio.
    expect(resolveVisibleTab("po", visible)).toBe("qa");
  });

  it("sends a Developer who deep-links to a studio to Overview, while Checklists and Environment stay reachable", () => {
    const visible = visibleProjectDetailTabs("member", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("qa", visible)).toBe("overview");
    expect(resolveVisibleTab("po", visible)).toBe("overview");
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
    expect(resolveVisibleTab("po", visible)).toBe("po");
  });

  /* Links written before PO Studio (#qa) still bring a Product owner to their studio. */
  it("sends a Product owner who deep-links to #qa to PO Studio", () => {
    const visible = visibleProjectDetailTabs("lead", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("qa", visible)).toBe("po");
  });

  it("keeps an admin on the studio the link names", () => {
    const visible = visibleProjectDetailTabs("admin", { qaChecklistsEnabled: true });
    expect(resolveVisibleTab("qa", visible)).toBe("qa");
    expect(resolveVisibleTab("po", visible)).toBe("po");
  });
});

describe("canOpenQaStudio / canOpenPoStudio / studioTabFor", () => {
  it("gives QA Studio to the QA Team and admins, PO Studio to Team leads and admins", () => {
    const roles: AppRole[] = ["qa", "lead", "admin", "member"];
    expect(roles.map((role) => canOpenQaStudio(role))).toEqual([true, false, true, false]);
    expect(roles.map((role) => canOpenPoStudio(role))).toEqual([false, true, true, false]);
  });

  it("names each role's own studio: QA Studio for an admin", () => {
    expect(studioTabFor("qa")).toBe("qa");
    expect(studioTabFor("lead")).toBe("po");
    expect(studioTabFor("admin")).toBe("qa");
    expect(studioTabFor("member")).toBeNull();
    expect(studioTabFor(undefined)).toBeNull();
  });

  it("refuses a Developer", () => {
    expect(canOpenQaStudio("member")).toBe(false);
    expect(canOpenPoStudio("member")).toBe(false);
  });

  it("refuses a session with no known role", () => {
    expect(canOpenQaStudio(null)).toBe(false);
    expect(canOpenQaStudio(undefined)).toBe(false);
  });
});

describe("seesProjectAsProduct", () => {
  it("is the QA Team and Product owners", () => {
    expect(seesProjectAsProduct("qa")).toBe(true);
    expect(seesProjectAsProduct("lead")).toBe(true);
  });

  it("is not a Developer, an admin or an unknown role", () => {
    expect(seesProjectAsProduct("member")).toBe(false);
    expect(seesProjectAsProduct("admin")).toBe(false);
    expect(seesProjectAsProduct(null)).toBe(false);
    expect(seesProjectAsProduct(undefined)).toBe(false);
  });
});

describe("checklistsTabCarriesProjectQa", () => {
  it("is true for a repository in a Project, whatever the viewer's role", () => {
    expect(checklistsTabCarriesProjectQa("project")).toBe(true);
  });

  it("keeps the per-repository screens for no Project or one still being read", () => {
    expect(checklistsTabCarriesProjectQa("repository")).toBe(false);
    expect(checklistsTabCarriesProjectQa("pending")).toBe(false);
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
