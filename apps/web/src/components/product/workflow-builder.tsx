"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";

import {
  getCategories,
  getGithubAppInstallUrl,
  getLinkedGithubRepos,
  getProjects,
  getWorkflowHistory,
  getTemplates,
  linkGithubInstallation,
  setupProject,
  type ApiError,
} from "@/lib/api/client";
import type {
  CatalogTemplate,
  CategorySummary,
  LinkedGitHubRepo,
  ProvisionedProject,
  SetupProjectRequest,
  SetupProjectResponse,
  WorkflowHistoryItem,
} from "@/lib/api/contracts";

import { TemplateCard } from "./template-card";

interface WorkflowBuilderProps {
  login: string;
  plan: string;
}

type WorkflowTab = "setup" | "current" | "all";

const WORKFLOW_TABS: WorkflowTab[] = ["setup", "current", "all"];

const enhancementLabels: Array<{
  key: NonNullable<SetupProjectRequest["enhancements"]>[number];
  label: string;
  description: string;
}> = [
  {
    key: "strictProductionApproval",
    label: "Strict production approval",
    description: "Require multi-step production approvals before release",
  },
  {
    key: "enableUatApproval",
    label: "Enable UAT approval",
    description: "Add dedicated QA/UAT gates before production",
  },
  {
    key: "disablePlaywright",
    label: "Disable Playwright",
    description: "Skip browser E2E checks in generated workflow",
  },
  {
    key: "disableK6",
    label: "Disable k6",
    description: "Disable synthetic load smoke tests",
  },
];

function statusBannerVariant(message: string): "error" | "success" | "info" {
  const lower = message.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) return "error";
  if (
    lower.includes("generat") ||
    lower.includes("copied") ||
    lower.includes("download") ||
    lower.includes("completed") ||
    lower.includes("linked")
  ) return "success";
  return "info";
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .trim()
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-");
}

