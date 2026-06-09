"use client";

import { useMemo, useState } from "react";

import type {
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  EnvProvider,
  EnvTargetSlot,
} from "@/lib/api/contracts";

function defaultProviderForSlot(slot: EnvTargetSlot): EnvProvider {
  return slot === "frontend" ? "vercel" : "render";
}

function defaultTarget(
  slot: EnvTargetSlot,
  projectName: string,
): DeploymentProvisioningTargetRequest {
  const provider = defaultProviderForSlot(slot);
  return {
    slot,
    provider,
    ownershipMode: "flowci_managed",
    projectName,
    branchName: "test",
    rootDirectory: slot === "frontend" ? "." : ".",
    buildCommand: provider === "render" ? "npm ci && npm run build" : "npm run build",
    startCommand: provider === "render" ? "npm run start:prod" : undefined,
    env: [{ environment: "test", vars: [] }],
  };
}

export function useDeploymentProvisioningForm() {
  const [enabled, setEnabled] = useState(false);
  const [request, setRequest] = useState<DeploymentProvisioningRequest>({
    enabled: false,
    targets: [defaultTarget("standalone", "")],
  });

  function setDefaultTarget(slot: EnvTargetSlot, projectName: string) {
    setRequest({
      enabled: true,
      targets: [defaultTarget(slot, projectName)],
    });
    setEnabled(true);
  }

  function setDefaultTargets(targets: Array<{ slot: EnvTargetSlot; projectName: string }>) {
    setRequest({
      enabled: true,
      targets: targets.map((target) => defaultTarget(target.slot, target.projectName)),
    });
    setEnabled(true);
  }

  const payload = useMemo<DeploymentProvisioningRequest | undefined>(() => {
    if (!enabled) {
      return undefined;
    }

    return {
      ...request,
      enabled: true,
      targets: request.targets.map((target) => ({
        ...target,
        projectName: target.projectName?.trim() || undefined,
        branchName: target.branchName?.trim() || "test",
        rootDirectory: target.rootDirectory?.trim() || undefined,
        buildCommand: target.buildCommand?.trim() || undefined,
        startCommand: target.startCommand?.trim() || undefined,
        env: target.env?.map((envSet) => ({
          ...envSet,
          vars: envSet.vars.filter((variable) => variable.key.trim() && variable.value),
        })),
      })),
    };
  }, [enabled, request]);

  return {
    enabled,
    payload,
    request,
    setDefaultTarget,
    setDefaultTargets,
    setEnabled,
    setRequest,
  };
}

export type DeploymentProvisioningFormState = ReturnType<
  typeof useDeploymentProvisioningForm
>;
