"use client";

import { HelpTip } from "@/shared/ui/help-tip";
import { githubOrgLogin } from "../model/setup-tab-rules";
import type { CreateProjectFormState } from "../view-models/use-create-project-form";
import type { GithubInstallationsState } from "../view-models/use-github-installations";
import type { ProjectOptionsCatalogState } from "../view-models/use-project-options-catalog";
import { labelAccentStyle } from "./setup-tab-shared";
import type { WizardStepProps } from "./setup-wizard-props";

function SingleServiceFields({
  form,
  projectCatalog,
}: Readonly<{
  form: CreateProjectFormState;
  projectCatalog: ProjectOptionsCatalogState;
}>) {
  if (projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape) {
    return null;
  }

  return (
    <div className="form-pair-row" style={{ marginTop: "1.5rem", gap: "1rem" }}>
      <div>
        <label className="input-label" htmlFor="service-name" style={labelAccentStyle}>
          Service name
        </label>
        <input
          id="service-name"
          value={form.serviceName}
          onChange={(event) => form.setServiceName(event.target.value)}
          placeholder="my-next-app"
          className="premium-input"
        />
      </div>
      <div>
        <label className="input-label" htmlFor="service-path" style={labelAccentStyle}>
          Service path
          <HelpTip text="The folder inside the repository where this service's code lives. Use '.' if the app sits at the repository root. Build commands run from this path." />
        </label>
        <input
          id="service-path"
          value={form.servicePath}
          onChange={(event) => form.setServicePath(event.target.value)}
          placeholder="."
          className="premium-input"
        />
      </div>
    </div>
  );
}

function RepositoryOwnerFields({
  github,
}: Readonly<{ github: GithubInstallationsState }>) {
  const owner = githubOrgLogin(github.allRepositoriesAccount?.accountLogin);
  return (
    <>
      <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "1.5rem 0 0" }}>
        Source: <strong style={{ color: "var(--text-secondary)" }}>cicd-workflow</strong>
      </p>

      <label className="input-label" style={labelAccentStyle}>
        Repository owner
      </label>
      <div className="premium-input" aria-readonly="true" style={{ display: "flex", alignItems: "center" }}>
        {owner} organization
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0.3rem 0 0.9rem", lineHeight: 1.4 }}>
        All repositories are created in the{" "}
        <strong>{owner}</strong> organization. This
        requires this environment&apos;s GitHub App installed there with all-repositories access.
      </p>
    </>
  );
}

export function SetupWizardRepository({
  form,
  github,
  projectCatalog,
}: Readonly<WizardStepProps>) {
  return (
    <>
      <RepositoryOwnerFields github={github} />

      <div className="form-pair-row" style={{ gap: "1rem" }}>
        <div>
          <label className="input-label" htmlFor="repo-name" style={labelAccentStyle}>
            Repository name
          </label>
          <input
            id="repo-name"
            value={form.repoName}
            onChange={(event) => form.setRepoName(event.target.value)}
            placeholder="my-next-app"
            className="premium-input"
            aria-describedby="repo-name-hint"
          />
          <p
            id="repo-name-hint"
            style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.4rem 0 0", lineHeight: 1.5 }}
          >
            Lowercase letters, numbers, and <code>-</code> <code>_</code> <code>.</code> — spaces become hyphens.
          </p>
        </div>
        <div>
          <label className="input-label" htmlFor="repo-visibility" style={labelAccentStyle}>
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

      <SingleServiceFields form={form} projectCatalog={projectCatalog} />
    </>
  );
}
