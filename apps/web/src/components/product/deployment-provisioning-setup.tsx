"use client";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  EnvEnvironment,
  EnvProvider,
  EnvTargetSlot,
} from "@/lib/api/contracts";

interface DeploymentProvisioningSetupProps {
  enabled: boolean;
  repoShape: string;
  selectedProjectKind?: "frontend" | "backend";
  value: DeploymentProvisioningRequest;
  onChange: (value: DeploymentProvisioningRequest) => void;
  onEnabledChange?: (enabled: boolean) => void;
}

const environments: EnvEnvironment[] = ["test", "uat", "production"];

function fallbackTarget(selectedProjectKind?: "frontend" | "backend"): DeploymentProvisioningTargetRequest {
  const slot: EnvTargetSlot =
    selectedProjectKind === "frontend" ? "frontend" : selectedProjectKind === "backend" ? "backend" : "standalone";
  const provider: EnvProvider = slot === "frontend" ? "vercel" : "render";
  return {
    slot,
    provider,
    ownershipMode: "flowci_managed",
    branchName: "test",
    rootDirectory: ".",
    buildCommand: provider === "render" ? "npm ci && npm run build" : "npm run build",
    startCommand: provider === "render" ? "npm run start:prod" : undefined,
    env: [{ environment: "test", vars: [] }],
  };
}

function updateTargetAt(
  value: DeploymentProvisioningRequest,
  index: number,
  patch: Partial<DeploymentProvisioningTargetRequest>,
): DeploymentProvisioningRequest {
  return {
    ...value,
    targets: value.targets.map((target, currentIndex) =>
      currentIndex === index ? { ...target, ...patch } : target,
    ),
  };
}

function updateEnvSet(
  target: DeploymentProvisioningTargetRequest,
  envSet: DeploymentProvisioningEnvSet,
): DeploymentProvisioningTargetRequest {
  return {
    ...target,
    env: [envSet],
  };
}

function updateEnvVar(
  envSet: DeploymentProvisioningEnvSet,
  index: number,
  patch: Partial<{ key: string; value: string }>,
): DeploymentProvisioningEnvSet {
  const vars = [...envSet.vars];
  const current = vars[index] ?? { key: "", value: "" };
  vars[index] = { ...current, ...patch };
  return { ...envSet, vars };
}

function defaultProjectPlaceholder(repoShape: string, target: DeploymentProvisioningTargetRequest) {
  if (repoShape === "multi" || repoShape === "microservices") {
    return target.slot === "frontend" ? "app-frontend-test" : "app-backend-test";
  }
  return "project-name-test";
}

function ownershipDescription(target: DeploymentProvisioningTargetRequest) {
  if (target.provider !== "vercel") {
    return target.ownershipMode === "byo"
      ? "FlowCI uses your connected provider account for this target."
      : "FlowCI creates and manages this provider target for you.";
  }

  return target.ownershipMode === "byo"
    ? "FlowCI creates a Vercel project in your account and deploys through GitHub Actions. You do not need to install Vercel's GitHub integration."
    : "FlowCI creates and connects the Vercel project from its managed workspace.";
}

