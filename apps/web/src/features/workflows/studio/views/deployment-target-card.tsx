"use client";

import type {
  DeploymentProvisioningEnvSet,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  EnvLane,
  EnvOwnershipMode,
  ProviderConnection,
} from "@/shared/api/contracts";
import {
  defaultProjectPlaceholder,
  envVarsForDisplay,
  lanes,
  ownershipDescription,
  providerLabel,
  readonlyValueLabel,
  targetFieldAriaLabel,
  targetKindLabel,
  targetNameLabel,
  targetProviderSummary,
  targetTitle,
  targetVarAriaLabel,
  updateEnvSet,
  updateEnvVar,
  updateTargetAt,
  variableLaneLabel,
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

interface TargetEditProps {
  onChange: (value: DeploymentProvisioningRequest) => void;
  target: DeploymentProvisioningTargetRequest;
  targetIndex: number;
  value: DeploymentProvisioningRequest;
}

/**
 * One Vercel or Render target, showing only what takes effect: its name, the
 * Render region and instance, and its own variables. A centrally managed
 * Render service always deploys the image the pipeline builds from
 * ./Dockerfile, so build and start commands, runtime, root directory and
 * deploy method are not asked for (their defaults are still sent, unchanged).
 */
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
  const edit = { onChange, target, targetIndex, value };
  return (
    <section
      className={[
        "env-provisioning-section",
        "deployment-target-section",
        "wizard-target",
        `deployment-target-section--${target.provider}`,
      ].join(" ")}
      aria-label={`${targetTitle(target)} on ${providerLabel(target.provider)}`}
    >
      <DeploymentTargetHeader ownershipMode={ownershipMode} target={target} />
      <div className="wizard-target__grid">
        {target.ownershipMode === "byo" ? (
          <ProviderConnectionField
            {...edit}
            connections={providerConnections.filter(
              (connection) => connection.provider === target.provider,
            )}
            loading={providerConnectionsLoading}
          />
        ) : null}
        <NameField {...edit} repoShape={repoShape} />
        {target.provider === "render" ? <RenderPlacementFields {...edit} /> : null}
      </div>
      <TargetVariables {...edit} />
    </section>
  );
}

function DeploymentTargetHeader({
  ownershipMode,
  target,
}: Readonly<{ ownershipMode: EnvOwnershipMode; target: DeploymentProvisioningTargetRequest }>) {
  const ownership =
    ownershipMode === "flowci_managed"
      ? "Centralized on ALPHACI"
      : `Your ${providerLabel(target.provider)} account`;
  return (
    <div className="wizard-target__header">
      <span
        className={["deployment-target-icon", `deployment-target-icon--${target.provider}`].join(" ")}
        aria-hidden="true"
      >
        {target.provider === "vercel" ? "V" : "R"}
      </span>
      <div className="wizard-target__heading">
        <h4>{targetTitle(target)}</h4>
        <p className="wizard-field__hint">
          {targetProviderSummary(target)} · {ownership}
        </p>
      </div>
      <span className="deployment-target-role">{targetKindLabel(target)}</span>
      <p className="wizard-field__hint wizard-target__about">{ownershipDescription(target)}</p>
    </div>
  );
}

