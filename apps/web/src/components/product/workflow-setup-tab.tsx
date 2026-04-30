"use client";

import { motion } from "framer-motion";

import type { CreateProjectResponse, MvpProjectOptionKey } from "@/lib/api/contracts";
import type { CreateProjectFormState } from "@/hooks/use-create-project-form";
import type { GithubInstallationsState } from "@/hooks/use-github-installations";
import {
  projectOptionLabels,
  type ProjectOptionsCatalogState,
} from "@/hooks/use-project-options-catalog";

import { SetupResultPanel } from "./setup-result-panel";

interface WorkflowSetupTabProps {
  createResult: CreateProjectResponse | null;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  onCreateProject: () => void;
  onViewProject: () => void;
  projectCatalog: ProjectOptionsCatalogState;
  reducedMotion: boolean;
}

const projectOptionDescriptions: Record<MvpProjectOptionKey, string> = {
  lint: "Run code quality checks before build.",
  unit: "Run the starter project's test script.",
  build: "Compile or bundle the project.",
  coverage: "Enforce the configured coverage threshold.",
  security: "Run dependency and workflow security checks.",
  docker: "Build a container image when the recipe supports it.",
};

export function WorkflowSetupTab({
  createResult,
  form,
  github,
  isCreatingProject,
  onCreateProject,
  onViewProject,
  projectCatalog,
  reducedMotion,
}: Readonly<WorkflowSetupTabProps>) {
  const createDisabled =
    isCreatingProject ||
    projectCatalog.loadingProjectOptions ||
    !github.hasAllRepositoriesInstallation ||
    !projectCatalog.selectedProjectType ||
    !projectCatalog.selectedWorkflowRecipe;

  return (
    <motion.section
      className="studio-grid"
      id="workflow-panel-setup"
      role="tabpanel"
      aria-labelledby="workflow-tab-setup"
      tabIndex={0}
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <aside className="controls-panel">
        <h2>GitHub App</h2>
        <p className="helper-text">{github.installationStatusCopy}</p>

        <div className="github-repo-select">
          {github.installUrl ? (
            <a className="github-repo-load-btn github-install-link" href={github.installUrl} target="_blank" rel="noreferrer">
              Install GitHub App
            </a>
          ) : (
            <button type="button" className="github-repo-load-btn" disabled>
              {github.loadingInstallUrl ? "Loading install link..." : "Install link unavailable"}
            </button>
          )}

          <label className="input-label compact-label" htmlFor="installation-id">
            Installation ID
          </label>
          <input
            id="installation-id"
            value={github.installationId}
            onChange={(event) => github.setInstallationId(event.target.value.replaceAll(/\D/g, ""))}
            placeholder="12345678"
          />
          <button
            type="button"
            className="github-repo-load-btn"
            onClick={() => void github.handleLinkInstallation()}
            disabled={github.linkingInstallation}
          >
            {github.linkingInstallation ? "Linking..." : "Link installation"}
          </button>
        </div>

        <h2 className="side-section-title">Catalog</h2>
        <label className="input-label" htmlFor="repo-shape-select">
          Repository shape
        </label>
        <select
          id="repo-shape-select"
          value={projectCatalog.selectedRepoShapeId}
          onChange={(event) => projectCatalog.setSelectedRepoShapeId(event.target.value)}
          disabled={projectCatalog.loadingProjectOptions}
        >
          {projectCatalog.allRepoShapes.map((shape) => (
            <option key={shape.id} value={shape.id} disabled={!shape.enabled}>
              {shape.label}{shape.enabled ? "" : " (coming soon)"}
            </option>
          ))}
        </select>
        {projectCatalog.selectedRepoShape?.description ? (
          <p className="helper-text">{projectCatalog.selectedRepoShape.description}</p>
        ) : null}

        <label className="input-label" htmlFor="project-type-select">
          Language / framework
        </label>
        <select
          id="project-type-select"
          value={projectCatalog.selectedProjectTypeId}
          onChange={(event) => projectCatalog.setSelectedProjectTypeId(event.target.value)}
          disabled={projectCatalog.loadingProjectOptions}
        >
          {projectCatalog.projectTypesForShape.map((projectType) => (
            <option key={projectType.id} value={projectType.id}>
              {projectType.label}
            </option>
          ))}
        </select>

        <label className="input-label" htmlFor="workflow-recipe-select">
          Workflow recipe
        </label>
        <select
          id="workflow-recipe-select"
          value={projectCatalog.selectedWorkflowRecipeId}
          onChange={(event) => projectCatalog.setSelectedWorkflowRecipeId(event.target.value)}
          disabled={projectCatalog.loadingProjectOptions}
        >
          {projectCatalog.recipesForSelectedProject.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.label}
            </option>
          ))}
        </select>
        {projectCatalog.selectedWorkflowRecipe?.description ? (
          <p className="helper-text">{projectCatalog.selectedWorkflowRecipe.description}</p>
        ) : null}

        <p className="helper-text">
          Source repository: <strong>workflow-core</strong>
        </p>
      </aside>

      <section className="templates-panel">
        <div className="templates-header">
          <h2>Create Project</h2>
          <p>{projectCatalog.selectedProjectType?.label ?? "Choose a project type"}</p>
        </div>

        {projectCatalog.loadingProjectOptions ? (
          <p className="helper-text">Loading project catalog...</p>
        ) : null}

        <div className="generate-form create-project-form">
          <label className="input-label" htmlFor="repo-name">
            Repository name
          </label>
          <input
            id="repo-name"
            value={form.repoName}
            onChange={(event) => form.setRepoName(event.target.value)}
            placeholder="my-next-app"
          />

          <label className="input-label" htmlFor="repo-visibility">
            Visibility
          </label>
          <select
            id="repo-visibility"
            value={form.visibility}
            onChange={(event) => form.setVisibility(event.target.value as "private" | "public")}
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>

          <label className="input-label" htmlFor="service-name">
            Service name
          </label>
          <input
            id="service-name"
            value={form.serviceName}
            onChange={(event) => form.setServiceName(event.target.value)}
            placeholder="my-next-app"
          />

          <label className="input-label" htmlFor="service-path">
            Service path
          </label>
          <input
            id="service-path"
            value={form.servicePath}
            onChange={(event) => form.setServicePath(event.target.value)}
            placeholder="."
          />

          <label className="input-label" htmlFor="output-file-name">
            Workflow file name
          </label>
          <input
            id="output-file-name"
            value={form.outputFileName}
            onChange={(event) => form.setOutputFileName(event.target.value)}
            placeholder="ci.yml"
          />

          <div className="input-row">
            <div>
              <label className="input-label" htmlFor="node-version">
                Node version
              </label>
              <input
                id="node-version"
                value={form.nodeVersion}
                onChange={(event) => form.setNodeVersion(event.target.value)}
                placeholder="24"
              />
            </div>
            <div>
              <label className="input-label" htmlFor="coverage-threshold">
                Coverage %
              </label>
              <input
                id="coverage-threshold"
                value={form.coverageThreshold}
                onChange={(event) => form.setCoverageThreshold(event.target.value)}
                placeholder="80"
              />
            </div>
          </div>

          <div className="enhancement-grid" aria-label="Workflow checks">
            {projectCatalog.supportedTestOptions.map((option) => (
              <label
                className={`enhancement-option ${option.supported ? "" : "disabled-option"}`}
                key={option.key}
                htmlFor={`test-${option.key}`}
              >
                <input
                  id={`test-${option.key}`}
                  type="checkbox"
                  checked={option.checked}
                  disabled={!option.supported}
                  onChange={() => projectCatalog.toggleTestOption(option.key)}
                />
                <span>{projectOptionLabels[option.key]}</span>
                <small>
                  {projectOptionDescriptions[option.key]}
                  {option.job ? ` Job: ${option.job}.` : ""}
                </small>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="primary-button"
            data-testid="setup-project-button"
            disabled={createDisabled}
            onClick={() => void onCreateProject()}
          >
            {isCreatingProject ? "Creating..." : "Create project"}
          </button>
          {!github.hasAllRepositoriesInstallation ? (
            <p className="helper-text">
              Create Project is enabled after the GitHub App is linked with all repositories access.
            </p>
          ) : null}
        </div>
      </section>

      <SetupResultPanel setupResult={createResult} onViewProject={onViewProject} />
    </motion.section>
  );
}