export function DeploymentProvisioningSetup({
  enabled,
  repoShape,
  selectedProjectKind,
  value,
  onChange,
  onEnabledChange,
}: Readonly<DeploymentProvisioningSetupProps>) {
  const targets = value.targets.length > 0 ? value.targets : [fallbackTarget(selectedProjectKind)];

  return (
    <div className="deployment-provisioning-setup">
      <div className="deployment-provisioning-setup__header">
        <div>
          <span className="controls-panel-label">Deployment provisioning</span>
          <p className="helper-text" style={{ margin: "0.35rem 0 0" }}>
            Create provider targets during setup, then send initial env vars directly to the provider.
          </p>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            aria-label="Provision deployment target"
            checked={enabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              if (onEnabledChange) {
                onEnabledChange(nextEnabled);
                return;
              }
              onChange({ ...value, enabled: nextEnabled });
            }}
          />
          <span>Provision deployment target</span>
        </label>
      </div>

      {enabled ? (
        <div className="deployment-provisioning-setup__body">
          {targets.map((target, targetIndex) => {
            const envSet = target.env?.[0] ?? { environment: "test" as EnvEnvironment, vars: [] };
            const vars = envSet.vars.length > 0 ? envSet.vars : [{ key: "", value: "" }];

            return (
              <section className="env-provisioning-section" key={`${target.slot}-${targetIndex}`}>
                <div className="env-section-header">
                  <div>
                    <h4>{target.slot === "standalone" ? "Deployment target" : `${target.slot} target`}</h4>
                    <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                      {target.provider === "vercel" ? "Vercel project" : "Render service"} on the test branch.
                    </p>
                  </div>
                </div>

                <div className="env-target-grid">
                  <label>
                    <span>Slot</span>
                    <select
                      aria-label={targetIndex === 0 ? "Target slot" : `Target slot ${targetIndex + 1}`}
                      value={target.slot}
                      onChange={(event) =>
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            slot: event.target.value as EnvTargetSlot,
                            provider: event.target.value === "frontend" ? "vercel" : target.provider,
                          }),
                        )
                      }
                    >
                      <option value="standalone">Standalone</option>
                      <option value="backend">Backend</option>
                      <option value="frontend">Frontend</option>
                    </select>
                  </label>
                  <label>
                    <span>Provider</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provider" : `Provider ${targetIndex + 1}`}
                      value={target.provider}
                      onChange={(event) =>
                        onChange(updateTargetAt(value, targetIndex, { provider: event.target.value as EnvProvider }))
                      }
                    >
                      <option value="render">Render</option>
                      <option value="vercel">Vercel</option>
                    </select>
                  </label>
                  <label>
                    <span>Ownership</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provider ownership" : `Provider ownership ${targetIndex + 1}`}
                      value={target.ownershipMode}
                      onChange={(event) =>
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            ownershipMode: event.target.value as DeploymentProvisioningTargetRequest["ownershipMode"],
                          }),
                        )
                      }
                    >
                      <option value="flowci_managed">Managed by FlowCI</option>
                      <option value="byo">Use my Vercel account</option>
                    </select>
                    <span className="helper-text" style={{ marginTop: "0.3rem" }}>
                      {ownershipDescription(target)}
                    </span>
                  </label>
                  {target.ownershipMode === "byo" ? (
                    <label>
                      <span>Provider connection ID</span>
                      <input
                        aria-label={targetIndex === 0 ? "Provider connection ID" : `Provider connection ID ${targetIndex + 1}`}
                        value={target.providerConnectionId ?? ""}
                        onChange={(event) =>
                          onChange(updateTargetAt(value, targetIndex, { providerConnectionId: event.target.value }))
                        }
                        placeholder={target.provider === "vercel" ? "Vercel connection UUID" : "Provider connection UUID"}
                      />
                    </label>
                  ) : null}
                  <label>
                    <span>Project name</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider project name" : `Provider project name ${targetIndex + 1}`}
                      value={target.projectName ?? ""}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { projectName: event.target.value }))}
                      placeholder={defaultProjectPlaceholder(repoShape, target)}
                    />
                  </label>
                  <label>
                    <span>Branch</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider branch" : `Provider branch ${targetIndex + 1}`}
                      value={target.branchName ?? "test"}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { branchName: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Root directory</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider root directory" : `Provider root directory ${targetIndex + 1}`}
                      value={target.rootDirectory ?? "."}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { rootDirectory: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Build command</span>
                    <input
                      aria-label={targetIndex === 0 ? "Provider build command" : `Provider build command ${targetIndex + 1}`}
                      value={target.buildCommand ?? ""}
                      onChange={(event) => onChange(updateTargetAt(value, targetIndex, { buildCommand: event.target.value }))}
                    />
                  </label>
                  {target.provider === "render" ? (
                    <label>
                      <span>Start command</span>
                      <input
                        aria-label={targetIndex === 0 ? "Provider start command" : `Provider start command ${targetIndex + 1}`}
                        value={target.startCommand ?? ""}
                        onChange={(event) => onChange(updateTargetAt(value, targetIndex, { startCommand: event.target.value }))}
                      />
                    </label>
                  ) : null}
                  <label>
                    <span>Environment</span>
                    <select
                      aria-label={targetIndex === 0 ? "Provisioning environment" : `Provisioning environment ${targetIndex + 1}`}
                      value={envSet.environment}
                      onChange={(event) =>
                        onChange(
                          updateTargetAt(value, targetIndex, {
                            env: [{ ...envSet, environment: event.target.value as EnvEnvironment }],
                          }),
                        )
                      }
                    >
                      {environments.map((environment) => (
                        <option key={environment} value={environment}>
                          {environment}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="env-section-header deployment-provisioning-setup__vars-header">
                  <div>
                    <strong>Initial variables</strong>
                    <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
                      Values are sent to the provider during setup and are not stored by FlowCI.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      onChange(
                        updateTargetAt(value, targetIndex, {
                          env: [{ ...envSet, vars: [...vars, { key: "", value: "" }] }],
                        }),
                      )
                    }
                  >
                    Add variable
                  </button>
                </div>

                {target.provider === "vercel" && target.ownershipMode === "byo" ? (
                  <p className="helper-text" style={{ margin: "0 0 0.6rem" }}>
                    FlowCI will install per-slot GitHub Actions secrets for Vercel deployment after the Vercel project is created.
                  </p>
                ) : null}

                {vars.map((variable, variableIndex) => (
                  <div className="env-var-row" key={`${target.slot}-${targetIndex}-${variableIndex}`}>
                    <input
                      aria-label={
                        targetIndex === 0
                          ? `Variable key ${variableIndex + 1}`
                          : `Variable key ${targetIndex + 1}-${variableIndex + 1}`
                      }
                      value={variable.key}
                      onChange={(event) => {
                        const nextEnvSet = updateEnvVar(envSet, variableIndex, { key: event.target.value.toUpperCase() });
                        onChange(updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)));
                      }}
                      placeholder="DATABASE_URL"
                    />
                    <input
                      aria-label={
                        targetIndex === 0
                          ? `Variable value ${variableIndex + 1}`
                          : `Variable value ${targetIndex + 1}-${variableIndex + 1}`
                      }
                      type="password"
                      value={variable.value}
                      onChange={(event) => {
                        const nextEnvSet = updateEnvVar(envSet, variableIndex, { value: event.target.value });
                        onChange(updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)));
                      }}
                      placeholder="value"
                    />
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
