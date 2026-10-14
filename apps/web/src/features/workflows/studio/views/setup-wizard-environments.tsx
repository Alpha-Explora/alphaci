"use client";

import "./setup-wizard-environments.css";

import { useId } from "react";

import {
  environmentName,
  isOnpremEnvironment,
  runEveryEnvironmentOnprem,
  runsOnLabel,
  setEnvironmentRunsOn,
  type OnpremHosting,
} from "../model/onprem-hosting-rules";
import {
  addEnvironment,
  environmentBranches,
  environmentsProblem,
  makeProduction,
  moveEnvironment,
  removeEnvironment,
  updateEnvironment,
  type EnvironmentDraft,
  type EnvironmentRunsOn,
} from "../model/project-environments-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";

const RUNS_ON_OPTIONS: readonly EnvironmentRunsOn[] = ["managed", "onprem"];

/**
 * The project's ordered environments, edited before the repository exists.
 * Off by default: until it is turned on the project keeps the fixed
 * dev, uat, main branch path.
 *
 * Where the deployment offers on-prem hosting, each environment also chooses
 * where it runs. Where the backend does not list on-prem, nothing of it shows.
 */
export function SetupWizardEnvironments({
  form,
  onpremHosting,
}: Readonly<{ form: CreateProjectFormState; onpremHosting: OnpremHosting }>) {
  return (
    <fieldset className="env-card" style={{ marginTop: "1.5rem" }}>
      <legend>Environments</legend>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          checked={form.environmentsEnabled}
          onChange={(event) => form.setEnvironmentsEnabled(event.target.checked)}
          type="checkbox"
        />
        Define this project&apos;s environments
      </label>
      {form.environmentsEnabled ? (
        <EnvironmentEditor form={form} onpremHosting={onpremHosting} />
      ) : null}
    </fieldset>
  );
}

