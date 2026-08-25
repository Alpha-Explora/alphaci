import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useDeploymentProvisioningForm } from "../../src/features/workflows/studio/view-models/use-deployment-provisioning-form";
import { useProjectEnvProvisioning } from "../../src/features/projects/detail/view-models/use-project-env-provisioning-view-model";
import { useProviderConnections } from "../../src/features/workflows/studio/view-models/use-provider-connections";
import {
  createDeploymentTarget,
  createProviderConnection,
  deleteProjectEnvMetadata,
  listDeploymentTargets,
  listProjectEnvMetadata,
  listProviderConnections,
  provisionProjectEnvVars,
  revokeProviderConnection,
  validateProjectEnvVars,
} from "../support/api-client";
import type {
  DeploymentTarget,
  EnvVarMetadata,
  ProviderConnection,
} from "../../src/shared/api/contracts";

jest.mock("../../src/features/workflows/studio/data/env-provisioning-api", () => ({
  createDeploymentTarget: jest.fn(),
  createProviderConnection: jest.fn(),
  deleteProjectEnvMetadata: jest.fn(),
  listDeploymentTargets: jest.fn(),
  listProjectEnvMetadata: jest.fn(),
  listProviderConnections: jest.fn(),
  provisionProjectEnvVars: jest.fn(),
  revokeProviderConnection: jest.fn(),
  validateProjectEnvVars: jest.fn(),
}));

const mockedCreateDeploymentTarget = createDeploymentTarget as jest.MockedFunction<typeof createDeploymentTarget>;
const mockedCreateProviderConnection = createProviderConnection as jest.MockedFunction<typeof createProviderConnection>;
const mockedDeleteProjectEnvMetadata = deleteProjectEnvMetadata as jest.MockedFunction<typeof deleteProjectEnvMetadata>;
const mockedListDeploymentTargets = listDeploymentTargets as jest.MockedFunction<typeof listDeploymentTargets>;
const mockedListProjectEnvMetadata = listProjectEnvMetadata as jest.MockedFunction<typeof listProjectEnvMetadata>;
const mockedListProviderConnections = listProviderConnections as jest.MockedFunction<typeof listProviderConnections>;
const mockedProvisionProjectEnvVars = provisionProjectEnvVars as jest.MockedFunction<typeof provisionProjectEnvVars>;
const mockedRevokeProviderConnection = revokeProviderConnection as jest.MockedFunction<typeof revokeProviderConnection>;
const mockedValidateProjectEnvVars = validateProjectEnvVars as jest.MockedFunction<typeof validateProjectEnvVars>;

const activeConnection: ProviderConnection = {
  id: "connection-1",
  provider: "vercel",
  label: "Vercel Team",
  tokenLastFour: "1234",
  status: "active",
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
  lastUsedAt: null,
  metadata: {
    vercelOrgId: "team_1",
    vercelTeamId: "team_1",
    vercelTeamSlug: "flowci",
  },
};

const revokedConnection: ProviderConnection = {
  ...activeConnection,
  id: "connection-2",
  label: "Old Vercel",
  status: "revoked",
};

const deploymentTarget: DeploymentTarget = {
  id: "target-1",
  projectId: "project-1",
  slot: "frontend",
  ownershipMode: "byo",
  provider: "vercel",
  providerConnectionId: "connection-1",
  providerTargetId: "prj_1",
  projectName: "web",
  serviceName: "web",
  status: "active",
  providerMetadata: {
    vercelOrgId: "team_1",
    vercelProjectId: "prj_1",
  },
  deploymentStrategy: "vercel_ci_pushed",
  lastProvisionedAt: null,
  lastProvisionedBy: null,
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z",
};

