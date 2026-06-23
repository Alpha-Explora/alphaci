"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type {
  CreateProjectResult,
  DiscoverExistingRepoResponse,
  MvpProjectOptionKey,
  SetupExistingRepoPrResponse,
  UsageLimitItem,
} from "@/lib/api/contracts";
import { getMyUsage } from "@/lib/api/client";
import { useCapabilities } from "@/hooks/use-capabilities";
import type { CreateProjectFormState } from "@/hooks/use-create-project-form";
import type { DeploymentProvisioningFormState } from "@/hooks/use-deployment-provisioning-form";
import type { GithubInstallationsState } from "@/hooks/use-github-installations";
import {
  projectOptionLabels,
  type ProjectOptionsCatalogState,
} from "@/hooks/use-project-options-catalog";

import { SetupResultPanel } from "./setup-result-panel";
import { DeploymentProvisioningSetup } from "./deployment-provisioning-setup";
import { formatQuotaStatus } from "./workflow-builder-utils";
import { HelpTip } from "./help-tip";

interface WorkflowSetupTabProps {
  createResult: CreateProjectResult | null;
  existingRepoBaseBranch: string;
  existingRepoDiscovery: DiscoverExistingRepoResponse | null;
  existingRepoFullName: string;
  existingRepoResult: SetupExistingRepoPrResponse | null;
  deploymentProvisioning: DeploymentProvisioningFormState;
  form: CreateProjectFormState;
  github: GithubInstallationsState;
  isCreatingProject: boolean;
  isDiscoveringExistingRepo: boolean;
  isSettingUpExistingRepo: boolean;
  setupMode: "new" | "existing";
  onChangeExistingRepoBaseBranch: (value: string) => void;
  onChangeExistingRepoFullName: (value: string) => void;
  onChangeSetupMode: (value: "new" | "existing") => void;
  onCreateProject: () => void;
  onDiscoverExistingRepo: () => void;
  onGenerateWorkflow: () => void;
  onSetupExistingRepoPullRequest: () => void;
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

const labelAccentStyle: React.CSSProperties = {
  borderLeft: "2px solid var(--brand)",
  paddingLeft: "0.5rem",
  color: "var(--text-secondary)",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function inferProjectKind(
  selectedProjectType: ProjectOptionsCatalogState["selectedProjectType"],
): "frontend" | "backend" | undefined {
  if (selectedProjectType?.kind) {
    return selectedProjectType.kind;
  }

  const text = [
    selectedProjectType?.id,
    selectedProjectType?.label,
    selectedProjectType?.framework,
    selectedProjectType?.runtime,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(next|react|frontend|web|vue|svelte)/.test(text)) {
    return "frontend";
  }
  if (/(nest|node|api|backend|server)/.test(text)) {
    return "backend";
  }
  return undefined;
}

function withTestSuffix(value: string) {
  const base = value.trim() || "flowci-project";
  return base.endsWith("-test") ? base : `${base}-test`;
}

export function WorkflowSetupTab({
  createResult,
  existingRepoBaseBranch,
  existingRepoDiscovery,
  existingRepoFullName,
  existingRepoResult,
  deploymentProvisioning,
  form,
  github,
  isCreatingProject,
  isDiscoveringExistingRepo,
  isSettingUpExistingRepo,
  setupMode,
  onChangeExistingRepoBaseBranch,
  onChangeExistingRepoFullName,
  onChangeSetupMode,
  onCreateProject,
  onDiscoverExistingRepo,
  onGenerateWorkflow,
  onSetupExistingRepoPullRequest,
  onViewProject,
  projectCatalog,
  reducedMotion,
}: Readonly<WorkflowSetupTabProps>) {
  const { envProvisioningEnabled } = useCapabilities();
  const [usageItems, setUsageItems] = useState<UsageLimitItem[]>([]);
  const isExistingMode = setupMode === "existing";
  const selectedProjectKind = inferProjectKind(projectCatalog.selectedProjectType);
  const projectQuota = useMemo(
    () => usageItems.find((item) => item.code === "projects") ?? null,
    [usageItems],
  );
  const projectQuotaReached = Boolean(
    projectQuota &&
      projectQuota.limit > 0 &&
      projectQuota.current >= projectQuota.limit,
  );

  const createDisabled =
    isCreatingProject ||
    projectQuotaReached ||
    projectCatalog.loadingProjectOptions ||
    !form.repoName.trim() ||
    (github.selectedOwnerType === "organization" && !github.selectedInstallationId) ||
    (!projectCatalog.isMicroservicesShape && !projectCatalog.isMultiRepoShape && !projectCatalog.selectedProjectType);

  const generateDisabled =
    isCreatingProject ||
    isDiscoveringExistingRepo ||
    isSettingUpExistingRepo ||
    projectCatalog.loadingProjectOptions ||
    !projectCatalog.selectedProjectType ||
    !(form.serviceName || form.repoName);

  const existingDiscoverDisabled =
    isDiscoveringExistingRepo ||
    isSettingUpExistingRepo ||
    projectCatalog.loadingProjectOptions ||
    !existingRepoFullName.trim();

  const existingSetupDisabled =
    isDiscoveringExistingRepo ||
    isSettingUpExistingRepo ||
    projectCatalog.loadingProjectOptions ||
    !existingRepoFullName.trim() ||
    !projectCatalog.selectedProjectType;

  const noLinkedRepos =
    isExistingMode &&
    github.linkedReposLoaded &&
    !github.loadingLinkedRepos &&
    github.linkedRepos.length === 0;

  useEffect(() => {
    let cancelled = false;
    void getMyUsage()
      .then((usage) => {
        if (!cancelled && usage.enabled) {
          setUsageItems(usage.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsageItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleDeploymentProvisioningEnabled(enabled: boolean) {
    if (!enabled) {
      deploymentProvisioning.setEnabled(false);
      return;
    }

    if (projectCatalog.isMicroservicesShape || projectCatalog.isMultiRepoShape) {
      deploymentProvisioning.setDefaultTargets([
        { slot: "backend", projectName: withTestSuffix(form.backendServiceName || `${form.repoName}-backend`) },
        { slot: "frontend", projectName: withTestSuffix(form.frontendServiceName || `${form.repoName}-frontend`) },
      ]);
      return;
    }

    const slot = selectedProjectKind === "frontend" ? "frontend" : selectedProjectKind === "backend" ? "backend" : "standalone";
    deploymentProvisioning.setDefaultTarget(slot, withTestSuffix(form.serviceName || form.repoName));
  }

  return (
    <motion.section
      className="create-project-layout"
      id="workflow-panel-setup"
      role="tabpanel"
      aria-labelledby="workflow-tab-setup"
      tabIndex={0}
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* ── Left sidebar: GitHub App + Catalog ──────────────────────── */}
      <aside className="create-project-sidebar">

        {/* GitHub App */}
        <div>
          <span className="cp-section-heading">GitHub App</span>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: "0 0 0.75rem", lineHeight: 1.5 }}>
            {github.installationStatusCopy}
          </p>

          {github.installationAccounts.length > 0 ? (
            <div style={{ display: "grid", gap: "0.35rem", marginBottom: "0.65rem" }}>
              {github.installationAccounts.map((account) => (
                <div
                  key={account.installationId}
                  style={{
                    borderLeft: "2px solid var(--border-brand)",
                    paddingLeft: "0.6rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.76rem",
                  }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>
                    {account.accountLogin ? `@${account.accountLogin}` : `Installation ${account.installationId}`}
                  </strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}· {account.repositorySelection} repos
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {github.linkedRepos.length > 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.74rem", margin: "0 0 0.65rem", lineHeight: 1.45 }}>
              {github.linkedRepos.slice(0, 3).map((r) => r.repoFullName).join(", ")}
              {github.linkedRepos.length > 3 ? ` +${github.linkedRepos.length - 3} more` : ""}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void github.handleInstallApp()}
            disabled={github.loadingInstallUrl}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              width: "100%",
              padding: "0.5rem 0.85rem",
              border: github.installUrl ? "1px solid var(--border-strong)" : "1px solid rgba(14, 165, 233, 0.45)",
              background: github.installUrl ? "transparent" : "rgba(14, 165, 233, 0.08)",
              color: github.installUrl ? "var(--text-secondary)" : "var(--brand)",
              fontSize: "0.82rem",
              borderRadius: "6px",
              textDecoration: "none",
              marginBottom: "0.65rem",
              fontWeight: 600,
              transition: "border-color 0.15s, color 0.15s, background 0.15s",
              cursor: github.loadingInstallUrl ? "wait" : "pointer",
            }}
          >
            {github.loadingInstallUrl
              ? "Refreshing install link…"
              : github.installUrl
                ? "Install GitHub App"
                : "Retry install link"}
          </button>

          {github.appSlug ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0 0 0.65rem" }}>
              Backend GitHub App: <strong>@{github.appSlug}</strong>
            </p>
          ) : null}

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
                className="premium-input"
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

        <hr className="controls-panel-rule" style={{ margin: "1.25rem 0" }} />

        {/* Catalog */}
        <div>
          <span className="cp-section-heading">Catalog</span>

          <fieldset data-tour="repo-shape" style={{ border: "none", margin: 0, padding: 0, minInlineSize: "auto" }}>
            <legend className="input-label" style={{ ...labelAccentStyle, padding: 0 }}>
              Repository shape
            </legend>
            <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.35rem" }}>
              {projectCatalog.allRepoShapes.map((shape) => {
                const selected = shape.id === projectCatalog.selectedRepoShapeId;
                const disabled = !shape.enabled || projectCatalog.loadingProjectOptions;
                return (
                  <label
                    key={shape.id}
                    style={{
                      position: "relative",
                      display: "block",
                      padding: "0.6rem 0.75rem",
                      border: `1px solid ${selected ? "var(--border-brand)" : "var(--border)"}`,
                      borderRadius: "8px",
                      background: selected ? "color-mix(in srgb, var(--border-brand) 8%, transparent)" : "transparent",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: shape.enabled ? 1 : 0.55,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="repo-shape"
                      value={shape.id}
                      checked={selected}
                      disabled={disabled}
                      onChange={() => projectCatalog.setSelectedRepoShapeId(shape.id)}
                      style={{ position: "absolute", opacity: 0, inset: 0, margin: 0, cursor: "inherit" }}
                    />
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: "0.82rem" }}>{shape.label}</strong>
                      {shape.id === "standalone" ? (
                        <span style={{
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--border-brand)",
                          border: "1px solid var(--border-brand)",
                          borderRadius: "999px",
                          padding: "0.08rem 0.45rem",
                        }}>
                          Recommended
                        </span>
                      ) : null}
                      {!shape.enabled ? (
                        <span style={{
                          fontSize: "0.58rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                          borderRadius: "999px",
                          padding: "0.08rem 0.45rem",
                        }}>
                          Coming soon
                        </span>
                      ) : null}
                    </span>
                    {shape.description ? (
                      <span style={{
                        display: "block",
                        color: "var(--text-muted)",
                        fontSize: "0.72rem",
                        lineHeight: 1.45,
                        marginTop: "0.25rem",
                      }}>
                        {shape.description}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {!projectCatalog.isMicroservicesShape && !projectCatalog.isMultiRepoShape ? (
            <>
              <label className="input-label" htmlFor="project-type-select" style={{ ...labelAccentStyle, marginTop: "1rem", display: "block" }}>
                Language / framework
              </label>
              <select
                id="project-type-select"
                value={projectCatalog.selectedProjectTypeId}
                onChange={(event) => projectCatalog.setSelectedProjectTypeId(event.target.value)}
                disabled={projectCatalog.loadingProjectOptions}
                className="premium-input"
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
                className="premium-input"
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
              {projectCatalog.isMultiRepoShape && form.repoName ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.5rem 0 0.75rem", lineHeight: 1.5 }}>
                  {`2 separate repos will be created: ${form.repoName}-be and ${form.repoName}-fe`}
                </p>
              ) : null}

              {/* Backend service — no container box */}
              <div style={{ marginTop: "1rem" }}>
                <span className="cp-section-heading" style={{ fontSize: "0.6rem" }}>Backend service</span>
                <label className="input-label" htmlFor="backend-project-type-select" style={{ ...labelAccentStyle, display: "block" }}>
                  Language
                </label>
                <select
                  id="backend-project-type-select"
                  value={form.backendProjectTypeId}
                  onChange={(event) => form.setBackendProjectTypeId(event.target.value)}
                  disabled={projectCatalog.loadingProjectOptions}
                  className="premium-input"
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
                  className="premium-input"
                />
                {projectCatalog.isMicroservicesShape ? (
                  <>
                    <label className="input-label" htmlFor="backend-service-path" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                      Service path
                      <HelpTip text="The folder inside the repository where the backend service's code lives. Build commands run from this path, and only changes under it trigger this service's pipeline." />
                    </label>
                    <input
                      id="backend-service-path"
                      value={form.backendServicePath}
                      onChange={(event) => form.setBackendServicePath(event.target.value)}
                      placeholder="backend/"
                      className="premium-input"
                    />
                  </>
                ) : null}
              </div>

              {/* Frontend service — no container box */}
              <div style={{ marginTop: "1.25rem" }}>
                <span className="cp-section-heading" style={{ fontSize: "0.6rem" }}>Frontend service</span>
                <label className="input-label" htmlFor="frontend-project-type-select" style={{ ...labelAccentStyle, display: "block" }}>
                  Language
                </label>
                <select
                  id="frontend-project-type-select"
                  value={form.frontendProjectTypeId}
                  onChange={(event) => form.setFrontendProjectTypeId(event.target.value)}
                  disabled={projectCatalog.loadingProjectOptions}
                  className="premium-input"
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
                  className="premium-input"
                />
                {projectCatalog.isMicroservicesShape ? (
                  <>
                    <label className="input-label" htmlFor="frontend-service-path" style={{ ...labelAccentStyle, marginTop: "0.55rem", display: "block" }}>
                      Service path
                      <HelpTip text="The folder inside the repository where the frontend service's code lives. Build commands run from this path, and only changes under it trigger this service's pipeline." />
                    </label>
                    <input
                      id="frontend-service-path"
                      value={form.frontendServicePath}
                      onChange={(event) => form.setFrontendServicePath(event.target.value)}
                      placeholder="frontend/"
                      className="premium-input"
                    />
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "1.5rem 0 0" }}>
          Source: <strong style={{ color: "var(--text-secondary)" }}>cicd-workflow</strong>
        </p>
      </aside>

      {/* ── Right: form + inline result ─────────────────────────────── */}
      <div className="create-project-main">

        {/* Title + project type badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
            {isExistingMode ? "Add CI/CD to Existing Repo" : "Create Project"}
          </h2>
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

        {projectCatalog.loadingProjectOptions ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "0 0 1rem" }}>
            Loading project catalog…
          </p>
        ) : null}

        {/* Mode toggle — segmented control, no container box */}
        <div role="group" aria-label="Setup mode" className="cp-mode-toggle">
          {(["new", "existing"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="cp-mode-btn"
              aria-pressed={setupMode === mode}
              onClick={() => onChangeSetupMode(mode)}
            >
              {mode === "new" ? "New repository" : "Existing repository"}
            </button>
          ))}
        </div>

        {/* ── Existing repo mode ── */}
        <AnimatePresence mode="wait">
          {isExistingMode ? (
            <motion.div
              key="existing-mode"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ display: "grid", gap: "1rem" }}
            >
              {noLinkedRepos ? (
                <div className="readiness-empty-state" role="status">
                  <strong>No linked GitHub repositories</strong>
                  <p>
                    Install or link the GitHub App, then retry this mode. You can still switch back to new repository creation.
                  </p>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void github.loadLinkedRepos()}
                  >
                    Retry repos
                  </button>
                </div>
              ) : null}

              <div className="form-pair-row" style={{ gap: "1rem" }}>
                <div>
                  <label className="input-label" htmlFor="existing-repo-select" style={labelAccentStyle}>
                    Linked repository
                  </label>
                  <select
                    id="existing-repo-select"
                    value={existingRepoFullName}
                    onChange={(event) => onChangeExistingRepoFullName(event.target.value)}
                    disabled={github.loadingLinkedRepos}
                    className="premium-input"
                  >
                    <option value="">
                      {github.loadingLinkedRepos ? "Loading linked repos..." : "Choose a repository"}
                    </option>
                    {github.linkedRepos.map((repo) => (
                      <option key={`${repo.installationId}-${repo.repoFullName}`} value={repo.repoFullName}>
                        {repo.repoFullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label" htmlFor="existing-base-branch" style={labelAccentStyle}>
                    Base branch
                  </label>
                  <input
                    id="existing-base-branch"
                    value={existingRepoBaseBranch}
                    onChange={(event) => onChangeExistingRepoBaseBranch(event.target.value)}
                    placeholder="main"
                    className="premium-input"
                  />
                </div>
              </div>

              <p className="helper-text" id="existing-repo-disabled-help" style={{ margin: 0, fontSize: "0.82rem" }}>
                Scan the repository to detect its project type, then open a setup PR to add CI/CD workflows.
              </p>

              {/* Action buttons — flat row, no container box */}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ghost-button"
                  style={{ fontSize: "0.875rem", minHeight: "2.6rem", padding: "0.6rem 1.25rem" }}
                  disabled={existingDiscoverDisabled}
                  aria-describedby="existing-repo-disabled-help"
                  onClick={() => void onDiscoverExistingRepo()}
                >
                  {isDiscoveringExistingRepo ? "Scanning..." : "Discover repo"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  style={{ flex: "1", fontSize: "0.875rem", minHeight: "2.6rem", padding: "0.6rem 1.25rem" }}
                  disabled={existingSetupDisabled}
                  aria-describedby="existing-repo-disabled-help"
                  onClick={() => void onSetupExistingRepoPullRequest()}
                >
                  {isSettingUpExistingRepo ? "Opening PR..." : "Open setup PR"}
                </button>
              </div>

              {existingRepoDiscovery ? (
                <div className="result-branches">
                  <span className="branch-chip">{existingRepoDiscovery.baseBranch}</span>
                  <span className="branch-chip">
                    {existingRepoDiscovery.detectedProjectTypeId ?? "manual"}
                  </span>
                  <span className="branch-chip">{existingRepoDiscovery.recommendedWorkflowRecipeId}</span>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── New repo mode ── */}
        <AnimatePresence mode="wait" initial={false}>
          {!isExistingMode && (
            <motion.div
              key="new-repo-fields"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <label className="input-label" htmlFor="repository-owner" style={labelAccentStyle}>
                Repository owner
              </label>
              <select
                id="repository-owner"
                className="premium-input"
                value={github.selectedOwner}
                onChange={(event) => github.setSelectedOwner(event.target.value)}
              >
                <option value="personal">My personal GitHub account</option>
                {github.installationAccounts
                  .filter(
                    (account) =>
                      account.accountType === "Organization" &&
                      account.repositorySelection === "all" &&
                      account.accountLogin,
                  )
                  .map((account) => (
                    <option
                      key={account.installationId}
                      value={`organization:${account.installationId}`}
                    >
                      {account.accountLogin} organization
                    </option>
                  ))}
              </select>
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", margin: "0.3rem 0 0.9rem", lineHeight: 1.4 }}>
                Organization destinations require this environment&apos;s GitHub App with all-repositories access.
              </p>

              {/* Repository name + Visibility */}
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
                    className="premium-input"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              {/* Service name + path — single-service mode only */}
              {!projectCatalog.isMicroservicesShape && !projectCatalog.isMultiRepoShape ? (
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
              ) : null}

              {/* Workflow file name */}
              <div style={{ marginTop: "1.5rem" }}>
                <label className="input-label" htmlFor="output-file-name" style={labelAccentStyle}>
                  Workflow file name
                </label>
                <input
                  id="output-file-name"
                  value={form.outputFileName}
                  onChange={(event) => form.setOutputFileName(event.target.value)}
                  placeholder="ci.yml"
                  className="premium-input"
                />
              </div>

              {/* Node version + Coverage */}
              <div className="form-pair-row" style={{ marginTop: "1.5rem", gap: "1rem" }}>
                <div>
                  <label className="input-label" htmlFor="node-version" style={labelAccentStyle}>
                    Node version
                  </label>
                  <select
                    id="node-version"
                    value={form.nodeVersion}
                    onChange={(event) => form.setNodeVersion(event.target.value)}
                    className="premium-input"
                  >
                    {projectCatalog.nodeVersions.length > 0
                      ? projectCatalog.nodeVersions.map((v) => (
                          <option key={v.value} value={v.value}>{v.label}</option>
                        ))
                      : (
                        <>
                          <option value="20">Node 20 LTS (Iron)</option>
                          <option value="22">Node 22 LTS (Jod)</option>
                          <option value="24">Node 24 LTS (Noble)</option>
                        </>
                      )
                    }
                  </select>
                </div>
                <div>
                  <label className="input-label" htmlFor="coverage-threshold" style={labelAccentStyle}>
                    Coverage
                    <HelpTip text="The minimum percentage of code that unit tests must exercise. Pipeline runs fail the Quality stage if coverage drops below this number." />
                  </label>
                  <select
                    id="coverage-threshold"
                    value={form.coverageThreshold}
                    onChange={(event) => form.setCoverageThreshold(event.target.value)}
                    className="premium-input"
                  >
                    <option value="0">None (0%)</option>
                    <option value="60">Basic (60%)</option>
                    <option value="80">Standard (80%)</option>
                    <option value="90">Strict (90%)</option>
                    <option value="100">Full (100%)</option>
                  </select>
                </div>
              </div>

              {/* Workflow checks — chips without container box */}
              <div style={{ marginTop: "1.5rem" }}>
                <span
                  className="input-label"
                  style={{ ...labelAccentStyle, marginTop: 0, marginBottom: "0.6rem", display: "block" }}
                >
                  Workflow checks
                </span>
                <div data-tour="test-toggles" className="enhancement-chips" aria-label="Workflow checks" role="group" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {projectCatalog.supportedTestOptions.map((option) => (
                    <motion.label
                      key={option.key}
                      className={`enhancement-chip-label-premium${option.supported ? "" : " disabled"}${option.checked ? " enhancement-chip-label--active" : ""}`}
                      htmlFor={`chip-${option.key}`}
                      title={projectOptionDescriptions[option.key]}
                      aria-label={`${projectOptionLabels[option.key]} — ${projectOptionDescriptions[option.key]}`}
                      style={option.supported ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                      whileTap={option.supported ? { scale: 0.95 } : undefined}
                      animate={option.checked ? { scale: 1 } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
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
                    </motion.label>
                  ))}
                </div>
              </div>

              {envProvisioningEnabled ? (
                <div style={{ marginTop: "1.5rem" }}>
                  <DeploymentProvisioningSetup
                    enabled={deploymentProvisioning.enabled}
                    repoShape={projectCatalog.selectedRepoShapeId}
                    selectedProjectKind={selectedProjectKind}
                    value={deploymentProvisioning.request}
                    onChange={deploymentProvisioning.setRequest}
                    onEnabledChange={handleDeploymentProvisioningEnabled}
                  />
                </div>
              ) : null}

              {projectQuota ? (
                <div className="env-empty-state" role="status" style={{ marginTop: "1.25rem" }}>
                  Project quota: {formatQuotaStatus(projectQuota)}
                </div>
              ) : null}

              {/* Primary CTA */}
              <button
                type="button"
                className="primary-button create-repo-btn-premium"
                data-testid="setup-project-button"
                disabled={createDisabled}
                onClick={() => void onCreateProject()}
                style={{ marginTop: "2rem" }}
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate YAML only — tertiary, always visible */}
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <button
            type="button"
            className="generate-yaml-link"
            data-testid="generate-workflow-button"
            disabled={generateDisabled}
            onClick={() => void onGenerateWorkflow()}
            title="Generate workflow YAML only — no GitHub repo created"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            {isCreatingProject ? "Generating…" : "Generate YAML only"}
          </button>
          <span className="generate-workflow-hint">No repo — just the workflow file</span>
        </div>

        {/* Inline result — appears below the form after creation */}
        {(createResult ?? existingRepoResult) ? (
          <div className="cp-inline-result">
            <SetupResultPanel
              existingRepoResult={existingRepoResult}
              setupResult={createResult}
              onViewProject={onViewProject}
            />
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
