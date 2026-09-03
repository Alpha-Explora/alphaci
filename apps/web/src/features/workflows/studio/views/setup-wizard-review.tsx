"use client";

import { githubOrgLogin, selectedShapeLabel } from "../model/setup-tab-rules";
import { projectOptionLabels } from "../view-models/use-project-options-catalog";
import type { WizardStepProps } from "./setup-wizard-props";

function reviewRepoName(repoName: string): string {
  if (!repoName) {
    return "repository-name";
  }
  return repoName;
}

function reviewWorkflowLabel(label?: string): string {
  if (!label) {
    return "Standard";
  }
  return label;
}

function reviewOutputFile(outputFileName: string): string {
  if (!outputFileName) {
    return "ci.yml";
  }
  return outputFileName;
}

function reviewNodeVersion(nodeVersion: string): string {
  if (!nodeVersion) {
    return "default";
  }
  return nodeVersion;
}

function reviewDeliveryLabel(enabled: boolean): string {
  if (enabled) {
    return "Deployment setup included";
  }
  return "CI workflow only";
}

function GithubCreateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z"/>
    </svg>
  );
}

function ReviewCreateButton({
  disabled,
  isCreatingProject,
  onCreateProject,
}: Readonly<{
  disabled: boolean;
  isCreatingProject: boolean;
  onCreateProject: () => void;
}>) {
  const icon = isCreatingProject ? (
    <span className="btn-spinner" aria-hidden="true" />
  ) : (
    <GithubCreateIcon />
  );
  const label = isCreatingProject ? "Creating…" : "Create GitHub Repository";
  return (
    <button
      type="button"
      className="primary-button create-repo-btn-premium"
      data-testid="setup-project-button"
      disabled={disabled}
      onClick={() => void onCreateProject()}
      style={{ marginTop: "2rem" }}
    >
      {icon}
      {label}
    </button>
  );
}

function isCheckedOption(option: { checked: boolean }): boolean {
  return option.checked;
}

export function SetupWizardReview({
  deploymentProvisioning,
  finalCreateDisabled,
  form,
  github,
  isCreatingProject,
  onCreateProject,
  projectCatalog,
}: Readonly<WizardStepProps>) {
  const owner = githubOrgLogin(github.allRepositoriesAccount?.accountLogin);
  const checkedOptions = projectCatalog.supportedTestOptions.filter(isCheckedOption);

  return (
    <>
      <section className="repo-wizard-review" aria-labelledby="repo-wizard-review-title">
        <div className="repo-wizard-review__heading">
          <span className="repo-wizard-review__eyebrow">Ready to provision</span>
          <h3 id="repo-wizard-review-title">Review your repository</h3>
          <p>ALPHACI will create the repository, protected branches, and the selected CI workflow in one operation.</p>
        </div>
        <dl className="repo-wizard-review__grid">
          <div><dt>Repository</dt><dd>{owner}/{reviewRepoName(form.repoName)}</dd></div>
          <div><dt>Visibility</dt><dd>{form.visibility}</dd></div>
          <div><dt>Shape</dt><dd>{selectedShapeLabel(projectCatalog.allRepoShapes, projectCatalog.selectedRepoShapeId)}</dd></div>
          <div><dt>Workflow</dt><dd>{reviewWorkflowLabel(projectCatalog.selectedWorkflowRecipe?.label)} · {reviewOutputFile(form.outputFileName)}</dd></div>
          <div><dt>Runtime</dt><dd>Node {reviewNodeVersion(form.nodeVersion)} · {form.coverageThreshold}% coverage</dd></div>
          <div><dt>Delivery</dt><dd>{reviewDeliveryLabel(deploymentProvisioning.enabled)}</dd></div>
        </dl>
        <div className="repo-wizard-review__checks">
          {checkedOptions.map((option) => (
            <span key={option.key}>{projectOptionLabels[option.key]}</span>
          ))}
        </div>
      </section>

      <ReviewCreateButton
        disabled={finalCreateDisabled}
        isCreatingProject={isCreatingProject}
        onCreateProject={onCreateProject}
      />
    </>
  );
}
