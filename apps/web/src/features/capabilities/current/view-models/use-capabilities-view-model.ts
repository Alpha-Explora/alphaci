"use client";

/* The initial capability probe intentionally transitions state from an effect
 * so the first render remains deterministic during the behavior-preserving
 * migration. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";

import {
  disabledCapabilities,
  getCapabilities,
} from "../data/capabilities-repository";
import type { CapabilitiesResponse } from "@/shared/api/contracts";
import { capabilityViewFlags } from "../model/capability-flags";

export type CapabilitiesStatus = "loading" | "ready" | "error";

export interface CapabilitiesViewModel {
  capabilities: CapabilitiesResponse | null;
  status: CapabilitiesStatus;
  error: string | null;
  loading: boolean;
  loadCapabilities: () => Promise<void>;
  envProvisioningEnabled: boolean;
  clientCompositionEnabled: boolean;
  deploymentOwnershipMode: "byo" | "flowci_managed";
  projectSyncSnapshotsEnabled: boolean;
  workflowSettingsPreviewEnabled: boolean;
  workflowUpdatePrEnabled: boolean;
  projectTargetManagementEnabled: boolean;
  ciRunTrackingEnabled: boolean;
  deploymentHistoryEnabled: boolean;
  /** Gates the per-branch preview panel on Overview and Hosting. */
  previewDeploymentsEnabled: boolean;
  driftDetectionEnabled: boolean;
  driftRepairEnabled: boolean;
  usageQuotasEnabled: boolean;
  workspacesEnabled: boolean;
  auditEventsEnabled: boolean;
  notificationsEnabled: boolean;
  hierarchyEnabled: boolean;
  hierarchyGithubSyncMode: "stub" | "live";
}

export function useCapabilitiesViewModel(): CapabilitiesViewModel {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [status, setStatus] = useState<CapabilitiesStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setCapabilities(await getCapabilities());
      setStatus("ready");
    } catch {
      setCapabilities(disabledCapabilities());
      setStatus("error");
      setError("Capabilities are unavailable right now; optional features are hidden.");
    }
  }, []);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  return {
    capabilities,
    status,
    error,
    loading: status === "loading",
    ...capabilityViewFlags(capabilities),
    loadCapabilities,
  };
}
