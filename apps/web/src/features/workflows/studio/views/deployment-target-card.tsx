"use client";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  EnvLane,
  EnvOwnershipMode,
  ProviderConnection,
  RenderDeployMethod,
  RenderRuntime,
} from "@/shared/api/contracts";
import {
  activeBranch,
  defaultProjectPlaceholder,
  envVarsForDisplay,
  isPackagedRenderDeploy,
  lanes,
  laneLabel,
  ownershipDescription,
  providerLabel,
  readonlyValueLabel,
  renderRuntimeOptions,
  targetBranchLabel,
  targetFieldAriaLabel,
  targetKindLabel,
  targetProviderSummary,
  targetTitle,
  targetVarAriaLabel,
  updateEnvSet,
  updateEnvVar,
  updateTargetAt,
} from "../model/deployment-provisioning-rules";

interface DeploymentTargetCardProps {
  onChange: (value: DeploymentProvisioningRequest) => void;
  ownershipMode: EnvOwnershipMode;
  providerConnections: ProviderConnection[];
  providerConnectionsLoading: boolean;
  repoShape: string;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}

export function DeploymentTargetCard({
  onChange,
  ownershipMode,
  providerConnections,
  providerConnectionsLoading,
  repoShape,
  target,
  targetIndex,
  value,
}: Readonly<DeploymentTargetCardProps>) {
  const matchingConnections = providerConnections.filter(
    (connection) => connection.provider === target.provider,
  );
  const envSet = target.env?.[0] ?? {
    lane: "preview" as const,
    vars: [] as Array<{ key: string; value: string }>,
  };
  const vars = envVarsForDisplay(envSet);
  const selectedProviderConnectionId =
    target.providerConnectionId ?? matchingConnections[0]?.id ?? "";

  return (
    <section
      className={[
        "env-provisioning-section",
        "deployment-target-section",
        `deployment-target-section--${target.provider}`,
      ].join(" ")}
    >
      <DeploymentTargetHeader target={target} />
      <div className="env-target-grid">
        <OwnershipField ownershipMode={ownershipMode} target={target} />
        {target.ownershipMode === "byo" ? (
          <ProviderConnectionField
            matchingConnections={matchingConnections}
            onChange={onChange}
            providerConnectionsLoading={providerConnectionsLoading}
            selectedProviderConnectionId={selectedProviderConnectionId}
            target={target}
            targetIndex={targetIndex}
            value={value}
          />
        ) : null}
        <IdentityFields
          onChange={onChange}
          repoShape={repoShape}
          target={target}
          targetIndex={targetIndex}
          value={value}
        />
        {target.provider === "render" ? (
          <RenderTargetFields
            onChange={onChange}
            target={target}
            targetIndex={targetIndex}
            value={value}
          />
        ) : null}
        <LaneField
          envSet={envSet}
          onChange={onChange}
          targetIndex={targetIndex}
          value={value}
        />
      </div>
      <TargetVariables
        envSet={envSet}
        onChange={onChange}
        target={target}
        targetIndex={targetIndex}
        value={value}
        vars={vars}
      />
    </section>
  );
}

function DeploymentTargetHeader({
  target,
}: Readonly<{ target: DeploymentProvisioningTargetRequest }>) {
  return (
    <div className="env-section-header">
      <div className="deployment-target-heading">
        <span
          className={[
            "deployment-target-icon",
            `deployment-target-icon--${target.provider}`,
          ].join(" ")}
          aria-hidden="true"
        >
          {target.provider === "vercel" ? "V" : "R"}
        </span>
        <div>
          <h4>{targetTitle(target)}</h4>
          <p className="helper-text">{targetProviderSummary(target)}</p>
        </div>
      </div>
      <span className="deployment-target-role">{targetKindLabel(target)}</span>
    </div>
  );
}

function OwnershipField({
  ownershipMode,
  target,
}: Readonly<{
  ownershipMode: EnvOwnershipMode;
  target: DeploymentProvisioningTargetRequest;
}>) {
  return (
    <div className="env-target-grid__field env-target-grid__field--wide">
      <span>Ownership</span>
      <span className="env-static-field">
        {ownershipMode === "flowci_managed"
          ? "Centralized on ALPHACI"
          : `Use my ${providerLabel(target.provider)} account`}
      </span>
      <span className="helper-text env-target-grid__note">
        {ownershipDescription(target)}
      </span>
    </div>
  );
}

