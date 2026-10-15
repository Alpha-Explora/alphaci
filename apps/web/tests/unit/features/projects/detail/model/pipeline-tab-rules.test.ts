import {
  PROJECT_DETAIL_TABS,
  isCiRunsQueryEnabled,
  isWorkflowSettingsQueryEnabled,
  pipelineConfigurationAvailable,
  pipelineViewFromHash,
  resolvePipelineView,
  resolveVisibleTab,
  tabFromHash,
  visibleProjectDetailTabs,
} from "../../../../../../src/features/projects/detail/model/project-detail-tab-rules";

const ROLES = ["admin", "member", "lead", "qa", null] as const;

describe("the Pipeline tab (Pipeline runs + Workflow)", () => {
  it("replaces the two tabs with one, in the same place in the strip", () => {
    expect(PROJECT_DETAIL_TABS).toContain("pipeline");
    expect(PROJECT_DETAIL_TABS as ReadonlyArray<string>).not.toContain("runs");
    expect(PROJECT_DETAIL_TABS as ReadonlyArray<string>).not.toContain("workflow");
    expect(PROJECT_DETAIL_TABS.indexOf("pipeline")).toBe(PROJECT_DETAIL_TABS.indexOf("checklists") + 1);
    expect(PROJECT_DETAIL_TABS.indexOf("hosting")).toBe(PROJECT_DETAIL_TABS.indexOf("pipeline") + 1);
  });

  it("goes to every role that had Pipeline runs: Developers, admins and an unknown role", () => {
    for (const qaChecklistsEnabled of [true, false]) {
      expect(visibleProjectDetailTabs("member", { qaChecklistsEnabled })).toContain("pipeline");
      expect(visibleProjectDetailTabs("admin", { qaChecklistsEnabled })).toContain("pipeline");
      expect(visibleProjectDetailTabs(null, { qaChecklistsEnabled })).toContain("pipeline");
      expect(visibleProjectDetailTabs("lead", { qaChecklistsEnabled })).not.toContain("pipeline");
      expect(visibleProjectDetailTabs("qa", { qaChecklistsEnabled })).not.toContain("pipeline");
    }
  });

  it("gives a Developer ten tabs", () => {
    expect(visibleProjectDetailTabs("member", { qaChecklistsEnabled: true })).toEqual([
      "overview", "code", "commits", "pulls", "checklists", "pipeline", "hosting", "audit", "history", "settings",
    ]);
  });

  it("offers Configuration exactly where Workflow showed before: with the Pipeline tab", () => {
    for (const role of ROLES) {
      const visible = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      expect(pipelineConfigurationAvailable(visible)).toBe(role === "admin" || role === "member" || role === null);
    }
    expect(pipelineConfigurationAvailable([])).toBe(false);
  });
});

describe("Pipeline hash aliases", () => {
  it("opens #runs, #workflow and #pipeline on the Pipeline tab", () => {
    expect(tabFromHash("#runs")).toBe("pipeline");
    expect(tabFromHash("#workflow")).toBe("pipeline");
    expect(tabFromHash("#pipeline")).toBe("pipeline");
    expect(tabFromHash("workflow")).toBe("pipeline");
  });

  it("opens #workflow on Configuration and anything else on Runs", () => {
    expect(pipelineViewFromHash("#workflow")).toBe("configuration");
    expect(pipelineViewFromHash("workflow")).toBe("configuration");
    expect(pipelineViewFromHash("#runs")).toBe("runs");
    expect(pipelineViewFromHash("#pipeline")).toBe("runs");
    expect(pipelineViewFromHash("#hosting")).toBe("runs");
    expect(pipelineViewFromHash("")).toBe("runs");
    expect(pipelineViewFromHash(null)).toBe("runs");
    expect(pipelineViewFromHash(undefined)).toBe("runs");
  });

  it("cannot reveal Pipeline to a role without it", () => {
    for (const role of ["lead", "qa"] as const) {
      const visible = visibleProjectDetailTabs(role, { qaChecklistsEnabled: true });
      for (const hash of ["#runs", "#workflow", "#pipeline"]) {
        expect(resolveVisibleTab(tabFromHash(hash) ?? "overview", visible)).toBe("overview");
      }
    }
  });
});

describe("resolvePipelineView", () => {
  it("shows Configuration only where it is offered", () => {
    expect(resolvePipelineView("configuration", true)).toBe("configuration");
    expect(resolvePipelineView("configuration", false)).toBe("runs");
    expect(resolvePipelineView("runs", true)).toBe("runs");
    expect(resolvePipelineView("runs", false)).toBe("runs");
  });
});

describe("the Pipeline views' queries", () => {
  const runsFlags = { ciRunTrackingEnabled: true, overviewCiRunTracking: true };
  const settingsFlags = { workflowSettingsPreviewEnabled: true, overviewWorkflowSettings: true };

  it("reads reported results only on Runs", () => {
    expect(isCiRunsQueryEnabled({ tab: "pipeline", pipelineView: "runs", ...runsFlags })).toBe(true);
    expect(isCiRunsQueryEnabled({ tab: "pipeline", pipelineView: "configuration", ...runsFlags })).toBe(false);
    expect(isCiRunsQueryEnabled({ tab: "overview", pipelineView: "runs", ...runsFlags })).toBe(false);
    expect(
      isCiRunsQueryEnabled({ tab: "pipeline", pipelineView: "runs", ...runsFlags, overviewCiRunTracking: undefined }),
    ).toBe(false);
  });

  it("reads workflow settings only on Configuration", () => {
    expect(isWorkflowSettingsQueryEnabled({ tab: "pipeline", pipelineView: "configuration", ...settingsFlags })).toBe(true);
    expect(isWorkflowSettingsQueryEnabled({ tab: "pipeline", pipelineView: "runs", ...settingsFlags })).toBe(false);
    expect(isWorkflowSettingsQueryEnabled({ tab: "hosting", pipelineView: "configuration", ...settingsFlags })).toBe(false);
    expect(
      isWorkflowSettingsQueryEnabled({
        tab: "pipeline",
        pipelineView: "configuration",
        ...settingsFlags,
        workflowSettingsPreviewEnabled: false,
      }),
    ).toBe(false);
  });
});
