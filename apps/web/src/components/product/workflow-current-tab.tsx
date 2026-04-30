"use client";

import { motion } from "framer-motion";

import type { ProvisionedProject, WorkflowHistoryItem } from "@/lib/api/contracts";

import { formatDate, toSourcePath } from "./workflow-builder-utils";

interface WorkflowCurrentTabProps {
  history: WorkflowHistoryItem[];
  loadingHistory: boolean;
  loadingProjects: boolean;
  onCopyYaml: (yaml: string) => void;
  onDownloadYaml: (yaml: string, fileName: string) => void;
  onOpenSetup: () => void;
  projects: ProvisionedProject[];
}

function selectedChecks(project: ProvisionedProject): string {
  const options = project.projectOptions ?? {};
  const enabled = Object.entries(options)
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  return enabled.length ? enabled.join(", ") : "None selected";
}

export function WorkflowCurrentTab({
  history,
  loadingHistory,
  loadingProjects,
  onCopyYaml,
  onDownloadYaml,
  onOpenSetup,
  projects,
}: Readonly<WorkflowCurrentTabProps>) {
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
        <p>{projects.length} projects</p>
      </div>
      <p className="helper-text">
        These repos were created through the GitHub App path and include CI_TOKEN plus the managed workflow file.
      </p>

      {loadingProjects ? <p className="helper-text">Loading provisioned projects...</p> : null}

      {!loadingProjects && projects.length === 0 ? (
        <p className="helper-text">No provisioned projects yet. Open Create Project to scaffold your first repo.</p>
      ) : (
        <div className="history-grid">
          {projects.map((project) => (
            <article key={project.id} className="history-card">
              <div className="history-head">
                <h3>{project.repoFullName}</h3>
                <p>{project.status}</p>
              </div>
              {project.repoUrl ? (
                <p className="helper-text">
                  Repo URL:{" "}
                  <a href={project.repoUrl} target="_blank" rel="noreferrer">
                    {project.repoUrl}
                  </a>
                </p>
              ) : null}
              {project.visibility ? (
                <p className="helper-text">Visibility: {project.visibility}</p>
              ) : null}
              <p className="helper-text">Service: {project.serviceName}</p>
              <p className="helper-text">
                Project type: {project.projectTypeId ?? project.templateId}
              </p>
              <p className="helper-text">
                Recipe: {project.workflowRecipeId ?? project.templateId}
              </p>
              <p className="helper-text">Selected checks: {selectedChecks(project)}</p>
              <p className="helper-text">Workflow: {project.workflowPath}</p>
              {project.githubCommitSha ? (
                <p className="helper-text">Commit: {project.githubCommitSha}</p>
              ) : null}
              {project.failureReason ? (
                <p className="error-text">Failure: {project.failureReason}</p>
              ) : null}
              <div className="result-actions">
                {project.repoUrl ? (
                  <>
                    <a className="ghost-button" href={project.repoUrl} target="_blank" rel="noreferrer">
                      Open repo
                    </a>
                    <a className="ghost-button" href={`${project.repoUrl}/actions`} target="_blank" rel="noreferrer">
                      Open Actions
                    </a>
                  </>
                ) : null}
                {project.githubCommitUrl ? (
                  <a className="ghost-button" href={project.githubCommitUrl} target="_blank" rel="noreferrer">
                    Open commit
                  </a>
                ) : null}
                <button className="ghost-button" type="button" onClick={onOpenSetup}>
                  Create Project
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
        Project creation also stores generated source YAML for review and export.
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
                <button className="ghost-button" type="button" onClick={() => onCopyYaml(entry.yaml)}>
                  Copy YAML
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => onDownloadYaml(entry.yaml, entry.outputFileName)}
                >
                  Download
                </button>
                <button className="ghost-button" type="button" onClick={onOpenSetup}>
                  Create Project
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