function toSourcePath(path: string): string {
  if (!path) {
    return "cicd-workflow/workflow-templates";
  }

  const normalized = path.replaceAll("\\", "/");
  const repoMarker = "/cicd-workflow/";
  const repoIndex = normalized.toLowerCase().lastIndexOf(repoMarker);

  if (repoIndex >= 0) {
    return normalized.slice(repoIndex + 1);
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (trimmed.startsWith("cicd-workflow/")) {
    return trimmed;
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return normalized;
  }

  return `cicd-workflow/${trimmed}`;
}

function chooseSelectedTemplate(
  templates: CatalogTemplate[],
  current: CatalogTemplate | null,
): CatalogTemplate | null {
  if (templates.length === 0) {
    return null;
  }

  if (current) {
    const exists = templates.some((template) => template.id === current.id);
    if (exists) {
      return current;
    }
  }

  return templates[0];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatApiError(error: unknown, fallback: string): string {
  const details = (error as ApiError)?.details;

  if (!details) {
    return fallback;
  }

  if (typeof details === "string") {
    return `${fallback}: ${details}`;
  }

  if (typeof details === "object" && details !== null && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return `${fallback}: ${message.join(", ")}`;
    }

    if (typeof message === "string") {
      return `${fallback}: ${message}`;
    }
  }

  return `${fallback}: ${JSON.stringify(details)}`;
}

export function WorkflowBuilder({ login, plan }: Readonly<WorkflowBuilderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = prefersReducedMotion ?? false;

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [allTemplates, setAllTemplates] = useState<CatalogTemplate[]>([]);
  const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
  const [projects, setProjects] = useState<ProvisionedProject[]>([]);

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkflowTab>("setup");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStack, setSelectedStack] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);

  const [serviceName, setServiceName] = useState("cicd-service");
  const [servicePath, setServicePath] = useState("");
  const [nodeVersion, setNodeVersion] = useState("24");
  const [coverageThreshold, setCoverageThreshold] = useState("80");
  const [outputFileName, setOutputFileName] = useState("");
  const [enhancements, setEnhancements] = useState<NonNullable<SetupProjectRequest["enhancements"]>>([]);

  const [linkedRepos, setLinkedRepos] = useState<LinkedGitHubRepo[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [loadingLinkedRepos, setLoadingLinkedRepos] = useState(false);
  const [linkedReposLoaded, setLinkedReposLoaded] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [loadingInstallUrl, setLoadingInstallUrl] = useState(false);
  const [installationId, setInstallationId] = useState("");
  const [linkingInstallation, setLinkingInstallation] = useState(false);

  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupProjectResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadLinkedRepos = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingLinkedRepos(true);
    }

    try {
      const response = await getLinkedGithubRepos();
      setLinkedRepos(response.repos);
      setLinkedReposLoaded(true);
    } catch {
      if (!silent) {
        setStatusMessage("Could not load linked GitHub App repos.");
      }
    } finally {
      if (!silent) {
        setLoadingLinkedRepos(false);
      }
    }
  }, []);

  function handleRepoSelect(event: React.ChangeEvent<HTMLSelectElement>) {
    const repoName = event.target.value;
    setSelectedRepoFullName(repoName);

    if (repoName && (!serviceName || serviceName === "cicd-service")) {
      setServiceName(toSlug(repoName.split("/").pop() ?? repoName));
    }
  }

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingHistory(true);
    }

    try {
      const response = await getWorkflowHistory(25);
      setHistory(response.items);
    } catch {
      if (!silent) {
        setStatusMessage("Workflow history is temporarily unavailable.");
      }
    } finally {
      if (!silent) {
        setLoadingHistory(false);
      }
    }
  }, []);

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingProjects(true);
    }

    try {
      const response = await getProjects(25);
      setProjects(response.items);
    } catch {
      if (!silent) {
        setStatusMessage("Provisioned project history is temporarily unavailable.");
      }
    } finally {
      if (!silent) {
        setLoadingProjects(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadLinkedRepos();
  }, [loadLinkedRepos]);

  useEffect(() => {
    let active = true;

    async function loadInstallUrl() {
      setLoadingInstallUrl(true);
      try {
        const response = await getGithubAppInstallUrl();
        if (active) {
          setInstallUrl(response.installUrl);
        }
      } catch {
        if (active) {
          setInstallUrl(null);
        }
      } finally {
        if (active) {
          setLoadingInstallUrl(false);
        }
      }
    }

    void loadInstallUrl();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setLoadingCatalog(true);
      setCatalogError(null);

      try {
        const [categoriesResponse, templatesResponse] = await Promise.all([
          getCategories(),
          getTemplates({}),
        ]);

        if (!active) {
          return;
        }

        setCategories(categoriesResponse.categories);
        setAllTemplates(templatesResponse.templates);
      } catch {
        if (!active) {
          return;
        }

        setCatalogError("Unable to load workflow templates from cicd-workflow right now.");
        setCategories([]);
        setAllTemplates([]);
      } finally {
        if (active) {
          setLoadingCatalog(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  const fallbackCategories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const template of allTemplates) {
      for (const category of template.categories) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [allTemplates]);

  const availableCategories = categories.length > 0 ? categories : fallbackCategories;

  const filteredTemplates = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();

    return allTemplates.filter((template) => {
      if (selectedCategory !== "All" && !template.categories.includes(selectedCategory)) {
        return false;
      }

      if (selectedStack !== "all" && template.stack !== selectedStack) {
        return false;
      }

      if (!lowerQuery) {
        return true;
      }

      return (
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.categories.some((category) => category.toLowerCase().includes(lowerQuery))
      );
    });
  }, [allTemplates, searchQuery, selectedCategory, selectedStack]);

  useEffect(() => {
    setSelectedTemplate((current) => chooseSelectedTemplate(filteredTemplates, current));
  }, [filteredTemplates]);

  function handleTemplateSelection(template: CatalogTemplate) {
    setSelectedTemplate(template);
    setStatusMessage(`Selected template: ${template.name}`);
  }

  function toggleEnhancement(key: NonNullable<SetupProjectRequest["enhancements"]>[number]) {
    setEnhancements((current) => {
      if (current.includes(key)) {
        return current.filter((value) => value !== key);
      }

      return [...current, key];
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: WorkflowTab) {
    const currentIndex = WORKFLOW_TABS.indexOf(currentTab);
    let nextTab: WorkflowTab | null = null;

    if (event.key === "ArrowRight") {
      nextTab = WORKFLOW_TABS[(currentIndex + 1) % WORKFLOW_TABS.length];
    } else if (event.key === "ArrowLeft") {
      nextTab = WORKFLOW_TABS[(currentIndex - 1 + WORKFLOW_TABS.length) % WORKFLOW_TABS.length];
    } else if (event.key === "Home") {
      nextTab = WORKFLOW_TABS[0];
    } else if (event.key === "End") {
      nextTab = WORKFLOW_TABS.at(-1) ?? "all";
    }

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveTab(nextTab);

    const nextElement = document.getElementById(`workflow-tab-${nextTab}`);
    if (nextElement instanceof HTMLButtonElement) {
      nextElement.focus();
    }
  }

  async function handleLinkInstallation() {
    const parsedInstallationId = Number(installationId);
    if (!Number.isInteger(parsedInstallationId) || parsedInstallationId < 1) {
      setStatusMessage("Enter a valid GitHub App installation id.");
      return;
    }

    setLinkingInstallation(true);
    setStatusMessage("Linking GitHub App installation...");

    try {
      const response = await linkGithubInstallation(parsedInstallationId);
      await loadLinkedRepos(true);
      setStatusMessage(`Linked ${response.reposLinked} GitHub repo${response.reposLinked === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatusMessage(formatApiError(error, "GitHub App installation link failed"));
    } finally {
      setLinkingInstallation(false);
    }
  }

  async function handleSetupProject() {
    if (!selectedTemplate) {
      setStatusMessage("Please select a template first.");
      return;
    }

    if (!selectedRepoFullName) {
      setStatusMessage("Select a linked GitHub App repo first.");
      return;
    }

    if (!serviceName.trim()) {
      setStatusMessage("Service name is required.");
      return;
    }

    const coverage = Number(coverageThreshold);
    if (Number.isNaN(coverage) || coverage < 0 || coverage > 100) {
      setStatusMessage("Coverage threshold must be between 0 and 100.");
      return;
    }

    setIsSettingUp(true);
    setStatusMessage("Setting up GitHub repo with CI_TOKEN and workflow file...");

    try {
      const normalizedService = toSlug(serviceName);
      const payload: SetupProjectRequest = {
        repoFullName: selectedRepoFullName,
        templateId: selectedTemplate.id,
        serviceName: normalizedService,
        servicePath: servicePath || undefined,
        nodeVersion: nodeVersion || undefined,
        coverageThreshold: coverage,
        enhancements: enhancements.length ? enhancements : undefined,
        outputFileName: outputFileName || undefined,
      };

      const response = await setupProject(payload);
      setSetupResult(response);
      await Promise.all([loadProjects(true), loadHistory(true)]);
      setProjects((current) => [
        {
          id: response.id,
          repoFullName: response.repoFullName,
          templateId: payload.templateId,
          serviceName: payload.serviceName,
          workflowPath: response.workflowPath,
          status: response.status,
          githubCommitSha: response.githubCommitSha,
          githubCommitUrl: response.githubCommitUrl,
          failureReason: null,
        },
        ...current.filter((project) => project.id !== response.id),
      ]);
      setActiveTab("current");
      setStatusMessage(`Setup completed for ${response.repoFullName}. Push to the repo to trigger validate-access.`);
    } catch (error) {
      setStatusMessage(formatApiError(error, "Setup failed"));
    } finally {
      setIsSettingUp(false);
    }
  }

  async function copyYaml(yaml: string) {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(yaml);
      setStatusMessage("YAML copied to clipboard.");
    } catch {
      setStatusMessage("Clipboard copy failed. Copy the YAML manually from the preview.");
    }
  }

  function downloadYaml(yaml: string, fileName: string) {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(href);
    setStatusMessage(`Downloaded ${fileName}`);
  }

  function renderSetupTab() {
    return (
      <motion.section
        className="studio-grid"
        id="workflow-panel-setup"
        role="tabpanel"
        aria-labelledby="workflow-tab-setup"
        tabIndex={0}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <aside className="controls-panel">
          <h2>Setup Filters</h2>
          <label className="input-label" htmlFor="template-search">
            Search templates
          </label>
          <input
            id="template-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Find by name, stack, or category"
          />

          <label className="input-label" htmlFor="stack-select">
            Stack
          </label>
          <select id="stack-select" value={selectedStack} onChange={(event) => setSelectedStack(event.target.value)}>
            <option value="all">All stacks</option>
            <option value="nextjs">Next.js</option>
            <option value="react">React</option>
            <option value="react-native">React Native</option>
            <option value="expo">Expo</option>
            <option value="nestjs">NestJS</option>
            <option value="nodejs">Node.js</option>
          </select>

          <p className="input-label">GitHub App</p>
          <div className="github-repo-select">
            {installUrl ? (
              <a className="github-repo-load-btn github-install-link" href={installUrl} target="_blank" rel="noreferrer">
                Install GitHub App
              </a>
            ) : (
              <button type="button" className="github-repo-load-btn" disabled>
                {loadingInstallUrl ? "Loading install link..." : "Install link unavailable"}
              </button>
            )}

            <label className="input-label compact-label" htmlFor="installation-id">
              Installation ID
            </label>
            <input
              id="installation-id"
              value={installationId}
              onChange={(event) => setInstallationId(event.target.value.replaceAll(/\D/g, ""))}
              placeholder="12345678"
            />
            <button
              type="button"
              className="github-repo-load-btn"
              onClick={() => void handleLinkInstallation()}
              disabled={linkingInstallation}
            >
              {linkingInstallation ? "Linking..." : "Link installation"}
            </button>
          </div>

          <label className="input-label" htmlFor="linked-repo-select">
            Linked repository
          </label>
          <div className="github-repo-select">
            {linkedReposLoaded ? (
              <select id="linked-repo-select" value={selectedRepoFullName} onChange={handleRepoSelect}>
                <option value="">Select a linked repo</option>
                {linkedRepos.map((repo) => (
                  <option key={`${repo.installationId}-${repo.repoFullName}`} value={repo.repoFullName}>
                    {repo.repoFullName}
                    {repo.private ? " 🔒" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                className="github-repo-load-btn"
                onClick={() => void loadLinkedRepos()}
                disabled={loadingLinkedRepos}
              >
                {loadingLinkedRepos ? "Loading linked repos..." : "Load linked repos"}
              </button>
            )}
            {linkedReposLoaded && linkedRepos.length === 0 ? (
              <p className="helper-text">No linked repos yet. Install the GitHub App, then link the installation ID.</p>
            ) : null}
          </div>

          <p className="input-label">Category</p>
          <div className="category-wrap">
            <button
              type="button"
              className={`category-chip ${selectedCategory === "All" ? "active" : ""}`}
              onClick={() => setSelectedCategory("All")}
            >
              All
            </button>
            {availableCategories.map((category) => (
              <button
                type="button"
                key={category.name}
                className={`category-chip ${selectedCategory === category.name ? "active" : ""}`}
                onClick={() => setSelectedCategory(category.name)}
              >
                {category.name} ({category.count})
              </button>
            ))}
          </div>

          <p className="helper-text">
            Source repository: <strong>cicd-workflow</strong>
          </p>
        </aside>

        <section className="templates-panel">
          <div className="templates-header">
            <h2>Setup Workflows</h2>
            <p>{filteredTemplates.length} templates matched</p>
          </div>

          {loadingCatalog ? (
            <div className="template-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="skeleton-card" />
              ))}
            </div>
          ) : null}

          <div className="template-grid">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplate?.id === template.id}
                onSelect={handleTemplateSelection}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>

          {selectedTemplate ? (
            <div className="generate-form">
              <h3>Set up {selectedTemplate.name}</h3>
              <p className="helper-text">
                Source workflow: {toSourcePath(selectedTemplate.workflowPath)}
              </p>
              <p className="helper-text">
                Source properties: {toSourcePath(selectedTemplate.propertiesPath)}
              </p>

              <label className="input-label" htmlFor="service-name">
                Service name
              </label>
              <input
                id="service-name"
                value={serviceName}
                onChange={(event) => setServiceName(toSlug(event.target.value))}
                placeholder="payments-service"
              />

              <label className="input-label" htmlFor="service-path">
                Service path (optional)
              </label>
              <input
                id="service-path"
                value={servicePath}
                onChange={(event) => setServicePath(event.target.value)}
                placeholder="apps/payments"
              />

              <label className="input-label" htmlFor="output-file-name">
                Workflow file name (optional)
              </label>
              <input
                id="output-file-name"
                value={outputFileName}
                onChange={(event) => setOutputFileName(event.target.value)}
                placeholder="example-app-ci.yml"
              />

              <div className="input-row">
                <div>
                  <label className="input-label" htmlFor="node-version">
                    Node version
                  </label>
                  <input
                    id="node-version"
                    value={nodeVersion}
                    onChange={(event) => setNodeVersion(event.target.value)}
                    placeholder="24"
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="coverage-threshold">
                    Coverage %
                  </label>
                  <input
                    id="coverage-threshold"
                    value={coverageThreshold}
                    onChange={(event) => setCoverageThreshold(event.target.value)}
                    placeholder="80"
                  />
                </div>
              </div>

              <div className="enhancement-grid">
                {enhancementLabels.map((enhancement) => (
                  <label className="enhancement-option" key={enhancement.key}>
                    <input
                      type="checkbox"
                      checked={enhancements.includes(enhancement.key)}
                      onChange={() => toggleEnhancement(enhancement.key)}
                    />
                    <span>{enhancement.label}</span>
                    <small>{enhancement.description}</small>
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="primary-button"
                data-testid="setup-project-button"
                disabled={isSettingUp}
                onClick={() => void handleSetupProject()}
              >
                {isSettingUp ? "Setting up..." : "Set up project"}
              </button>
            </div>
          ) : (
            <p className="helper-text">No templates match your current filters.</p>
          )}
        </section>

        <aside className="result-panel">
          <h2>Latest Setup</h2>
          <AnimatePresence mode="wait">
            {setupResult ? (
              <motion.div
                key={setupResult.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <p className="helper-text">Repo: {setupResult.repoFullName}</p>
                <p className="helper-text">Workflow: {setupResult.workflowPath}</p>
                <p className="helper-text">Commit: {setupResult.githubCommitSha}</p>
                <div className="result-actions">
                  {setupResult.githubCommitUrl ? (
                    <a className="ghost-button" href={setupResult.githubCommitUrl} target="_blank" rel="noreferrer">
                      Open commit
                    </a>
                  ) : null}
                  <button className="ghost-button" type="button" onClick={() => setActiveTab("current")}>
                    View project
                  </button>
                </div>
                <p className="helper-text">Next step: push to the repository and confirm validate-access reaches /v1/ci/validate.</p>
              </motion.div>
            ) : (
              <motion.p
                key="setup-placeholder"
                className="helper-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Select a linked GitHub repo and set up a project to write CI_TOKEN and commit the workflow.
              </motion.p>
            )}
          </AnimatePresence>
        </aside>
      </motion.section>
    );
  }

  function renderCurrentTab() {
    return (
      <motion.section
        className="tab-content-panel"
        id="workflow-panel-current"
        role="tabpanel"
        aria-labelledby="workflow-tab-current"
        tabIndex={0}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="templates-header">
          <h2>Provisioned Projects</h2>
          <p>{projects.length} setup entries</p>
        </div>
        <p className="helper-text">
          These repos have been set up through the GitHub App path and can be validated by pushing to the repository.
        </p>

        {loadingProjects ? <p className="helper-text">Loading provisioned projects...</p> : null}

        {!loadingProjects && projects.length === 0 ? (
          <p className="helper-text">No provisioned projects yet. Open Setup tab to configure your first repo.</p>
        ) : (
          <div className="history-grid">
            {projects.map((project) => (
              <article key={project.id} className="history-card">
                <div className="history-head">
                  <h3>{project.repoFullName}</h3>
                  <p>{project.status}</p>
                </div>
                <p className="helper-text">Service: {project.serviceName}</p>
                <p className="helper-text">Template: {project.templateId}</p>
                <p className="helper-text">Workflow: {project.workflowPath}</p>
                {project.githubCommitSha ? (
                  <p className="helper-text">Commit: {project.githubCommitSha}</p>
                ) : null}
                {project.failureReason ? (
                  <p className="error-text">Failure: {project.failureReason}</p>
                ) : null}
                <div className="result-actions">
                  {project.githubCommitUrl ? (
                    <a className="ghost-button" href={project.githubCommitUrl} target="_blank" rel="noreferrer">
                      Open commit
                    </a>
                  ) : null}
                  <button className="ghost-button" type="button" onClick={() => setActiveTab("setup")}>
                    Open Setup
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="templates-header history-section-header">
          <h2>Generated YAML History</h2>
          <p>{history.length} generated entries</p>
        </div>
        <p className="helper-text">
          Project setup also stores generated source YAML for review and export.
        </p>

        {loadingHistory ? <p className="helper-text">Loading workflow history...</p> : null}

        {!loadingHistory && history.length === 0 ? (
          <p className="helper-text">No generated workflow history yet.</p>
        ) : (
          <div className="history-grid">
            {history.map((entry) => (
              <article key={entry.id} className="history-card">
                <div className="history-head">
                  <h3>{entry.templateName}</h3>
                  <p>{formatDate(entry.createdAt)}</p>
                </div>
                <p className="helper-text">Service: {entry.serviceName}</p>
                <p className="helper-text">Output: {entry.outputFileName}</p>
                <p className="helper-text">Source workflow: {toSourcePath(entry.sourceWorkflowFile)}</p>
                <p className="helper-text">Source properties: {toSourcePath(entry.sourcePropertiesFile)}</p>
                <div className="result-actions">
                  <button className="ghost-button" type="button" onClick={() => copyYaml(entry.yaml)}>
                    Copy YAML
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => downloadYaml(entry.yaml, entry.outputFileName)}
                  >
                    Download
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setActiveTab("setup")}
                  >
                    Open Setup
                  </button>
                </div>
                <details>
                  <summary>Preview YAML</summary>
                  <pre>{entry.yaml}</pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </motion.section>
    );
  }

  function renderAllTab() {
    return (
      <motion.section
        className="tab-content-panel"
        id="workflow-panel-all"
        role="tabpanel"
        aria-labelledby="workflow-tab-all"
        tabIndex={0}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="templates-header">
          <h2>All Templates</h2>
          <p>{allTemplates.length} templates from cicd-workflow</p>
        </div>
        <p className="helper-text">
          These are the source templates currently loaded from cicd-workflow/workflow-templates.
        </p>

        <div className="all-template-grid">
          {allTemplates.map((template) => (
            <article key={template.id} className="all-template-card">
              <div className="all-template-head">
                <h3>{template.name}</h3>
                <span className="template-stack-badge">{template.stack.toUpperCase()}</span>
              </div>
              <p className="template-card-description">{template.description}</p>
              <p className="helper-text">Workflow: {toSourcePath(template.workflowPath)}</p>
              <p className="helper-text">Properties: {toSourcePath(template.propertiesPath)}</p>
              <div className="template-tag-row">
                {template.categories.slice(0, 4).map((category) => (
                  <span key={`${template.id}-${category}`} className="template-tag">
                    {category}
                  </span>
                ))}
              </div>
              <div className="result-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setActiveTab("setup");
                    setStatusMessage(`Ready to set up ${template.name}`);
                  }}
                >
                  Use in Setup
                </button>
              </div>
            </article>
          ))}
        </div>
      </motion.section>
    );
  }

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <section className="workflow-surface">
        <header className="product-topbar">
          <div>
            <p className="eyebrow">Workflow Studio</p>
            <h1>Build and manage workflows</h1>
          </div>
          <div className="topbar-controls">
            <p className="status-pill">@{login}</p>
            <p className="status-pill">Plan: {plan}</p>
            <p className="status-pill">Source: cicd-workflow</p>
          </div>
        </header>

        <section className="intro-panel">
          <p>Use tabs to set up, review generated workflows, and browse templates.</p>
          {statusMessage ? (
            <motion.p
              className={`status-banner ${statusBannerVariant(statusMessage)}`}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {statusMessage}
            </motion.p>
          ) : null}
          {catalogError ? (
            <p className="error-text" role="alert">
              {catalogError}
            </p>
          ) : null}
        </section>

        <div className="studio-tab-bar glass-panel" role="tablist" aria-label="Workflow functions">
          <button
            type="button"
            role="tab"
            id="workflow-tab-setup"
            aria-controls="workflow-panel-setup"
            aria-selected={activeTab === "setup"}
            tabIndex={activeTab === "setup" ? 0 : -1}
            className={`studio-tab-button ${activeTab === "setup" ? "active" : ""}`}
            onClick={() => setActiveTab("setup")}
            onKeyDown={(event) => handleTabKeyDown(event, "setup")}
          >
            <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            {"Setup"}
          </button>
          <button
            type="button"
            role="tab"
            id="workflow-tab-current"
            aria-controls="workflow-panel-current"
            aria-selected={activeTab === "current"}
            tabIndex={activeTab === "current" ? 0 : -1}
            className={`studio-tab-button ${activeTab === "current" ? "active" : ""}`}
            onClick={() => setActiveTab("current")}
            onKeyDown={(event) => handleTabKeyDown(event, "current")}
          >
            <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            {"Current"}
          </button>
          <button
            type="button"
            role="tab"
            id="workflow-tab-all"
            aria-controls="workflow-panel-all"
            aria-selected={activeTab === "all"}
            tabIndex={activeTab === "all" ? 0 : -1}
            className={`studio-tab-button ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
            onKeyDown={(event) => handleTabKeyDown(event, "all")}
          >
            <svg className="studio-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            {"Templates"}
          </button>
        </div>

        {activeTab === "setup" ? renderSetupTab() : null}
        {activeTab === "current" ? renderCurrentTab() : null}
        {activeTab === "all" ? renderAllTab() : null}
      </section>
    </MotionConfig>
  );
}
