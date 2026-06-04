"use client";

import { motion } from "framer-motion";

import type { CreateProjectResult, MvpProjectOptionKey } from "@/lib/api/contracts";
import type { CreateProjectFormState } from "@/hooks/use-create-project-form";
import type { GithubInstallationsState } from "@/hooks/use-github-installations";
import {
  projectOptionLabels,
  type ProjectOptionsCatalogState,
} from "@/hooks/use-project-options-catalog";

import { SetupResultPanel } from "./setup-result-panel";

interface WorkflowSetupTabProps {
  createResult: CreateProjectResult | null;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  onCreateProject: () => void;
  onGenerateWorkflow: () => void;
  onCopyYaml: (yaml: string) => void;
  onDownloadYaml: (yaml: string, fileName: string) => void;
  onViewProject: () => void;
  projectCatalog: ProjectOptionsCatalogState;
  reducedMotion: boolean;
}

const projectOptionDescriptions: Record<MvpProjectOptionKey, string> = {
  lint:     "Run code quality checks before build.",
  unit:     "Run the starter project's test script.",
  build:    "Compile or bundle the project.",
  coverage: "Enforce the configured coverage threshold.",
  security: "Run dependency and workflow security checks.",
  docker:   "Build a container image when the recipe supports it.",
};

export function WorkflowSetupTab({
  createResult,
  form,
  github,
  isCreatingProject,
  onCreateProject,
  onGenerateWorkflow,
  onCopyYaml,
  onDownloadYaml,
  onViewProject,
  projectCatalog,
  reducedMotion,
}: Readonly<WorkflowSetupTabProps>) {
  const createDisabled =
    isCreatingProject ||
    projectCatalog.loadingProjectOptions ||
    !form.repoName.trim() ||
    !projectCatalog.selectedProjectType;

  const generateDisabled =
    isCreatingProject ||
    projectCatalog.loadingProjectOptions ||
    !projectCatalog.selectedProjectType ||
    !(form.serviceName || form.repoName);

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
      {/* ── Left: GitHub App + Catalog ─────────────────────────────── */}
      <aside className="controls-panel">

        {/* GitHub App section */}
        <div className="controls-panel-section">
          <span className="controls-panel-label">GitHub App</span>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0 0 0.65rem", lineHeight: 1.5 }}>
            {github.installationStatusCopy}
          </p>

          {github.installUrl ? (
            <a
              className="github-repo-load-btn github-install-link"
              href={github.installUrl}
              target="_blank"
              rel="noreferrer"
              style={{ marginBottom: "0.65rem" }}
            >
              Install GitHub App
            </a>
          ) : (
            <button type="button" className="github-repo-load-btn" disabled style={{ marginBottom: "0.65rem" }}>
              {github.loadingInstallUrl ? "Loading install link…" : "Install link unavailable"}
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
            style={{ marginTop: "0.45rem" }}
          >
            {github.linkingInstallation ? "Linking…" : "Link installation"}
          </button>
        </div>

        <hr className="controls-panel-rule" />

        {/* Catalog section */}
        <div className="controls-panel-section">
          <span className="controls-panel-label">Catalog</span>

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
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.3rem 0 0", lineHeight: 1.5 }}>
              {projectCatalog.selectedRepoShape.description}
            </p>
          ) : null}

          <label className="input-label" htmlFor="project-type-select" style={{ marginTop: "0.75rem" }}>
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

          <label className="input-label" htmlFor="workflow-recipe-select" style={{ marginTop: "0.75rem" }}>
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
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.3rem 0 0", lineHeight: 1.5 }}>
              {projectCatalog.selectedWorkflowRecipe.description}
            </p>
          ) : null}
        </div>

        <hr className="controls-panel-rule" />

        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: 0 }}>
          Source: <strong style={{ color: "var(--text-secondary)" }}>workflow-core</strong>
        </p>
      </aside>

      {/* ── Center: Create Project form ────────────────────────────── */}
      <section className="templates-panel">
        <div className="templates-header">
          <h2>Create Project</h2>
          <p>{projectCatalog.selectedProjectType?.label ?? "Choose a project type"}</p>
        </div>

        {projectCatalog.loadingProjectOptions ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "0.5rem 0" }}>
            Loading project catalog…
          </p>
        ) : null}

        <div className="generate-form create-project-form">

          {/* Repository name + Visibility — paired row */}
          <div className="form-pair-row" style={{ marginTop: "0.75rem" }}>
            <div>
              <label className="input-label" htmlFor="repo-name">
                Repository name
              </label>
              <input
                id="repo-name"
                value={form.repoName}
                onChange={(event) => form.setRepoName(event.target.value)}
                placeholder="my-next-app"
              />
            </div>
            <div>
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
            </div>
          </div>

          {/* Service name + Service path — paired row */}
          <div className="form-pair-row">
            <div>
              <label className="input-label" htmlFor="service-name">
                Service name
              </label>
              <input
                id="service-name"
                value={form.serviceName}
                onChange={(event) => form.setServiceName(event.target.value)}
                placeholder="my-next-app"
              />
            </div>
            <div>
              <label className="input-label" htmlFor="service-path">
                Service path
              </label>
              <input
                id="service-path"
                value={form.servicePath}
                onChange={(event) => form.setServicePath(event.target.value)}
                placeholder="."
              />
            </div>
          </div>

          {/* Workflow file name — full width */}
          <label className="input-label" htmlFor="output-file-name">
            Workflow file name
          </label>
          <input
            id="output-file-name"
            value={form.outputFileName}
            onChange={(event) => form.setOutputFileName(event.target.value)}
            placeholder="ci.yml"
          />

          {/* Node version + Coverage — paired row */}
          <div className="form-pair-row">
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

          {/* Enhancement chips */}
          <div style={{ marginTop: "0.5rem" }}>
            <span className="input-label" style={{ marginTop: 0, marginBottom: "0.55rem", display: "block" }}>
              Workflow checks
            </span>
            <div className="enhancement-chips" aria-label="Workflow checks" role="group">
              {projectCatalog.supportedTestOptions.map((option) => (
                <label
                  key={option.key}
                  className={`enhancement-chip-label${option.supported ? "" : " disabled"}`}
                  htmlFor={`chip-${option.key}`}
                  title={projectOptionDescriptions[option.key]}
                  style={option.supported ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                >
                  <input
                    id={`chip-${option.key}`}
                    type="checkbox"
                    checked={option.checked}
                    disabled={!option.supported}
                    onChange={() => projectCatalog.toggleTestOption(option.key)}
                  />
                  <span className="enhancement-chip-dot" aria-hidden="true" />
                  {projectOptionLabels[option.key]}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="primary-button create-repo-btn"
            data-testid="setup-project-button"
            disabled={createDisabled}
            onClick={() => void onCreateProject()}
            style={{ marginTop: "0.75rem" }}
          >
            {isCreatingProject ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.77.5 12.27c0 5.2 3.3 9.6 7.88 11.15.58.11.79-.26.79-.57 0-.28-.01-1.2-.02-2.18-3.2.71-3.88-1.39-3.88-1.39-.53-1.37-1.29-1.73-1.29-1.73-1.05-.74.08-.73.08-.73 1.17.08 1.78 1.22 1.78 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.72-1.58-2.56-.3-5.26-1.3-5.26-5.8 0-1.28.45-2.33 1.18-3.16-.12-.3-.51-1.53.11-3.19 0 0 .97-.32 3.18 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.52 3.17-1.2 3.17-1.2.63 1.66.24 2.9.12 3.19.73.83 1.17 1.88 1.17 3.16 0 4.51-2.71 5.49-5.3 5.78.41.37.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .31.21.69.8.57a11.83 11.83 0 0 0 7.87-11.15C23.5 5.77 18.35.5 12 .5Z"/>
              </svg>
            )}
            {isCreatingProject ? "Creating…" : "Create GitHub Repository"}
          </button>

          <div className="generate-workflow-row">
            <button
              type="button"
              className="ghost-button"
              data-testid="generate-workflow-button"
              disabled={generateDisabled}
              onClick={() => void onGenerateWorkflow()}
              title="Generate workflow YAML only — no GitHub repo created"
            >
              {isCreatingProject ? "Generating…" : "Generate YAML only"}
            </button>
            <span className="generate-workflow-hint">No repo — just the workflow file</span>
          </div>
        </div>
      </section>

      {/* ── Right: Result panel ────────────────────────────────────── */}
      <SetupResultPanel
        setupResult={createResult}
        onViewProject={onViewProject}
        onCopyYaml={onCopyYaml}
        onDownloadYaml={onDownloadYaml}
      />
    </motion.section>
  );
}
