import { disabledCapabilities } from "../../../../../../src/features/capabilities/current/data/capabilities-repository";

describe("capability fallback", () => {
  it("disables optional surfaces without exposing a backend failure", () => {
    const fallback = disabledCapabilities();

    expect(fallback.envProvisioning.enabled).toBe(false);
    expect(fallback.projectSyncSnapshots.enabled).toBe(false);
    expect(fallback.workflowSettingsPreview.enabled).toBe(false);
    expect(fallback.workflowUpdatePr.enabled).toBe(false);
    expect(fallback.projectTargetManagement.enabled).toBe(false);
    expect(fallback.ciRunTracking.enabled).toBe(false);
    expect(fallback.deploymentHistory.enabled).toBe(false);
    expect(fallback.driftDetection.enabled).toBe(false);
    expect(fallback.driftRepair.enabled).toBe(false);
    expect(fallback.usageQuotas.enabled).toBe(false);
    expect(fallback.workspaces.enabled).toBe(false);
    expect(fallback.auditEvents.enabled).toBe(false);
    expect(fallback.notifications.enabled).toBe(false);
    expect(fallback.hierarchy).toEqual({ enabled: false, githubSyncMode: "stub" });
  });
});