function ProviderConnectionField({
  matchingConnections,
  onChange,
  providerConnectionsLoading,
  selectedProviderConnectionId,
  target,
  targetIndex,
  value,
}: Readonly<{
  matchingConnections: ProviderConnection[];
  onChange: (value: DeploymentProvisioningRequest) => void;
  providerConnectionsLoading: boolean;
  selectedProviderConnectionId: string;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <label className="env-target-grid__field env-target-grid__field--wide">
      <span>Provider connection</span>
      <select
        aria-label={targetFieldAriaLabel("Provider connection", targetIndex)}
        value={selectedProviderConnectionId}
        disabled={
          providerConnectionsLoading || matchingConnections.length === 0
        }
        onChange={(event) =>
          onChange(
            updateTargetAt(value, targetIndex, {
              providerConnectionId: event.target.value,
            }),
          )
        }
      >
        {matchingConnections.length ? (
          matchingConnections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.label} - {connection.tokenLastFour}
            </option>
          ))
        ) : (
          <option value="">No saved {target.provider} connection</option>
        )}
      </select>
    </label>
  );
}

function IdentityFields({
  onChange,
  repoShape,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  repoShape: string;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <>
      <label className="env-target-grid__field env-target-grid__field--wide">
        <span>Project name</span>
        <input
          aria-label={targetFieldAriaLabel("Provider project name", targetIndex)}
          value={target.projectName ?? ""}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                projectName: event.target.value,
              }),
            )
          }
          placeholder={defaultProjectPlaceholder(repoShape, target)}
        />
      </label>
      <div className="env-target-grid__field env-target-grid__field--compact">
        <span>Branch</span>
        <span className="env-static-field">
          {activeBranch(target.branchName)}
        </span>
      </div>
      <label className="env-target-grid__field env-target-grid__field--compact">
        <span>Root directory</span>
        <input
          aria-label={targetFieldAriaLabel(
            "Provider root directory",
            targetIndex,
          )}
          value={target.rootDirectory ?? "."}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                rootDirectory: event.target.value,
              }),
            )
          }
        />
      </label>
      <label className="env-target-grid__field env-target-grid__field--wide">
        <span>Build command</span>
        <input
          aria-label={targetFieldAriaLabel("Provider build command", targetIndex)}
          value={target.buildCommand ?? ""}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                buildCommand: event.target.value,
              }),
            )
          }
        />
      </label>
    </>
  );
}

function RenderTargetFields({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <>
      <RenderDeployMethodField
        onChange={onChange}
        target={target}
        targetIndex={targetIndex}
        value={value}
      />
      <RenderRuntimeRegionFields
        onChange={onChange}
        target={target}
        targetIndex={targetIndex}
        value={value}
      />
      {target.renderDeployMethod === "native_git" ? (
        <RenderStartCommandField
          onChange={onChange}
          target={target}
          targetIndex={targetIndex}
          value={value}
        />
      ) : null}
      {target.renderDeployMethod === "existing_service" ? (
        <RenderExistingServiceFields
          onChange={onChange}
          target={target}
          targetIndex={targetIndex}
          value={value}
        />
      ) : null}
      {isPackagedRenderDeploy(target.renderDeployMethod) ? (
        <RenderPackagingDetails
          onChange={onChange}
          target={target}
          targetIndex={targetIndex}
          value={value}
        />
      ) : null}
    </>
  );
}

