"use client";

import {
  addEnvironment,
  environmentBranches,
  environmentsProblem,
  makeProduction,
  moveEnvironment,
  removeEnvironment,
  updateEnvironment,
  type EnvironmentDraft,
} from "../model/project-environments-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";

/**
 * The project's ordered environments, edited before the repository exists.
 * Off by default: until it is turned on the project keeps the fixed
 * dev, uat, main branch path.
 */
export function SetupWizardEnvironments({
  form,
}: Readonly<{ form: CreateProjectFormState }>) {
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
      {form.environmentsEnabled ? <EnvironmentEditor form={form} /> : null}
    </fieldset>
  );
}

function EnvironmentEditor({ form }: Readonly<{ form: CreateProjectFormState }>) {
  const { environments, setEnvironments } = form;
  const problem = environmentsProblem(environments);
  const first = environments[0];
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
      <ol style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {environments.map((environment, index) => (
          <li key={index}>
            <EnvironmentRowEditor
              count={environments.length}
              environment={environment}
              index={index}
              onChange={setEnvironments}
              environments={environments}
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

function EnvironmentRowEditor({
  count,
  environment,
  environments,
  index,
  onChange,
}: Readonly<{
  count: number;
  environment: EnvironmentDraft;
  environments: EnvironmentDraft[];
  index: number;
  onChange: (next: EnvironmentDraft[]) => void;
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
