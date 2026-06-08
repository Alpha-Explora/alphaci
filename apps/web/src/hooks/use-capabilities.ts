"use client";

import { useCallback, useEffect, useState } from "react";

import { getCapabilities } from "@/lib/api/client";
import type { CapabilitiesResponse } from "@/lib/api/contracts";

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCapabilities = useCallback(async () => {
    setLoading(true);
    try {
      setCapabilities(await getCapabilities());
    } catch {
      setCapabilities({ envProvisioning: { enabled: false, providers: [], environments: [], modes: [] } });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  return {
    capabilities,
    envProvisioningEnabled: capabilities?.envProvisioning.enabled === true,
    loadCapabilities,
    loading,
  };
}
