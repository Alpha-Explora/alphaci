import { getCapabilities as requestCapabilities } from "@/features/capabilities/current/data/capabilities-api";
import type { CapabilitiesResponse } from "@/shared/api/contracts";

export async function getCapabilities(): Promise<CapabilitiesResponse> {
  return requestCapabilities();
}

/** Safe fallback: optional capability UI stays hidden when the probe fails. */
export function disabledCapabilities(): CapabilitiesResponse {
  return {
    envProvisioning: { enabled: false, providers: [], environments: [], modes: [] },
    projectSyncSnapshots: {
      enabled: false,
      liveGithubEnabled: false,
      liveProvidersEnabled: false,
      mode: "local_snapshot",
    },
    workflowSettingsPreview: { enabled: false },
    workflowUpdatePr: { enabled: false },
    projectTargetManagement: { enabled: false },
    ciRunTracking: { enabled: false, liveGithubEnabled: false, mode: "local_mock" },
    deploymentHistory: { enabled: false, liveProvidersEnabled: false, mode: "local_mock" },
    driftDetection: { enabled: false, liveProviderChecksEnabled: false, mode: "local_snapshot" },
    driftRepair: { enabled: false, liveRepairEnabled: false, mode: "local_safe" },
    usageQuotas: { enabled: false },
    workspaces: { enabled: false },
    auditEvents: { enabled: false },
    notifications: { enabled: false },
    hierarchy: { enabled: false, githubSyncMode: "stub" },
  };
}
