"use client";

import { HelpTip } from "@/shared/ui/help-tip";

import { stackRuntimeLabel } from "../model/setup-tab-rules";
import type { WizardStepProps } from "./setup-wizard-props";

function NodeVersionOptions({
  versions,
}: Readonly<{ versions: readonly { value: string; label: string }[] }>) {
  if (versions.length === 0) {
    return (
      <>
        <option value="20">Node 20 LTS (Iron)</option>
        <option value="22">Node 22 LTS (Jod)</option>
        <option value="24">Node 24 LTS (Noble)</option>
      </>
    );
  }

  return (
    <>
      {versions.map((version) => (
        <option key={version.value} value={version.value}>{version.label}</option>
      ))}
    </>
  );
}

/**
 * Node version for a stack that runs on Node; for any other stack the
 * workflow engine catalog fixes the runtime, so it is shown, not asked for.
 * (A .NET project used to be asked for a Node version, and the review step
 * then confirmed one back that its pipeline never receives.)
 */
function RuntimeField({
  form,
  projectCatalog,
}: Readonly<Pick<WizardStepProps, "form" | "projectCatalog">>) {
  const runtime = projectCatalog.selectedProjectType?.runtime ?? "node";
  if (runtime !== "node") {
    return (
      <div className="wizard-field">
        <span className="wizard-field__label">Runtime</span>
        <span className="wizard-field__static">
          {stackRuntimeLabel(projectCatalog.selectedProjectType)}
        </span>
        <p className="wizard-field__hint">The workflow catalog sets the SDK version for this stack.</p>
      </div>
    );
  }
  return (
    <div className="wizard-field">
      <label className="wizard-field__label" htmlFor="node-version">
        Node version
      </label>
      <select
        id="node-version"
        value={form.nodeVersion}
        onChange={(event) => form.setNodeVersion(event.target.value)}
        className="premium-input"
      >
        <NodeVersionOptions versions={projectCatalog.nodeVersions} />
      </select>
      <p className="wizard-field__hint">The Node.js version the CI runner uses.</p>
    </div>
  );
}

/**
 * The Automation step: the runtime and the coverage bar. The workflow's
 * checks come from the recipe, and every project gets a Dockerfile (managed
 * Render and on-prem deploys build it), so neither is a choice here.
 */
export function SetupWizardAutomation({
  form,
  projectCatalog,
}: Readonly<WizardStepProps>) {
  return (
    <div className="wizard-grid">
      <RuntimeField form={form} projectCatalog={projectCatalog} />
      <div className="wizard-field">
        <label className="wizard-field__label" htmlFor="coverage-threshold">
          Coverage
          <HelpTip text="The minimum percentage of code that unit tests must exercise. Pipeline runs fail the Quality stage if coverage drops below this number." />
        </label>
        <select
          id="coverage-threshold"
          value={form.coverageThreshold}
          onChange={(event) => form.setCoverageThreshold(event.target.value)}
          className="premium-input"
        >
          <option value="0">None (0%)</option>
          <option value="60">Basic (60%)</option>
          <option value="80">Standard (80%)</option>
          <option value="90">Strict (90%)</option>
          <option value="100">Full (100%)</option>
        </select>
        <p className="wizard-field__hint">Below this, the Quality stage fails.</p>
      </div>
      <p className="wizard-field__note wizard-field--full" data-testid="setup-automation-note">
        The checks come from the workflow recipe. Every repository also gets a
        Dockerfile, which Render and on-prem deploys build.
      </p>
    </div>
  );
}

export function GenerateYamlLink({
  activeWizardStep,
  generateDisabled,
  isCreatingProject,
  isExistingMode,
  onGenerateWorkflow,
}: Readonly<{
  activeWizardStep: number;
  generateDisabled: boolean;
  isCreatingProject: boolean;
  isExistingMode: boolean;
  onGenerateWorkflow: () => void;
}>) {
  if (isExistingMode) {
    return null;
  }
  if (activeWizardStep !== 2) {
    return null;
  }

  const label = isCreatingProject ? "Generating…" : "Generate YAML only";
  return (
    <div className="wizard-generate-yaml">
      <button
        type="button"
        className="generate-yaml-link"
        data-testid="generate-workflow-button"
        disabled={generateDisabled}
        onClick={() => void onGenerateWorkflow()}
        title="Generate workflow YAML only — no GitHub repo created"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        {label}
      </button>
      <span className="generate-workflow-hint">No repo — just the workflow file</span>
    </div>
  );
}
