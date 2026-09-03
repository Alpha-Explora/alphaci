"use client";

import { motion } from "framer-motion";

import type { MvpProjectOptionKey } from "@/shared/api/contracts";
import { HelpTip } from "@/shared/ui/help-tip";
import { projectOptionLabels } from "../view-models/use-project-options-catalog";
import { labelAccentStyle, projectOptionDescriptions } from "./setup-tab-shared";
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

function WorkflowCheckChip({
  option,
  onToggle,
}: Readonly<{
  option: {
    checked: boolean;
    key: MvpProjectOptionKey;
    supported: boolean;
  };
  onToggle: (key: MvpProjectOptionKey) => void;
}>) {
  const disabledClass = option.supported ? "" : " disabled";
  const activeClass = option.checked ? " enhancement-chip-label--active" : "";
  return (
    <motion.label
      className={`enhancement-chip-label-premium${disabledClass}${activeClass}`}
      htmlFor={`chip-${option.key}`}
      title={projectOptionDescriptions[option.key]}
      aria-label={`${projectOptionLabels[option.key]} — ${projectOptionDescriptions[option.key]}`}
      style={option.supported ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
      whileTap={option.supported ? { scale: 0.95 } : undefined}
      animate={option.checked ? { scale: 1 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
    >
      <input
        id={`chip-${option.key}`}
        type="checkbox"
        checked={option.checked}
        disabled={!option.supported}
        onChange={() => onToggle(option.key)}
      />
      <span className="enhancement-chip-dot" aria-hidden="true" />
      {projectOptionLabels[option.key]}
    </motion.label>
  );
}

export function SetupWizardAutomation({
  form,
  projectCatalog,
}: Readonly<WizardStepProps>) {
  return (
    <>
      <div style={{ marginTop: "1.5rem" }}>
        <label className="input-label" htmlFor="output-file-name" style={labelAccentStyle}>
          Workflow file name
        </label>
        <input
          id="output-file-name"
          value={form.outputFileName}
          onChange={(event) => form.setOutputFileName(event.target.value)}
          placeholder="ci.yml"
          className="premium-input"
        />
      </div>

      <div className="form-pair-row" style={{ marginTop: "1.5rem", gap: "1rem" }}>
        <div>
          <label className="input-label" htmlFor="node-version" style={labelAccentStyle}>
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
        </div>
        <div>
          <label className="input-label" htmlFor="coverage-threshold" style={labelAccentStyle}>
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
        </div>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <span
          className="input-label"
          style={{ ...labelAccentStyle, marginTop: 0, marginBottom: "0.6rem", display: "block" }}
        >
          Workflow checks
        </span>
        <div data-tour="test-toggles" className="enhancement-chips" aria-label="Workflow checks" role="group" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          {projectCatalog.supportedTestOptions.map((option) => (
            <WorkflowCheckChip
              key={option.key}
              option={option}
              onToggle={projectCatalog.toggleTestOption}
            />
          ))}
        </div>
      </div>
    </>
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
    <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
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
