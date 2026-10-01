"use client";

import { NO_PROJECT_YET_MESSAGE, PROJECT_REQUIRED_MESSAGE } from "../model/create-target-rules";
import type { ProjectChoice } from "./setup-wizard-props";
import { labelAccentStyle } from "./setup-tab-shared";

const HELP_STYLE = {
  color: "var(--text-muted)",
  fontSize: "0.75rem",
  margin: "0.4rem 0 0",
  lineHeight: 1.5,
} as const;

const ERROR_STYLE = { ...HELP_STYLE, color: "var(--danger)" } as const;
const EMPTY_STYLE = { ...HELP_STYLE, color: "var(--text-secondary)", fontWeight: 600 } as const;

function ChoiceStatus({ choice }: Readonly<{ choice: ProjectChoice }>) {
  if (choice.status === "error") {
    return (
      <p role="alert" style={ERROR_STYLE} data-testid="setup-project-choice-error">
        The team&apos;s Projects could not be loaded.{" "}
        <button type="button" className="inline-link" onClick={choice.onRetry}>
          Try again
        </button>
      </p>
    );
  }
  if (choice.status === "ready" && choice.options.length === 0) {
    return (
      <p role="status" style={EMPTY_STYLE} data-testid="setup-project-choice-empty">
        {NO_PROJECT_YET_MESSAGE}
      </p>
    );
  }
  return null;
}

/**
 * A Developer's Project select, in place of the free "Project name": every
 * repository a Developer creates belongs to one of the team's Projects, which
 * a Product owner created first.
 */
export function ProjectChoiceField({ choice }: Readonly<{ choice: ProjectChoice }>) {
  const busy = choice.status !== "ready";
  const empty = choice.status === "ready" && choice.options.length === 0;
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label className="input-label" htmlFor="project-choice" style={labelAccentStyle}>
        Project
      </label>
      <select
        id="project-choice"
        className="premium-input"
        value={choice.selectedId}
        disabled={busy || empty}
        aria-required="true"
        aria-describedby="project-choice-hint"
        aria-busy={choice.status === "loading" ? true : undefined}
        data-testid="setup-project-choice"
        onChange={(event) => choice.onSelect(event.target.value)}
      >
        <option value="">
          {choice.status === "loading" ? "Loading Projects…" : "Select a Project…"}
        </option>
        {choice.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <p id="project-choice-hint" style={HELP_STYLE}>
        {PROJECT_REQUIRED_MESSAGE}
      </p>
      <ChoiceStatus choice={choice} />
    </div>
  );
}