function ProviderConnectionField({
  connections,
  loading,
  onChange,
  target,
  targetIndex,
  value,
}: Readonly<TargetEditProps & { connections: ProviderConnection[]; loading: boolean }>) {
  const selected = target.providerConnectionId ?? connections[0]?.id ?? "";
  return (
    <label className="wizard-field wizard-field--full">
      <span className="wizard-field__label">Provider connection</span>
      <select
        aria-label={targetFieldAriaLabel("Provider connection", targetIndex)}
        value={selected}
        disabled={loading || connections.length === 0}
        onChange={(event) =>
          onChange(updateTargetAt(value, targetIndex, { providerConnectionId: event.target.value }))
        }
      >
        {connections.length ? (
          connections.map((connection) => (
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

function NameField({
  onChange,
  repoShape,
  target,
  targetIndex,
  value,
}: Readonly<TargetEditProps & { repoShape: string }>) {
  return (
    <label className="wizard-field wizard-field--full">
      <span className="wizard-field__label">{targetNameLabel(target)}</span>
      <input
        aria-label={targetFieldAriaLabel("Provider project name", targetIndex)}
        value={target.projectName ?? ""}
        onChange={(event) =>
          onChange(updateTargetAt(value, targetIndex, { projectName: event.target.value }))
        }
        placeholder={defaultProjectPlaceholder(repoShape, target)}
        autoComplete="off"
      />
      <span className="wizard-field__hint">Starts as the repository name.</span>
    </label>
  );
}

function RenderPlacementFields({ onChange, target, targetIndex, value }: Readonly<TargetEditProps>) {
  return (
    <>
      <label className="wizard-field">
        <span className="wizard-field__label">Region</span>
        <input
          aria-label={targetFieldAriaLabel("Render region", targetIndex)}
          value={target.renderRegion ?? "singapore"}
          onChange={(event) =>
            onChange(updateTargetAt(value, targetIndex, { renderRegion: event.target.value }))
          }
          autoComplete="off"
        />
      </label>
      <div className="wizard-field">
        <span className="wizard-field__label">Instance</span>
        <span className="wizard-field__static">
          {readonlyValueLabel(target.renderInstanceType ?? "free")} web service
        </span>
      </div>
    </>
  );
}

function TargetVariables({ onChange, target, targetIndex, value }: Readonly<TargetEditProps>) {
  const envSet: DeploymentProvisioningEnvSet = target.env?.[0] ?? { lane: "preview", vars: [] };
  const vars = envVarsForDisplay(envSet);
  const setEnv = (next: DeploymentProvisioningEnvSet) =>
    onChange(updateTargetAt(value, targetIndex, updateEnvSet(target, next)));
  return (
    <div className="wizard-target__variables">
      <div className="wizard-target__variables-head">
        <div className="wizard-target__variables-title">
          <strong>Target variables</strong>
          <p className="wizard-field__hint">
            Values are sent during setup and are not stored by ALPHACI. They override
            shared defaults with the same key.
          </p>
        </div>
        <label className="wizard-target__lane">
          <span className="wizard-field__label">Applies to</span>
          <select
            aria-label={targetFieldAriaLabel("Provisioning environment", targetIndex)}
            value={envSet.lane}
            onChange={(event) => setEnv({ ...envSet, lane: event.target.value as EnvLane })}
          >
            {lanes.map((lane) => (
              <option key={lane} value={lane}>
                {variableLaneLabel(lane, target)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {target.provider === "vercel" ? (
        <p className="wizard-field__hint">
          Vercel deployment secrets are installed automatically after the project is created.
        </p>
      ) : null}

      {vars.map((variable, variableIndex) => (
        <TargetVarRow
          key={`${target.slot}-${targetIndex}-${variableIndex}`}
          envSet={envSet}
          setEnv={setEnv}
          targetIndex={targetIndex}
          variable={variable}
          variableIndex={variableIndex}
          vars={vars}
        />
      ))}
      <div>
        <button
          type="button"
          className="ghost-button wizard-target__add"
          onClick={() => setEnv({ ...envSet, vars: [...vars, { key: "", value: "" }] })}
        >
          Add variable
        </button>
      </div>
    </div>
  );
}

function TargetVarRow({
  envSet,
  setEnv,
  targetIndex,
  variable,
  variableIndex,
  vars,
}: Readonly<{
  envSet: DeploymentProvisioningEnvSet;
  setEnv: (next: DeploymentProvisioningEnvSet) => void;
  targetIndex: number;
  variable: { key: string; value: string };
  variableIndex: number;
  vars: Array<{ key: string; value: string }>;
}>) {
  return (
    <div className="env-var-row wizard-target__var">
      <label>
        <span>Key</span>
        <input
          aria-label={targetVarAriaLabel("Variable key", targetIndex, variableIndex)}
          value={variable.key}
          onChange={(event) =>
            setEnv(updateEnvVar(envSet, variableIndex, { key: event.target.value.toUpperCase() }))
          }
          placeholder="DATABASE_URL"
          autoComplete="off"
        />
      </label>
      <label>
        <span>Value</span>
        <input
          aria-label={targetVarAriaLabel("Variable value", targetIndex, variableIndex)}
          type="password"
          autoComplete="off"
          value={variable.value}
          onChange={(event) =>
            setEnv(updateEnvVar(envSet, variableIndex, { value: event.target.value }))
          }
          placeholder="value"
        />
      </label>
      <button
        type="button"
        className="env-var-row__remove env-var-remove"
        aria-label={targetVarAriaLabel("Remove variable", targetIndex, variableIndex)}
        disabled={vars.length === 1 && !variable.key && !variable.value}
        onClick={() => {
          const nextVars = vars.filter((_, currentIndex) => currentIndex !== variableIndex);
          setEnv({ ...envSet, vars: nextVars.length ? nextVars : [{ key: "", value: "" }] });
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
