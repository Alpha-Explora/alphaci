"use client";

import {
  PROJECT_NAME_HELP,
  addingToProjectLine,
  projectNameFieldMessage,
} from "../model/project-name-rules";

export interface ProjectNameFieldProps {
  /** The Project the repository joins: replaces the field with a read-only line. */
  joinedProjectName: string | null;
  onChange: (value: string) => void;
  /** A refusal from the backend (name taken), shown under the field. */
  serverError: string | null;
  value: string;
}

/**
 * The required "Project name" input, or "Adding to Project: <name>" when the
 * repository joins an existing Project. Independent of the repository names.
 */
export function ProjectNameField({
  joinedProjectName,
  onChange,
  serverError,
  value,
}: Readonly<ProjectNameFieldProps>) {
  if (joinedProjectName !== null) {
    return (
      <p className="repo-creation-scope wizard-field__context" data-testid="setup-adding-to-project">
        <span className="repo-creation-scope__dot" aria-hidden="true" />
        <span>{addingToProjectLine(joinedProjectName)}</span>
      </p>
    );
  }

  const message = projectNameFieldMessage(value, serverError);
  const describedBy = message ? "project-name-hint project-name-error" : "project-name-hint";
  return (
    <>
      <label className="wizard-field__label" htmlFor="project-name">
        Project name
      </label>
      <input
        id="project-name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Checkout platform"
        className="premium-input"
        autoComplete="off"
        required
        aria-required="true"
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy}
        data-testid="setup-project-name"
      />
      <p id="project-name-hint" className="wizard-field__hint">
        {PROJECT_NAME_HELP}
      </p>
      {message ? (
        <p
          id="project-name-error"
          role="alert"
          className="wizard-field__hint wizard-field__hint--error"
          data-testid="setup-project-name-error"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
