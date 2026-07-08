"use client";

import { useMemo, useState } from "react";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  DeploymentProvisioningVariableGroup,
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
  const normalizedSlot: EnvTargetSlot =
    slot === "frontend" ? "frontend" : "backend";
  const provider = defaultProviderForSlot(normalizedSlot);
  return {
    slot: normalizedSlot,
    provider,
    // BYO hosting is archived: every target deploys on the platform's
    // centralized Render/Vercel accounts.
    ownershipMode: "flowci_managed",
    projectName,
    branchName: "test",
    rootDirectory: normalizedSlot === "backend" ? "backend" : ".",
    buildCommand:
      provider === "render" ? "npm ci && npm run build" : "npm run build",
    startCommand: provider === "render" ? "npm run start:prod" : undefined,
    renderDeployMethod: provider === "render" ? "native_git" : undefined,
    renderServiceType: provider === "render" ? "web_service" : undefined,
    renderRuntime: provider === "render" ? "docker" : undefined,
    renderInstanceType: provider === "render" ? "free" : undefined,
    env: [{ environment: "test", vars: [] }],
  };
}

function sanitizedEnvSets(
  envSets: DeploymentProvisioningEnvSet[] | undefined,
): DeploymentProvisioningEnvSet[] {
  return (envSets ?? [])
    .map((envSet) => ({
      ...envSet,
      vars: envSet.vars.filter(
        (variable) => variable.key.trim() && variable.value,
      ),
    }))
    .filter((envSet) => envSet.vars.length > 0);
}

function sanitizedVariableGroups(
  groups: DeploymentProvisioningVariableGroup[] | undefined,
  activeProviders: Set<EnvProvider>,
): DeploymentProvisioningVariableGroup[] {
  return (groups ?? [])
    .map((group, index) => {
      const provider = group.provider ?? [...activeProviders][0] ?? "render";
      const appliesTo = group.appliesTo ?? "all";
      const env = sanitizedEnvSets(group.env);
      const targetBranches = [...new Set(group.targetBranches ?? [])].filter(
        Boolean,
      );

      return {
        name: group.name?.trim() || `Variable group ${index + 1}`,
        provider,
        appliesTo,
        ...(appliesTo === "selected" ? { targetBranches } : {}),
        env,
      };
    })
    .filter(
      (group) =>
        activeProviders.has(group.provider) &&
        group.env.length > 0 &&
        (group.appliesTo !== "selected" ||
          (group.targetBranches?.length ?? 0) > 0),
    );
}

export function useDeploymentProvisioningForm() {
  const [enabled, setEnabled] = useState(false);
  const [request, setRequest] = useState<DeploymentProvisioningRequest>({
    enabled: false,
    targets: [defaultTarget("backend", "")],
  });

  function setDefaultTarget(slot: EnvTargetSlot, projectName: string) {
    setRequest({
      enabled: true,
      targets: [defaultTarget(slot, projectName)],
    });
    setEnabled(true);
  }

  function setDefaultTargets(
    targets: Array<{ slot: EnvTargetSlot; projectName: string }>,
  ) {
    setRequest({
      enabled: true,
      targets: targets.map((target) =>
        defaultTarget(target.slot, target.projectName),
      ),
    });
    setEnabled(true);
  }

  const payload = useMemo<DeploymentProvisioningRequest | undefined>(() => {
    if (!enabled) {
      return undefined;
    }

    const sharedEnv = sanitizedEnvSets(request.sharedEnv);
    const activeProviders = new Set(
      request.targets.map((target) => target.provider),
    );
    const variableGroups = sanitizedVariableGroups(
      request.variableGroups,
      activeProviders,
    );

    return {
      ...request,
      enabled: true,
      ...(variableGroups.length
        ? { variableGroups }
        : { variableGroups: undefined }),
      ...(sharedEnv.length ? { sharedEnv } : { sharedEnv: undefined }),
      targets: request.targets.map((target) => ({
        ...target,
        projectName: target.projectName?.trim() || undefined,
        branchName: target.branchName?.trim() || "test",
        rootDirectory: target.rootDirectory?.trim() || undefined,
        buildCommand: target.buildCommand?.trim() || undefined,
        startCommand: target.startCommand?.trim() || undefined,
        env: sanitizedEnvSets(target.env),
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