function RenderDeployMethodField({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <label className="env-target-grid__field env-target-grid__field--wide">
      <span>Deployment method</span>
      <select
        aria-label={targetFieldAriaLabel("Render deployment method", targetIndex)}
        value={target.renderDeployMethod ?? "native_git"}
        onChange={(event) =>
          onChange(
            updateTargetAt(value, targetIndex, {
              renderDeployMethod: event.target.value as RenderDeployMethod,
              action:
                event.target.value === "existing_service"
                  ? "register_existing"
                  : "create",
            }),
          )
        }
      >
        {target.ownershipMode === "flowci_managed" ? (
          <option value="managed_image" disabled>
            Automatic package deploy (archived)
          </option>
        ) : null}
        {target.ownershipMode === "byo" ? (
          <>
            <option value="native_git">Native Render build</option>
            <option value="existing_service">Existing Render service</option>
          </>
        ) : null}
      </select>
      <span className="helper-text env-target-grid__note">
        {target.renderDeployMethod === "native_git"
          ? "Uses Render build/start commands and requires Render repository access."
          : "ALPHACI packages and deploys this backend automatically."}
      </span>
    </label>
  );
}

function RenderRuntimeRegionFields({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <>
      <label className="env-target-grid__field env-target-grid__field--compact">
        <span>Runtime</span>
        <select
          aria-label={targetFieldAriaLabel("Render runtime", targetIndex)}
          value={target.renderRuntime ?? "docker"}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                renderRuntime: event.target.value as RenderRuntime,
              }),
            )
          }
        >
          {renderRuntimeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="helper-text env-target-grid__note">
          {target.renderDeployMethod === "native_git"
            ? "Render uses this runtime for its native Git build. Web service on the free plan."
            : "Image-backed deploys run as a Docker image; this records the service runtime intent. Web service on the free plan."}
        </span>
      </label>
      <div className="env-target-grid__field env-target-grid__field--compact">
        <span>Instance</span>
        <span className="env-static-field">
          {readonlyValueLabel(target.renderInstanceType ?? "free")}
        </span>
      </div>
      <label className="env-target-grid__field env-target-grid__field--compact">
        <span>Region</span>
        <input
          aria-label={targetFieldAriaLabel("Render region", targetIndex)}
          value={target.renderRegion ?? "singapore"}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                renderRegion: event.target.value,
              }),
            )
          }
        />
      </label>
    </>
  );
}

function RenderStartCommandField({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <label className="env-target-grid__field env-target-grid__field--wide">
      <span>Start command</span>
      <input
        aria-label={targetFieldAriaLabel("Provider start command", targetIndex)}
        value={target.startCommand ?? ""}
        onChange={(event) =>
          onChange(
            updateTargetAt(value, targetIndex, {
              startCommand: event.target.value,
            }),
          )
        }
      />
    </label>
  );
}

function RenderExistingServiceFields({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <>
      <label className="env-target-grid__field env-target-grid__field--wide">
        <span>Service ID</span>
        <input
          aria-label={targetFieldAriaLabel("Render service ID", targetIndex)}
          value={target.providerProjectId ?? ""}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                providerProjectId: event.target.value,
              }),
            )
          }
          placeholder="srv-..."
        />
      </label>
      <label className="env-target-grid__field env-target-grid__field--wide">
        <span>Service name</span>
        <input
          aria-label={targetFieldAriaLabel("Render service name", targetIndex)}
          value={target.providerProjectName ?? ""}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                providerProjectName: event.target.value,
              }),
            )
          }
          placeholder="api-uat"
        />
      </label>
    </>
  );
}

function RenderPackagingDetails({
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<{
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <details className="env-target-grid__field env-target-grid__field--wide">
      <summary>Packaging details</summary>
      <p className="helper-text">
        Uses a generated Dockerfile and GitHub Actions image deployment.
      </p>
      <label>
        <span>Docker context</span>
        <input
          aria-label={targetFieldAriaLabel("Docker context", targetIndex)}
          value={target.dockerContext ?? target.rootDirectory ?? "."}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                dockerContext: event.target.value,
              }),
            )
          }
        />
      </label>
      <label>
        <span>Dockerfile path</span>
        <input
          aria-label={targetFieldAriaLabel("Dockerfile path", targetIndex)}
          value={target.dockerfilePath ?? "Dockerfile"}
          onChange={(event) =>
            onChange(
              updateTargetAt(value, targetIndex, {
                dockerfilePath: event.target.value,
              }),
            )
          }
        />
      </label>
    </details>
  );
}