function EnvironmentEditor({
  form,
  onpremHosting,
}: Readonly<{ form: CreateProjectFormState; onpremHosting: OnpremHosting }>) {
  const { environments, setEnvironments } = form;
  const problem = environmentsProblem(environments);
  const first = environments[0];
  const noteId = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <p className="env-empty-state" style={{ margin: 0 }}>
        In promotion order.{" "}
        {first
          ? first.displayName +
            " deploys on every push to " +
            first.sourceBranch +
            "; each later environment receives a release only when it is promoted from the one before it."
          : null}
      </p>
      <OnpremQuickAction
        environments={environments}
        noteId={noteId}
        onChange={setEnvironments}
        onpremHosting={onpremHosting}
      />
      <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {environments.map((environment, index) => (
          <li key={index}>
            <EnvironmentRowEditor
              count={environments.length}
              environment={environment}
              index={index}
              onChange={setEnvironments}
              environments={environments}
              onpremHosting={onpremHosting}
              onpremNoteId={noteId}
            />
          </li>
        ))}
      </ol>
      <div>
        <button
          className="ghost-button"
          onClick={() => setEnvironments(addEnvironment(environments))}
          type="button"
        >
          Add environment
        </button>
      </div>
      <p style={{ margin: 0 }}>
        Branches created: <strong>{environmentBranches(environments).join(", ")}</strong>
      </p>
      {problem ? (
        <p className="error-text" role="alert" style={{ margin: 0 }}>
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Run every environment on-prem" sets every row; switching one row back
 * afterwards changes only that row. Disabled, with the server's reason, when
 * the deployment lists on-prem but has it turned off.
 */
function OnpremQuickAction({
  environments,
  noteId,
  onChange,
  onpremHosting,
}: Readonly<{
  environments: EnvironmentDraft[];
  noteId: string;
  onChange: (next: EnvironmentDraft[]) => void;
  onpremHosting: OnpremHosting;
}>) {
  if (onpremHosting.status === "hidden") return null;
  const unavailable = onpremHosting.status === "disabled";
  const everyOnprem = environments.every(isOnpremEnvironment);
  return (
    <div className="env-runs-on-bar">
      <button
        aria-describedby={unavailable ? noteId : undefined}
        className="ghost-button"
        disabled={unavailable || everyOnprem}
        onClick={() => onChange(runEveryEnvironmentOnprem(environments))}
        type="button"
      >
        Run every environment on-prem
      </button>
      {onpremHosting.status === "disabled" ? (
        <p className="env-runs-on-note" id={noteId}>
          On-prem host is unavailable: {onpremHosting.reason}
        </p>
      ) : null}
    </div>
  );
}

function RunsOnControl({
  environment,
  environments,
  index,
  onChange,
  onpremHosting,
  onpremNoteId,
}: Readonly<{
  environment: EnvironmentDraft;
  environments: EnvironmentDraft[];
  index: number;
  onChange: (next: EnvironmentDraft[]) => void;
  onpremHosting: OnpremHosting;
  onpremNoteId: string;
}>) {
  const name = useId();
  if (onpremHosting.status === "hidden") return null;
  const offered = onpremHosting.status === "enabled";
  const current: EnvironmentRunsOn =
    offered && isOnpremEnvironment(environment) ? "onprem" : "managed";
  return (
    <fieldset className="env-runs-on">
      <legend className="sr-only">Where {environmentName(environment)} runs</legend>
      <span aria-hidden="true" className="env-runs-on__label">
        Runs on
      </span>
      <span className="env-runs-on__options">
        {RUNS_ON_OPTIONS.map((value) => (
          <RunsOnOption
            checked={current === value}
            describedBy={offered ? undefined : onpremNoteId}
            disabled={value === "onprem" && !offered}
            key={value}
            name={name}
            onSelect={() => onChange(setEnvironmentRunsOn(environments, index, value))}
            value={value}
          />
        ))}
      </span>
    </fieldset>
  );
}

function RunsOnOption({
  checked,
  describedBy,
  disabled,
  name,
  onSelect,
  value,
}: Readonly<{
  checked: boolean;
  describedBy: string | undefined;
  disabled: boolean;
  name: string;
  onSelect: () => void;
  value: EnvironmentRunsOn;
}>) {
  return (
    <label className="env-runs-on__option" data-value={value}>
      <input
        aria-describedby={disabled ? describedBy : undefined}
        checked={checked}
        disabled={disabled}
        name={name}
        onChange={onSelect}
        type="radio"
        value={value}
      />
      <span>{runsOnLabel(value)}</span>
    </label>
  );
}

function EnvironmentRowEditor({
  count,
  environment,
  environments,
  index,
  onChange,
  onpremHosting,
  onpremNoteId,
}: Readonly<{
  count: number;
  environment: EnvironmentDraft;
  environments: EnvironmentDraft[];
  index: number;
  onChange: (next: EnvironmentDraft[]) => void;
  onpremHosting: OnpremHosting;
  onpremNoteId: string;
}>) {
  const edit = (change: Partial<Omit<EnvironmentDraft, "role">>) =>
    onChange(updateEnvironment(environments, index, change));
  return (
    <div
      aria-label={"Environment " + String(index + 1)}
      role="group"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}
    >
      <label>
        Name{" "}
        <input
          onChange={(event) => edit({ displayName: event.target.value })}
          value={environment.displayName}
        />
      </label>
      <label>
        ID{" "}
        <input
          onChange={(event) => edit({ slug: event.target.value.toLowerCase() })}
          value={environment.slug}
        />
      </label>
      <label>
        Branch{" "}
        <input
          onChange={(event) => edit({ sourceBranch: event.target.value })}
          value={environment.sourceBranch}
        />
      </label>
      <label>
        <input
          checked={environment.role === "production"}
          name="production-environment"
          onChange={() => onChange(makeProduction(environments, index))}
          type="radio"
        />{" "}
        Production
      </label>
      <RunsOnControl
        environment={environment}
        environments={environments}
        index={index}
        onChange={onChange}
        onpremHosting={onpremHosting}
        onpremNoteId={onpremNoteId}
      />
      <button
        aria-label={"Move " + environment.displayName + " earlier"}
        className="ghost-button"
        disabled={index === 0}
        onClick={() => onChange(moveEnvironment(environments, index, -1))}
        type="button"
      >
        ↑
      </button>
      <button
        aria-label={"Move " + environment.displayName + " later"}
        className="ghost-button"
        disabled={index === count - 1}
        onClick={() => onChange(moveEnvironment(environments, index, 1))}
        type="button"
      >
        ↓
      </button>
      <button
        className="ghost-button"
        disabled={count === 1}
        onClick={() => onChange(removeEnvironment(environments, index))}
        type="button"
      >
        Remove
      </button>
    </div>
  );
}
