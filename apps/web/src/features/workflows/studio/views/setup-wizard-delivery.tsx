"use client";

import { useId } from "react";

import { formatQuotaStatus } from "../model/workflow-studio-rules";
import {
  HOSTING_DESCRIPTIONS,
  renderVariablesBlockingFor,
  type HostingOption,
} from "../model/hosting-choice-rules";
import type { HostingChoiceState } from "../view-models/use-hosting-choice";
import { firstHostProblem } from "../model/setup-delivery-rules";
import { DeploymentProvisioningSetup } from "./deployment-provisioning-setup";
import { EnvironmentsPath } from "./setup-wizard-environments";
import {SetupHostSelection} from './setup-host-selection';
import type { WizardStepProps } from "./setup-wizard-props";

function QuotaNotice({
  projectQuota,
}: Readonly<{ projectQuota: WizardStepProps["projectQuota"] }>) {
  if (!projectQuota) {
    return null;
  }
  return (
    <p className="wizard-notice" role="status">
      Project quota: {formatQuotaStatus(projectQuota)}
    </p>
  );
}

function RenderVariablesNotice({ missing }: Readonly<{ missing: boolean }>) {
  if (!missing) {
    return null;
  }
  return (
    <p className="wizard-notice wizard-notice--alert" role="alert">
      Add at least one Render environment variable before creating the repository.
    </p>
  );
}

/** Says why Continue is off; the problem itself sits by its environment's machine. */
function HostProblemNotice({ problem }: Readonly<{ problem: string | null }>) {
  if (!problem) {
    return null;
  }
  return (
    <p className="wizard-notice wizard-notice--alert" role="status">
      Continue is off until the host problem above is fixed.
    </p>
  );
}

function HostingRadio({
  checked,
  name,
  noteId,
  onSelect,
  option,
}: Readonly<{
  checked: boolean;
  name: string;
  noteId: string;
  onSelect: () => void;
  option: HostingOption;
}>) {
  return (
    <label className="wizard-segmented__option" data-value={option.value}>
      <input
        type="radio"
        name={name}
        value={option.value}
        checked={checked}
        disabled={option.disabled}
        aria-describedby={option.reason ? noteId : undefined}
        onChange={onSelect}
      />
      <span>{option.label}</span>
    </label>
  );
}

/**
 * One project-wide Hosting choice: a native radio group (arrow keys move
 * between options, a screen reader announces the group by its legend), drawn
 * as segmented pills. An option the deployment cannot offer stays visible,
 * disabled, with the reason beside the group.
 */
function HostingChoiceField({ hosting }: Readonly<{ hosting: HostingChoiceState }>) {
  const name = useId();
  const noteId = useId();
  const unavailable = hosting.options.find((option) => option.reason);
  return (
    <fieldset className="wizard-hosting" data-tour="hosting">
      <legend className="wizard-field__label">Hosting</legend>
      <div className="wizard-segmented">
        {hosting.options.map((option) => (
          <HostingRadio
            key={option.value}
            checked={hosting.choice === option.value}
            name={name}
            noteId={noteId}
            onSelect={() => hosting.select(option.value)}
            option={option}
          />
        ))}
      </div>
      <p className="wizard-field__hint" data-testid="setup-hosting-description">
        {HOSTING_DESCRIPTIONS[hosting.choice]}
      </p>
      {unavailable ? (
        <p className="wizard-field__hint" id={noteId} data-testid="setup-hosting-unavailable">
          {unavailable.label} is unavailable: {unavailable.reason}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Vercel / Render on a deployment that does not offer provisioning: the backend's default. */
function DefaultHostingNote() {
  return (
    <p className="wizard-notice" role="status">
      ALPHACI sets up its default Render or Vercel target for this stack.
    </p>
  );
}

function HostedTargets({
  deploymentOwnershipMode,
  deploymentProvisioning,
  envProvisioningEnabled,
  projectCatalog,
  selectedProjectKind,
}: Readonly<
  Pick<
    WizardStepProps,
    | "deploymentOwnershipMode"
    | "deploymentProvisioning"
    | "envProvisioningEnabled"
    | "projectCatalog"
    | "selectedProjectKind"
  >
>) {
  if (!envProvisioningEnabled) {
    return <DefaultHostingNote />;
  }
  return (
    <DeploymentProvisioningSetup
      ownershipMode={deploymentOwnershipMode}
      repoShape={projectCatalog.selectedRepoShapeId}
      selectedProjectKind={selectedProjectKind}
      value={deploymentProvisioning.request}
      onChange={deploymentProvisioning.setRequest}
    />
  );
}

/**
 * The Delivery step: where the project runs (one choice for the whole
 * project), the fixed dev, uat, main path, and for Vercel / Render the
 * hosting targets and their variables.
 */
export function SetupWizardDelivery({
  deploymentOwnershipMode,
  deploymentProvisioning,
  envProvisioningEnabled,
  form,
  hosting,
  hostProblems,
  hostSelection,
  projectCatalog,
  projectQuota,
  selectedProjectKind,
}: Readonly<WizardStepProps>) {
  const renderVariablesMissing = renderVariablesBlockingFor({
    choice: hosting.choice,
    provisioningOffered: envProvisioningEnabled,
    missing: deploymentProvisioning.hostedRenderVariablesMissing,
  });
  const hostProblem = firstHostProblem(hostProblems);
  return (
    <div className="wizard-delivery">
      <HostingChoiceField hosting={hosting} />
      <EnvironmentsPath choice={hosting.choice} environments={form.environments} />
      {hosting.choice==='onprem'?<SetupHostSelection environments={form.environments} hostProblems={hostProblems} hostSelection={hostSelection} onChange={form.setEnvironments} slot={selectedProjectKind}/>:null}
      <HostProblemNotice problem={hostProblem} />
      {hosting.choice === "hosted" ? (
        <HostedTargets
          deploymentOwnershipMode={deploymentOwnershipMode}
          deploymentProvisioning={deploymentProvisioning}
          envProvisioningEnabled={envProvisioningEnabled}
          projectCatalog={projectCatalog}
          selectedProjectKind={selectedProjectKind}
        />
      ) : null}
      <QuotaNotice projectQuota={projectQuota} />
      <RenderVariablesNotice missing={renderVariablesMissing} />
    </div>
  );
}