const envMetadata: EnvVarMetadata = {
  id: "env-1",
  projectId: "project-1",
  targetId: "target-1",
  provider: "vercel",
  environment: "test",
  key: "NEXT_PUBLIC_API_URL",
  valueFingerprint: "fp",
  lastProvisionedAt: "2026-06-10T00:00:00.000Z",
  lastProvisionedBy: "user-1",
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("env provisioning hooks", () => {
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  function renderProjectHook(enabled = true) {
    const snapshots: ReturnType<typeof useProjectEnvProvisioning>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useProjectEnvProvisioning("project-1", enabled));
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });

    return snapshots;
  }

  function renderConnectionsHook(enabled = true) {
    const snapshots: ReturnType<typeof useProviderConnections>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useProviderConnections(enabled));
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });

    return snapshots;
  }

  function renderDeploymentProvisioningForm() {
    const snapshots: ReturnType<typeof useDeploymentProvisioningForm>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useDeploymentProvisioningForm());
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });

    return snapshots;
  }

  it("loads project targets, env metadata, and active provider connections", async () => {
    mockedListDeploymentTargets.mockResolvedValue([deploymentTarget]);
    mockedListProjectEnvMetadata.mockResolvedValue([envMetadata]);
    mockedListProviderConnections.mockResolvedValue([activeConnection, revokedConnection]);

    const snapshots = renderProjectHook();
    await flushEffects();

    const latest = snapshots.at(-1);
    expect(mockedListDeploymentTargets).toHaveBeenCalledWith("project-1");
    expect(mockedListProjectEnvMetadata).toHaveBeenCalledWith("project-1");
    expect(latest?.targets).toEqual([deploymentTarget]);
    expect(latest?.metadata).toEqual([envMetadata]);
    expect(latest?.providerConnections).toEqual([activeConnection]);
    expect(latest?.loading).toBe(false);
  });

  it("skips project env loading when disabled", async () => {
    const snapshots = renderProjectHook(false);
    await flushEffects();

    expect(mockedListDeploymentTargets).not.toHaveBeenCalled();
    expect(snapshots.at(-1)?.targets).toEqual([]);
  });

  it("adds deployment targets and reloads after provisioning env vars", async () => {
    mockedListDeploymentTargets.mockResolvedValue([deploymentTarget]);
    mockedListProjectEnvMetadata.mockResolvedValue([]);
    mockedListProviderConnections.mockResolvedValue([activeConnection]);
    mockedCreateDeploymentTarget.mockResolvedValue({ ...deploymentTarget, id: "target-2" });
    mockedProvisionProjectEnvVars.mockResolvedValue({
      metadata: [envMetadata],
      targetId: "target-2",
    });

    const snapshots = renderProjectHook();
    await flushEffects();

    await act(async () => {
      await snapshots.at(-1)?.addTarget({
        slot: "frontend",
        ownershipMode: "byo",
        provider: "vercel",
        providerConnectionId: "connection-1",
        projectName: "web",
      });
    });

    expect(snapshots.at(-1)?.targets[0]?.id).toBe("target-2");

    await act(async () => {
      await snapshots.at(-1)?.provision({
        targetId: "target-2",
        environment: "test",
        variables: [{ key: "NEXT_PUBLIC_API_URL", value: "https://api.example.com" }],
      });
    });

    expect(mockedProvisionProjectEnvVars).toHaveBeenCalledWith("project-1", {
      targetId: "target-2",
      environment: "test",
      variables: [{ key: "NEXT_PUBLIC_API_URL", value: "https://api.example.com" }],
    });
    expect(mockedListDeploymentTargets).toHaveBeenCalledTimes(2);
    expect(snapshots.at(-1)?.saving).toBe(false);
  });

  it("validates env text and removes metadata through the project hook", async () => {
    mockedListDeploymentTargets.mockResolvedValue([deploymentTarget]);
    mockedListProjectEnvMetadata.mockResolvedValue([envMetadata]);
    mockedListProviderConnections.mockResolvedValue([activeConnection]);
    mockedValidateProjectEnvVars.mockResolvedValue({
      keyCount: 2,
      keys: ["DATABASE_URL", "API_KEY"],
      duplicates: [],
      invalidKeys: [],
      warnings: [],
    });
    mockedDeleteProjectEnvMetadata.mockResolvedValue({
      removed: true,
      key: "DATABASE_URL",
    });

    const snapshots = renderProjectHook();
    await flushEffects();

    await expect(
      snapshots.at(-1)?.validateEnvText({
        deploymentTargetId: "target-1",
        environment: "test",
        text: "DATABASE_URL=postgres://secret\nAPI_KEY=secret",
      }),
    ).resolves.toMatchObject({
      keyCount: 2,
      keys: ["DATABASE_URL", "API_KEY"],
    });
    expect(mockedValidateProjectEnvVars).toHaveBeenCalledWith("project-1", {
      deploymentTargetId: "target-1",
      environment: "test",
      text: "DATABASE_URL=postgres://secret\nAPI_KEY=secret",
    });

    await act(async () => {
      await snapshots.at(-1)?.removeMetadata("env-1");
    });

    expect(mockedDeleteProjectEnvMetadata).toHaveBeenCalledWith("project-1", "env-1");
    expect(mockedListProjectEnvMetadata).toHaveBeenCalledTimes(2);
    expect(snapshots.at(-1)?.saving).toBe(false);
  });

  it("loads, saves, and revokes provider connections", async () => {
    mockedListProviderConnections.mockResolvedValue([activeConnection]);
    mockedCreateProviderConnection.mockResolvedValue({ ...activeConnection, id: "connection-3" });
    mockedRevokeProviderConnection.mockResolvedValue(undefined);

    const snapshots = renderConnectionsHook();
    await flushEffects();

    expect(snapshots.at(-1)?.connections).toEqual([activeConnection]);

    await act(async () => {
      await snapshots.at(-1)?.saveConnection({
        provider: "vercel",
        label: "Vercel Team",
        token: "token",
        vercelTeamId: "team_1",
      });
    });

    expect(snapshots.at(-1)?.connections[0]?.id).toBe("connection-3");

    await act(async () => {
      await snapshots.at(-1)?.revokeConnection("connection-3");
    });

    expect(mockedRevokeProviderConnection).toHaveBeenCalledWith("connection-3");
    expect(snapshots.at(-1)?.connections[0]?.status).toBe("revoked");
  });

  it("useProviderConnections defaults to enabled=true when no argument is given", async () => {
    mockedListProviderConnections.mockResolvedValue([activeConnection]);

    const snapshots: ReturnType<typeof useProviderConnections>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useProviderConnections());
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });
    await flushEffects();

    expect(mockedListProviderConnections).toHaveBeenCalledTimes(1);
    expect(snapshots.at(-1)?.connections).toEqual([activeConnection]);
  });

  it("useProjectEnvProvisioning defaults to enabled=true when only projectId is given", async () => {
    mockedListDeploymentTargets.mockResolvedValue([deploymentTarget]);
    mockedListProjectEnvMetadata.mockResolvedValue([envMetadata]);
    mockedListProviderConnections.mockResolvedValue([activeConnection]);

    const snapshots: ReturnType<typeof useProjectEnvProvisioning>[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Probe() {
      snapshots.push(useProjectEnvProvisioning("project-1"));
      return null;
    }

    act(() => {
      root?.render(<Probe />);
    });
    await flushEffects();

    expect(mockedListDeploymentTargets).toHaveBeenCalledWith("project-1");
    expect(snapshots.at(-1)?.targets).toEqual([deploymentTarget]);
  });

  it("skips provider connection loading when disabled", async () => {
    const snapshots = renderConnectionsHook(false);
    await flushEffects();

    expect(mockedListProviderConnections).not.toHaveBeenCalled();
    expect(snapshots.at(-1)?.connections).toEqual([]);
  });

  it("builds deployment provisioning payloads only when enabled", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    expect(snapshots.at(-1)?.enabled).toBe(false);
    expect(snapshots.at(-1)?.payload).toBeUndefined();

    act(() => {
      snapshots.at(-1)?.setDefaultTarget("frontend", "web-app");
    });

    expect(snapshots.at(-1)?.payload).toMatchObject({
      enabled: true,
      targets: [
        {
          slot: "frontend",
          provider: "vercel",
          ownershipMode: "flowci_managed",
          projectName: "web-app",
          branchName: "uat",
          rootDirectory: ".",
          buildCommand: "npm run build",
          startCommand: undefined,
        },
      ],
    });
  });

  it("normalizes deployment provisioning targets and filters blank env vars", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setDefaultTargets([
        { slot: "backend", projectName: "api" },
        { slot: "frontend", projectName: "web" },
      ]);
    });

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "   ",
            branchName: "   ",
            rootDirectory: "   ",
            buildCommand: "   ",
            startCommand: "   ",
            env: [
              {
                environment: "test",
                vars: [
                  { key: "API_URL", value: "https://api.example.com" },
                  { key: "   ", value: "ignored" },
                  { key: "EMPTY_VALUE", value: "" },
                ],
              },
            ],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.payload).toEqual({
      enabled: true,
      sharedEnv: undefined,
      targets: [
        {
          slot: "backend",
          provider: "render",
          ownershipMode: "flowci_managed",
          projectName: undefined,
          branchName: "uat",
          rootDirectory: undefined,
          buildCommand: undefined,
          startCommand: undefined,
          env: [
            {
              environment: "test",
              vars: [{ key: "API_URL", value: "https://api.example.com" }],
            },
          ],
        },
      ],
      variableGroups: undefined,
    });
  });

  it("flags Render provisioning as missing variables when no Render env vars remain after sanitization", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm ci && npm run build",
            env: [
              {
                environment: "test",
                vars: [
                  { key: "DATABASE_URL", value: "" },
                  { key: "   ", value: "ignored" },
                ],
              },
            ],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.renderVariablesRequired).toBe(true);
    expect(snapshots.at(-1)?.renderVariableCount).toBe(0);
    expect(snapshots.at(-1)?.renderVariablesMissing).toBe(true);
  });

  it("counts Render variable groups as available Render variables", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm ci && npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            name: "Render runtime",
            provider: "render",
            appliesTo: "selected",
            targetBranches: ["backend:render:test"],
            env: [
              {
                environment: "test",
                vars: [{ key: "DATABASE_URL", value: "postgres://x" }],
              },
            ],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.renderVariablesRequired).toBe(true);
    expect(snapshots.at(-1)?.renderVariableCount).toBe(1);
    expect(snapshots.at(-1)?.renderVariablesMissing).toBe(false);
  });

  it("sanitizes variable groups with defaulted optional fields", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm ci && npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            // name and appliesTo and targetBranches all omitted — all optional
            provider: "render",
            env: [{ environment: "test", vars: [{ key: "SECRET", value: "abc" }] }],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    const group = snapshots.at(-1)?.payload?.variableGroups?.[0];
    expect(group).toBeDefined();
    expect(group?.name).toBe("Variable group 1");
    expect(group?.appliesTo).toBe("all");
    // "all" groups must not carry a targetBranches key
    expect(group).not.toHaveProperty("targetBranches");
  });

  it("sanitizes variable groups with appliesTo=selected and valid targetBranches", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm ci && npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            name: "Named Group",
            provider: "render",
            appliesTo: "selected",
            targetBranches: ["backend:render:test"],
            env: [{ environment: "test", vars: [{ key: "DB_URL", value: "postgres://x" }] }],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    const group = snapshots.at(-1)?.payload?.variableGroups?.[0];
    expect(group?.name).toBe("Named Group");
    expect(group?.appliesTo).toBe("selected");
    expect(group?.targetBranches).toEqual(["backend:render:test"]);
  });

  it("filters out variable groups whose provider is not in the active target set", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            name: "Vercel Only",
            provider: "vercel", // render is the only active provider — vercel gets filtered
            appliesTo: "all",
            env: [{ environment: "test", vars: [{ key: "X", value: "y" }] }],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.payload?.variableGroups).toBeUndefined();
  });

  it("filters out variable groups whose env vars are all blank after sanitization", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            name: "Empty",
            provider: "render",
            appliesTo: "all",
            env: [{ environment: "test", vars: [{ key: "", value: "ignored" }] }],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.payload?.variableGroups).toBeUndefined();
  });

  it("filters out selected-appliesTo variable groups with no targetBranches after dedup", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm run build",
            env: [],
          },
        ],
        variableGroups: [
          {
            name: "Selected No Branches",
            provider: "render",
            appliesTo: "selected",
            targetBranches: [], // empty — gets filtered
            env: [{ environment: "test", vars: [{ key: "X", value: "y" }] }],
          },
        ],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.payload?.variableGroups).toBeUndefined();
  });

  it("includes sharedEnv in payload when at least one env set has valid vars", async () => {
    const snapshots = renderDeploymentProvisioningForm();

    act(() => {
      snapshots.at(-1)?.setRequest({
        enabled: true,
        targets: [
          {
            slot: "backend",
            provider: "render",
            ownershipMode: "flowci_managed",
            projectName: "api",
            branchName: "test",
            rootDirectory: ".",
            buildCommand: "npm run build",
            env: [],
          },
        ],
        sharedEnv: [{ environment: "test", vars: [{ key: "GLOBAL", value: "global-value" }] }],
      });
      snapshots.at(-1)?.setEnabled(true);
    });

    expect(snapshots.at(-1)?.payload?.sharedEnv).toEqual([
      { environment: "test", vars: [{ key: "GLOBAL", value: "global-value" }] },
    ]);
  });
});
