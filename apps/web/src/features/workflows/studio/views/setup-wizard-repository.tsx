"use client";

import { githubOrgLogin, repoNamePlaceholder } from "../model/setup-tab-rules";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import { ProjectBlockerNote, ProjectChoiceField } from "./setup-project-choice-field";
import { ProjectNameField } from "./setup-project-name-field";
import type { WizardStepProps } from "./setup-wizard-props";

/**
 * Where the repository is created. Read-only: every repository goes to the
 * organization the GitHub App is installed in with all-repositories access.
 */
function RepositoryOwnerField({
  github,
}: Readonly<{ github: GithubInstallationsState }>) {
  const owner = githubOrgLogin(github.allRepositoriesAccount?.accountLogin);
  return (
    <div className="wizard-field wizard-field--full">
      <span className="wizard-field__label">Repository owner</span>
      <span className="wizard-field__static">{owner} organization</span>
      <p className="wizard-field__hint">
        All repositories are created in the <strong>{owner}</strong> organization,
        from the <strong>cicd-workflow</strong> source. This needs this
        environment&apos;s GitHub App installed there with all-repositories access.
      </p>
    </div>
  );
}

/**
 * The Repository step: the Project (named, chosen, or the one being joined),
 * then the repository's owner, name and visibility. The service is named
 * after the repository and sits at its root, so neither is asked for.
 */
/**
 * The Project row: the Developer's select, or the new Project's name. A joined
 * Project is already named by the "Project: Team / Project" line above the
 * steps, so it is not repeated here as "Adding to Project".
 */
function ProjectRow({
  form,
  joinedProjectName,
  projectChoice,
  projectBlocker,
}: Readonly<Pick<WizardStepProps, "form" | "joinedProjectName" | "projectChoice" | "projectBlocker">>) {
  const askForName = projectChoice === null && joinedProjectName === null;
  if (!projectChoice && !askForName && !projectBlocker) return null;
  return (
    <div className="wizard-field wizard-field--full">
      {projectChoice ? <ProjectChoiceField choice={projectChoice} /> : null}
      {askForName ? (
        <ProjectNameField
          joinedProjectName={null}
          value={form.projectName}
          onChange={form.setProjectName}
          serverError={form.projectNameError}
        />
      ) : null}
      <ProjectBlockerNote blocker={projectBlocker} />
    </div>
  );
}

export function SetupWizardRepository({
  form,
  github,
  joinedProjectName,
  projectChoice,
  projectBlocker,
  projectCatalog,
}: Readonly<WizardStepProps>) {
  return (
    <div className="wizard-grid">
      <ProjectRow
        form={form}
        joinedProjectName={joinedProjectName}
        projectChoice={projectChoice}
        projectBlocker={projectBlocker}
      />

      <RepositoryOwnerField github={github} />

      <div className="wizard-field">
        <label className="wizard-field__label" htmlFor="repo-name">
          Repository name
        </label>
        <input
          id="repo-name"
          value={form.repoName}
          onChange={(event) => form.setRepoName(event.target.value)}
          placeholder={repoNamePlaceholder(projectCatalog.selectedProjectType?.runtime)}
          className="premium-input"
          aria-describedby="repo-name-hint"
          autoComplete="off"
        />
        <p id="repo-name-hint" className="wizard-field__hint">
          Lowercase letters, numbers, and <code>-</code> <code>_</code> <code>.</code>;
          spaces become hyphens. The service takes the same name.
        </p>
      </div>
      <div className="wizard-field">
        <label className="wizard-field__label" htmlFor="repo-visibility">
          Visibility
        </label>
        <select
          id="repo-visibility"
          value={form.visibility}
          onChange={(event) => form.setVisibility(event.target.value as "private" | "public")}
          className="premium-input"
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
      </div>
    </div>
  );
}
