"use client";

import { motion } from "framer-motion";

import type { SetupProjectResponse } from "@/lib/api/contracts";
import type { GithubInstallationsState } from "@/hooks/use-github-installations";
import type { ProjectSetupFormState } from "@/hooks/use-project-setup-form";
import type { WorkflowCatalogState } from "@/hooks/use-workflow-catalog";

import { SetupResultPanel } from "./setup-result-panel";
import { TemplateCard } from "./template-card";
import { enhancementLabels, toSlug, toSourcePath } from "./workflow-builder-utils";

interface WorkflowSetupTabProps {
  catalog: WorkflowCatalogState;
  form: ProjectSetupFormState;
  github: GithubInstallationsState;
  isSettingUp: boolean;
  onSetupProject: () => void;
  onTemplateSelect: NonNullable<Parameters<typeof TemplateCard>[0]["onSelect"]>;
  onViewProject: () => void;
  reducedMotion: boolean;
  setupResult: SetupProjectResponse | null;
}

export function WorkflowSetupTab({
  catalog,
  form,
  github,
  isSettingUp,
  onSetupProject,
  onTemplateSelect,
  onViewProject,
  reducedMotion,
  setupResult,
}: Readonly<WorkflowSetupTabProps>) {
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
          value={catalog.searchQuery}
          onChange={(event) => catalog.setSearchQuery(event.target.value)}
          placeholder="Find by name, stack, or category"
        />

        <label className="input-label" htmlFor="stack-select">
          Stack
        </label>
        <select
          id="stack-select"
          value={catalog.selectedStack}
          onChange={(event) => catalog.setSelectedStack(event.target.value)}
        >
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

        <label className="input-label" htmlFor="linked-repo-select">
          Linked repository
        </label>
        <div className="github-repo-select">
          {github.linkedReposLoaded ? (
            <select id="linked-repo-select" value={github.selectedRepoFullName} onChange={github.handleRepoSelect}>
              <option value="">Select a linked repo</option>
              {github.linkedRepos.map((repo) => (
                <option key={`${repo.installationId}-${repo.repoFullName}`} value={repo.repoFullName}>
                  {repo.repoFullName}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              className="github-repo-load-btn"
              onClick={() => void github.loadLinkedRepos()}
              disabled={github.loadingLinkedRepos}
            >
              {github.loadingLinkedRepos ? "Loading linked repos..." : "Load linked repos"}
            </button>
          )}
          {github.linkedReposLoaded && github.linkedRepos.length === 0 ? (
            <p className="helper-text">No linked repos yet. Install the GitHub App, then link the installation ID.</p>
          ) : null}
        </div>

        <p className="input-label">Category</p>
        <div className="category-wrap">
          <button
            type="button"
            className={`category-chip ${catalog.selectedCategory === "All" ? "active" : ""}`}
            onClick={() => catalog.setSelectedCategory("All")}
          >
            All
          </button>
          {catalog.availableCategories.map((category) => (
            <button
              type="button"
              key={category.name}
              className={`category-chip ${catalog.selectedCategory === category.name ? "active" : ""}`}
              onClick={() => catalog.setSelectedCategory(category.name)}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>

        <p className="helper-text">
          Source repository: <strong>workflow-core</strong>
        </p>
      </aside>

      <section className="templates-panel">
        <div className="templates-header">
          <h2>Setup Workflows</h2>
          <p>{catalog.filteredTemplates.length} templates matched</p>
        </div>

        {catalog.loadingCatalog ? (
          <div className="template-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="skeleton-card" />
            ))}
          </div>
        ) : null}

        <div className="template-grid">
          {catalog.filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={catalog.selectedTemplate?.id === template.id}
              onSelect={onTemplateSelect}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>

        {catalog.selectedTemplate ? (
          <div className="generate-form">
            <h3>Set up {catalog.selectedTemplate.name}</h3>
            <p className="helper-text">
              Source workflow: {toSourcePath(catalog.selectedTemplate.workflowPath)}
            </p>
            <p className="helper-text">
              Source properties: {toSourcePath(catalog.selectedTemplate.propertiesPath)}
            </p>

            <label className="input-label" htmlFor="service-name">
              Service name
            </label>
            <input
              id="service-name"
              value={form.serviceName}
              onChange={(event) => form.setServiceName(toSlug(event.target.value))}
              placeholder="payments-service"
            />

            <label className="input-label" htmlFor="service-path">
              Service path (optional)
            </label>
            <input
              id="service-path"
              value={form.servicePath}
              onChange={(event) => form.setServicePath(event.target.value)}
              placeholder="apps/payments"
            />

            <label className="input-label" htmlFor="output-file-name">
              Workflow file name (optional)
            </label>
            <input
              id="output-file-name"
              value={form.outputFileName}
              onChange={(event) => form.setOutputFileName(event.target.value)}
              placeholder="example-app-ci.yml"
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

            <div className="enhancement-grid">
              {enhancementLabels.map((enhancement) => (
                <label className="enhancement-option" key={enhancement.key}>
                  <input
                    type="checkbox"
                    checked={form.enhancements.includes(enhancement.key)}
                    onChange={() => form.toggleEnhancement(enhancement.key)}
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
              onClick={() => void onSetupProject()}
            >
              {isSettingUp ? "Setting up..." : "Set up project"}
            </button>
          </div>
        ) : (
          <p className="helper-text">No templates match your current filters.</p>
        )}
      </section>

      <SetupResultPanel setupResult={setupResult} onViewProject={onViewProject} />
    </motion.section>
  );
}
