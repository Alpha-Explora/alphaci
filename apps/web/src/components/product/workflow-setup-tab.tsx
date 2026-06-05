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
  onViewProject: () => void;
  projectCatalog: ProjectOptionsCatalogState;
  reducedMotion: boolean;
}

// onCopyYaml and onDownloadYaml are kept in the interface for the "Generate YAML only"
// flow (handleGenerateWorkflow), which still works off workflow history entries that
// contain the YAML content. They are intentionally not forwarded to SetupResultPanel
// because the unified create endpoint commits the file to the repo directly — no YAML
// is returned in the response.

const projectOptionDescriptions: Record<MvpProjectOptionKey, string> = {
  lint:     "Run code quality checks before build.",
  unit:     "Run the starter project's test script.",
  build:    "Compile or bundle the project.",
  coverage: "Enforce the configured coverage threshold.",
  security: "Run dependency and workflow security checks.",
  docker:   "Build a container image when the recipe supports it.",
};

const labelAccentStyle: React.CSSProperties = {
  borderLeft: "2px solid var(--brand)",
  paddingLeft: "0.5rem",
  color: "var(--text-secondary)",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const inputBaseStyle: React.CSSProperties = {
  padding: "0.65rem 0.85rem",
  background: "rgba(15, 23, 42, 0.6)",
  border: "1px solid var(--border-soft)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  fontSize: "0.85rem",
  width: "100%",
  transition: "all 0.2s ease",
};

export function WorkflowSetupTab({
  createResult,
  form,
  github,
  isCreatingProject,
  onCreateProject,
  onGenerateWorkflow,
  onViewProject,
  projectCatalog,
  reducedMotion,
}: Readonly<WorkflowSetupTabProps>) {
  const createDisabled =
    isCreatingProject ||
    projectCatalog.loadingProjectOptions ||
    !github.hasAllRepositoriesInstallation ||
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
          <span className="controls-panel-label" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            GitHub App
          </span>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0.35rem 0 0.65rem", lineHeight: 1.5 }}>
            {github.installationStatusCopy}
          </p>
          {github.installationAccounts.length > 0 ? (
            <div style={{ display: "grid", gap: "0.35rem", marginBottom: "0.65rem" }}>
              {github.installationAccounts.map((account) => (
                <div
                  key={account.installationId}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "0.45rem 0.55rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.76rem",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>
                    {account.accountLogin ? `@${account.accountLogin}` : `Installation ${account.installationId}`}
                  </strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}· {account.repositorySelection} repositories
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {github.linkedRepos.length > 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.74rem", margin: "0 0 0.65rem", lineHeight: 1.45 }}>
              Linked repos: {github.linkedRepos.slice(0, 3).map((repo) => repo.repoFullName).join(", ")}
              {github.linkedRepos.length > 3 ? ` +${github.linkedRepos.length - 3} more` : ""}
            </p>
          ) : null}

          {github.installUrl ? (
            <a
              href={github.installUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                width: "100%",
                padding: "0.45rem 0.75rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
                borderRadius: "6px",
                textAlign: "center",
                textDecoration: "none",
                marginBottom: "0.65rem",
                cursor: "pointer",
              }}
            >
              Install GitHub App
            </a>
          ) : (
            <button
              type="button"
              disabled
              style={{
                display: "block",
                width: "100%",
                padding: "0.45rem 0.75rem",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                borderRadius: "6px",
                textAlign: "center",
                cursor: "not-allowed",
                marginBottom: "0.65rem",
              }}
            >
              {github.loadingInstallUrl ? "Loading install link…" : "Install link unavailable"}
            </button>
          )}

          <details>
            <summary style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              cursor: "pointer",
              userSelect: "none",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}>
              <span style={{ fontSize: "0.65rem" }}>&#9654;</span>
              Already installed? Link by ID
            </summary>
            <div style={{ marginTop: "0.65rem" }}>
              <label className="input-label compact-label" htmlFor="installation-id" style={labelAccentStyle}>
                Installation ID
              </label>
              <input
                id="installation-id"
                value={github.installationId}
                onChange={(event) => github.setInstallationId(event.target.value.replaceAll(/\D/g, ""))}
                placeholder="12345678"
                style={inputBaseStyle}
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
          </details>
        </div>

        <hr className="controls-panel-rule" />

        {/* Catalog section */}
        <div className="controls-panel-section">
          <span className="controls-panel-label">Catalog</span>

          <label className="input-label" htmlFor="repo-shape-select" style={labelAccentStyle}>
            Repository shape
          </label>
          <select
            id="repo-shape-select"
            value={projectCatalog.selectedRepoShapeId}
            onChange={(event) => projectCatalog.setSelectedRepoShapeId(event.target.value)}
            disabled={projectCatalog.loadingProjectOptions}
            style={inputBaseStyle}
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

          {!projectCatalog.isMicroservicesShape ? (
            <>
              <label className="input-label" htmlFor="project-type-select" style={{ ...labelAccentStyle, marginTop: "1rem", display: "block" }}>
                Language / framework
              </label>
              <select
                id="project-type-select"
                value={projectCatalog.selectedProjectTypeId}
                onChange={(event) => projectCatalog.setSelectedProjectTypeId(event.target.value)}
                disabled={projectCatalog.loadingProjectOptions}
                style={inputBaseStyle}
              >
                {projectCatalog.projectTypesForShape.map((projectType) => (
                  <option key={projectType.id} value={projectType.id}>
                    {projectType.label}
                  </option>
                ))}
              </select>
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0.3rem 0 0", lineHeight: 1.4 }}>
                TypeScript • JavaScript
              </p>

              <label className="input-label" htmlFor="workflow-recipe-select" style={{ ...labelAccentStyle, marginTop: "1rem", display: "block" }}>
                Workflow recipe
              </label>
              <select
                id="workflow-recipe-select"
                value={projectCatalog.selectedWorkflowRecipeId}
                onChange={(event) => projectCatalog.setSelectedWorkflowRecipeId(event.target.value)}
                disabled={projectCatalog.loadingProjectOptions}
                style={inputBaseStyle}
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
            </>
          ) : (
            <>
              {/* Backend service configurator */}
              <div style={{ marginTop: "0.75rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm, 6px)" }}>
                <span className="controls-panel-label" style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}>
                  BACKEND SERVICE
                </span>
                <label className="input-label" htmlFor="backend-project-type-select" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Language
                </label>
                <select
                  id="backend-project-type-select"
                  value={form.backendProjectTypeId}
                  onChange={(event) => form.setBackendProjectTypeId(event.target.value)}
                  disabled={projectCatalog.loadingProjectOptions}
                  style={inputBaseStyle}
                >
                  {projectCatalog.backendProjectTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>{pt.label}</option>
                  ))}
                  {projectCatalog.backendProjectTypes.length === 0 ? (
                    <option value="nestjs">NestJS</option>
                  ) : null}
                </select>
                <label className="input-label" htmlFor="backend-service-name" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Service name
                </label>
                <input
                  id="backend-service-name"
                  value={form.backendServiceName}
                  onChange={(event) => form.setBackendServiceName(event.target.value)}
                  placeholder={form.repoName ? `${form.repoName}-backend` : "my-app-backend"}
                  style={inputBaseStyle}
                />
                <label className="input-label" htmlFor="backend-service-path" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Service path
                </label>
                <input
                  id="backend-service-path"
                  value={form.backendServicePath}
                  onChange={(event) => form.setBackendServicePath(event.target.value)}
                  placeholder="backend/"
                  style={inputBaseStyle}
                />
              </div>

              {/* Frontend service configurator */}
              <div style={{ marginTop: "0.65rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm, 6px)" }}>
                <span className="controls-panel-label" style={{ fontSize: "0.65rem", letterSpacing: "0.08em" }}>
                  FRONTEND SERVICE
                </span>
                <label className="input-label" htmlFor="frontend-project-type-select" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Language
                </label>
                <select
                  id="frontend-project-type-select"
                  value={form.frontendProjectTypeId}
                  onChange={(event) => form.setFrontendProjectTypeId(event.target.value)}
                  disabled={projectCatalog.loadingProjectOptions}
                  style={inputBaseStyle}
                >
                  {projectCatalog.frontendProjectTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>{pt.label}</option>
                  ))}
                  {projectCatalog.frontendProjectTypes.length === 0 ? (
                    <option value="nextjs">Next.js</option>
                  ) : null}
                </select>
                <label className="input-label" htmlFor="frontend-service-name" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Service name
                </label>
                <input
                  id="frontend-service-name"
                  value={form.frontendServiceName}
                  onChange={(event) => form.setFrontendServiceName(event.target.value)}
                  placeholder={form.repoName ? `${form.repoName}-frontend` : "my-app-frontend"}
                  style={inputBaseStyle}
                />
                <label className="input-label" htmlFor="frontend-service-path" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                  Service path
                </label>
                <input
                  id="frontend-service-path"
                  value={form.frontendServicePath}
                  onChange={(event) => form.setFrontendServicePath(event.target.value)}
                  placeholder="frontend/"
                  style={inputBaseStyle}
                />
              </div>
            </>
          )}
        </div>

        <hr className="controls-panel-rule" />

        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: 0 }}>
          Source: <strong style={{ color: "var(--text-secondary)" }}>cicd-workflow</strong>
        </p>
      </aside>

      {/* ── Center: Create Project form ────────────────────────────── */}
      <section className="templates-panel">
        <div className="templates-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Create Project</h2>
            {projectCatalog.selectedProjectType ? (
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "0.2rem 0.65rem",
                borderRadius: "999px",
                background: "rgba(79,142,255,0.12)",
                color: "var(--brand)",
                border: "1px solid rgba(79,142,255,0.25)",
              }}>
                {projectCatalog.selectedProjectType.label}
              </span>
            ) : null}
          </div>
        </div>

        {projectCatalog.loadingProjectOptions ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "0.5rem 0" }}>
            Loading project catalog…
          </p>
        ) : null}

        <div className="generate-form create-project-form">

          {/* Repository name + Visibility — paired row */}
          <div className="form-pair-row" style={{ marginTop: "1.25rem", gap: "1rem" }}>
            <div>
              <label className="input-label" htmlFor="repo-name" style={labelAccentStyle}>
                Repository name
              </label>
              <input
                id="repo-name"
                value={form.repoName}
                onChange={(event) => form.setRepoName(event.target.value)}
                placeholder="my-next-app"
                style={inputBaseStyle}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="repo-visibility" style={labelAccentStyle}>
                Visibility
              </label>
              <select
                id="repo-visibility"
                value={form.visibility}
                onChange={(event) => form.setVisibility(event.target.value as "private" | "public")}
                style={inputBaseStyle}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          {/* Service name + Service path — single-service mode only */}
          {!projectCatalog.isMicroservicesShape ? (
            <div className="form-pair-row" style={{ marginTop: "1.25rem", gap: "1rem" }}>
              <div>
                <label className="input-label" htmlFor="service-name" style={labelAccentStyle}>
                  Service name
                </label>
                <input
                  id="service-name"
                  value={form.serviceName}
                  onChange={(event) => form.setServiceName(event.target.value)}
                  placeholder="my-next-app"
                  style={inputBaseStyle}
                />
              </div>
              <div>
                <label className="input-label" htmlFor="service-path" style={labelAccentStyle}>
                  Service path
                </label>
                <input
                  id="service-path"
                  value={form.servicePath}
                  onChange={(event) => form.setServicePath(event.target.value)}
                  placeholder="."
                  style={inputBaseStyle}
                />
              </div>
            </div>
          ) : null}

          {/* Workflow file name — full width */}
          <div style={{ marginTop: "1.25rem" }}>
            <label className="input-label" htmlFor="output-file-name" style={labelAccentStyle}>
              Workflow file name
            </label>
            <input
              id="output-file-name"
              value={form.outputFileName}
              onChange={(event) => form.setOutputFileName(event.target.value)}
              placeholder="ci.yml"
              style={{ ...inputBaseStyle, width: "100%" }}
            />
          </div>

          {/* Node version + Coverage — paired row */}
          <div className="form-pair-row" style={{ marginTop: "1.25rem", gap: "1rem" }}>
            <div>
              <label className="input-label" htmlFor="node-version" style={labelAccentStyle}>
                Node version
              </label>
              <input
                id="node-version"
                value={form.nodeVersion}
                onChange={(event) => form.setNodeVersion(event.target.value)}
                placeholder="24"
                style={inputBaseStyle}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="coverage-threshold" style={labelAccentStyle}>
                Coverage %
              </label>
              <input
                id="coverage-threshold"
                value={form.coverageThreshold}
                onChange={(event) => form.setCoverageThreshold(event.target.value)}
                placeholder="80"
                style={inputBaseStyle}
              />
            </div>
          </div>

          {/* Enhancement chips */}
          <div style={{ marginTop: "1.5rem" }}>
            <span
              className="input-label"
              style={{ ...labelAccentStyle, marginTop: 0, marginBottom: "0.5rem", display: "block" }}
            >
              Workflow checks
            </span>
            <div
              style={{
                background: "var(--bg-panel)",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              <div className="enhancement-chips" aria-label="Workflow checks" role="group" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
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
          </div>

          <button
            type="button"
            className="primary-button create-repo-btn"
            data-testid="setup-project-button"
            disabled={createDisabled}
            onClick={() => void onCreateProject()}
            style={{ marginTop: "1.75rem" }}
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

          <div className="generate-workflow-row" style={{ marginTop: "0.85rem" }}>
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
      />
    </motion.section>
  );
}
