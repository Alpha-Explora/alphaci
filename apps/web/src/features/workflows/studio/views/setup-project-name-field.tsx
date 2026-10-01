"use client";

import {
  PROJECT_NAME_HELP,
  addingToProjectLine,
  projectNameFieldMessage,
} from "../model/project-name-rules";
import { labelAccentStyle } from "./setup-tab-shared";

const HELP_STYLE = {
  color: "var(--text-muted)",
  fontSize: "0.75rem",
  margin: "0.4rem 0 0",
  lineHeight: 1.5,
} as const;

const ERROR_STYLE = { ...HELP_STYLE, color: "var(--danger)" } as const;

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
      <p
        className="repo-creation-scope"
        data-testid="setup-adding-to-project"
        style={{ margin: "0 0 1.25rem" }}
      >
        <span className="repo-creation-scope__dot" aria-hidden="true" />
        <span>{addingToProjectLine(joinedProjectName)}</span>
      </p>
    );
  }

  const message = projectNameFieldMessage(value, serverError);
  const describedBy = message ? "project-name-hint project-name-error" : "project-name-hint";
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label className="input-label" htmlFor="project-name" style={labelAccentStyle}>
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
      <p id="project-name-hint" style={HELP_STYLE}>
        {PROJECT_NAME_HELP}
      </p>
      {message ? (
        <p id="project-name-error" role="alert" style={ERROR_STYLE} data-testid="setup-project-name-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
