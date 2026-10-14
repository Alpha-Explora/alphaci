"use client";

import { NO_PROJECT_YET_MESSAGE, PROJECT_REQUIRED_MESSAGE } from "../model/create-target-rules";
import type { ProjectChoice } from "./setup-wizard-props";

function ChoiceStatus({ choice }: Readonly<{ choice: ProjectChoice }>) {
  if (choice.status === "error") {
    return (
      <p
        role="alert"
        className="wizard-field__hint wizard-field__hint--error"
        data-testid="setup-project-choice-error"
      >
        The team&apos;s Projects could not be loaded.{" "}
        <button type="button" className="inline-link" onClick={choice.onRetry}>
          Try again
        </button>
      </p>
    );
  }
  if (choice.status === "ready" && choice.options.length === 0) {
    return (
      <p
        role="status"
        className="wizard-field__hint wizard-field__hint--strong"
        data-testid="setup-project-choice-empty"
      >
        {NO_PROJECT_YET_MESSAGE}
      </p>
    );
  }
  return null;
}

/**
 * Why the repository cannot go into the chosen (or linked) Project yet: it
 * has no Feature. Announced, and it keeps the Repository step from going on.
 */
export function ProjectBlockerNote({ blocker }: Readonly<{ blocker: string | null | undefined }>) {
  if (!blocker) return null;
  return (
    <p
      role="alert"
      className="wizard-field__hint wizard-field__hint--strong"
      data-testid="setup-project-blocker"
    >
      {blocker}
    </p>
  );
}

/**
 * A Developer's Project select, in place of the free "Project name": every
 * repository a Developer creates belongs to one of the team's Projects, which
 * a Product owner created first, and which has its first Feature.
 */
export function ProjectChoiceField({ choice }: Readonly<{ choice: ProjectChoice }>) {
  const busy = choice.status !== "ready";
  const empty = choice.status === "ready" && choice.options.length === 0;
  return (
    <>
      <label className="wizard-field__label" htmlFor="project-choice">
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
          <option key={option.id} value={option.id} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <p id="project-choice-hint" className="wizard-field__hint">
        {PROJECT_REQUIRED_MESSAGE}
      </p>
      <ChoiceStatus choice={choice} />
    </>
  );
}
