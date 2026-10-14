"use client";

import {
  environmentPathLine,
  environmentsCaption,
  type HostingChoice,
} from "../model/hosting-choice-rules";
import type { EnvironmentDraft } from "../model/project-environments-rules";

/**
 * The project's environments, read-only: the fixed dev, uat, main path in
 * promotion order, each with its display name, and what that means under the
 * Hosting choice. The editing rules stay in project-environments-rules; the
 * wizard no longer offers editing.
 */
export function EnvironmentsPath({
  choice,
  environments,
}: Readonly<{ choice: HostingChoice; environments: readonly EnvironmentDraft[] }>) {
  return (
    <section
      className="wizard-environments"
      aria-labelledby="wizard-environments-title"
      data-testid="setup-environments"
    >
      <h4 className="wizard-field__label" id="wizard-environments-title">
        Environments
      </h4>
      <ol className="wizard-environments__path" aria-label={environmentPathLine(environments)}>
        {environments.map((environment, index) => (
          <li className="wizard-environments__stop" key={environment.slug}>
            <span className="wizard-environments__pill">
              <code>{environment.slug}</code>
              <span>{environment.displayName}</span>
            </span>
            {index < environments.length - 1 ? (
              <span className="wizard-environments__arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="wizard-field__hint">{environmentsCaption(choice)}</p>
    </section>
  );
}
