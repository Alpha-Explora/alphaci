"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createDeploymentTarget,
  listDeploymentTargets,
  listProjectEnvMetadata,
  provisionProjectEnvVars,
} from "@/lib/api/client";
import type {
  CreateDeploymentTargetRequest,
  DeploymentTarget,
  EnvVarMetadata,
  ProvisionEnvVarsRequest,
} from "@/lib/api/contracts";

export function useProjectEnvProvisioning(projectId: string, enabled = true) {
  const [targets, setTargets] = useState<DeploymentTarget[]>([]);
  const [metadata, setMetadata] = useState<EnvVarMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const [nextTargets, nextMetadata] = await Promise.all([
        listDeploymentTargets(projectId),
        listProjectEnvMetadata(projectId),
      ]);
      setTargets(nextTargets);
      setMetadata(nextMetadata);
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTarget(payload: CreateDeploymentTargetRequest) {
    setSaving(true);
    try {
      const target = await createDeploymentTarget(projectId, payload);
      setTargets((current) => [target, ...current]);
      return target;
    } finally {
      setSaving(false);
    }
  }

  async function provision(payload: ProvisionEnvVarsRequest) {
    setSaving(true);
    try {
      const result = await provisionProjectEnvVars(projectId, payload);
      await load();
      return result;
    } finally {
      setSaving(false);
    }
  }

  return {
    addTarget,
    load,
    loading,
    metadata,
    provision,
    saving,
    targets,
  };
}