function LaneField({
  envSet,
  onChange,
  targetIndex,
  value,
}: Readonly<{
  envSet: DeploymentProvisioningEnvSet;
  onChange: (value: DeploymentProvisioningRequest) => void;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}>) {
  return (
    <label className="env-target-grid__field env-target-grid__field--compact">
      <span>Environment</span>
      <select
        aria-label={targetFieldAriaLabel("Provisioning environment", targetIndex)}
        value={envSet.lane}
        onChange={(event) =>
          onChange(
            updateTargetAt(value, targetIndex, {
              env: [
                {
                  ...envSet,
                  lane: event.target.value as EnvLane,
                },
              ],
            }),
          )
        }
      >
        {lanes.map((lane) => (
          <option key={lane} value={lane}>
            {laneLabel(lane)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TargetVariables({
  envSet,
  onChange,
  target,
  targetIndex,
  value,
  vars,
}: Readonly<{
  envSet: DeploymentProvisioningEnvSet;
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
  vars: Array<{ key: string; value: string }>;
}>) {
  return (
    <>
      <div className="env-section-header deployment-provisioning-setup__vars-header">
        <div>
          <strong>Target variables</strong>
          <p className="helper-text" style={{ margin: "0.25rem 0 0" }}>
            Add values only for {targetBranchLabel(target)}. These can override
            shared defaults with the same key. Values are sent during setup and
            are not stored by ALPHACI.
          </p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() =>
            onChange(
              updateTargetAt(value, targetIndex, {
                env: [
                  {
                    ...envSet,
                    vars: [...vars, { key: "", value: "" }],
                  },
                ],
              }),
            )
          }
        >
          Add key
        </button>
      </div>

      {target.provider === "vercel" ? (
        <p className="helper-text" style={{ margin: "0 0 0.6rem" }}>
          Vercel deployment secrets are installed automatically after the
          project is created.
        </p>
      ) : null}

      {vars.map((variable, variableIndex) => (
        <DeploymentTargetVarRow
          envSet={envSet}
          key={`${target.slot}-${targetIndex}-${variableIndex}`}
          onChange={onChange}
          target={target}
          targetIndex={targetIndex}
          value={value}
          variable={variable}
          variableIndex={variableIndex}
          vars={vars}
        />
      ))}
    </>
  );
}

function DeploymentTargetVarRow({
  envSet,
  onChange,
  target,
  targetIndex,
  value,
  variable,
  variableIndex,
  vars,
}: Readonly<{
  envSet: DeploymentProvisioningEnvSet;
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
  variable: { key: string; value: string };
  variableIndex: number;
  vars: Array<{ key: string; value: string }>;
}>) {
  return (
    <div className="env-var-row">
      <label>
        <span>Key</span>
        <input
          aria-label={targetVarAriaLabel("Variable key", targetIndex, variableIndex)}
          value={variable.key}
          onChange={(event) => {
            const nextEnvSet = updateEnvVar(envSet, variableIndex, {
              key: event.target.value.toUpperCase(),
            });
            onChange(
              updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)),
            );
          }}
          placeholder="DATABASE_URL"
        />
      </label>
      <label>
        <span>Value</span>
        <input
          aria-label={targetVarAriaLabel(
            "Variable value",
            targetIndex,
            variableIndex,
          )}
          type="password"
          autoComplete="off"
          value={variable.value}
          onChange={(event) => {
            const nextEnvSet = updateEnvVar(envSet, variableIndex, {
              value: event.target.value,
            });
            onChange(
              updateTargetAt(value, targetIndex, updateEnvSet(target, nextEnvSet)),
            );
          }}
          placeholder="value"
        />
      </label>
      <button
        type="button"
        className="env-var-row__remove env-var-remove"
        aria-label={targetVarAriaLabel("Remove variable", targetIndex, variableIndex)}
        disabled={vars.length === 1 && !variable.key && !variable.value}
        onClick={() => {
          const nextVars = vars.filter(
            (_, currentIndex) => currentIndex !== variableIndex,
          );
          onChange(
            updateTargetAt(value, targetIndex, {
              env: [
                {
                  ...envSet,
                  vars: nextVars.length ? nextVars : [{ key: "", value: "" }],
                },
              ],
            }),
          );
        }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
