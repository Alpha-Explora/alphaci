"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import type { CreateProjectResult, ProvisionedProject, WorkflowHistoryItem } from "@/lib/api/contracts";

import { formatDate, toSourcePath } from "./workflow-builder-utils";

interface WorkflowCurrentTabProps {
  history: WorkflowHistoryItem[];
  latestResult: CreateProjectResult | null;
  loadingHistory: boolean;
  loadingProjects: boolean;
  onCopyYaml: (yaml: string) => void;
  onDownloadYaml: (yaml: string, fileName: string) => void;
  onOpenSetup: () => void;
  projects: ProvisionedProject[];
}

type SubTab = "projects" | "history";

function selectedChecks(project: ProvisionedProject): string {
  const options = project.projectOptions ?? {};
  const enabled = Object.entries(options)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  return enabled.length ? enabled.join(", ") : "None";
}

function statusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

export function WorkflowCurrentTab({
  history,
  latestResult,
  loadingHistory,
  loadingProjects,
  onCopyYaml,
  onDownloadYaml,
  onOpenSetup,
  projects,
}: Readonly<WorkflowCurrentTabProps>) {
  const [subTab, setSubTab] = useState<SubTab>("projects");

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
      {/* ── Latest result banner ──────────────────────────────────── */}
      {latestResult ? (
        <div style={{
          marginBottom: "1.25rem",
          padding: "0.85rem 1rem",
          borderRadius: "var(--radius-card)",
          background: "rgba(0, 208, 132, 0.06)",
          border: "1px solid rgba(0, 208, 132, 0.2)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ color: "var(--success)", margin: 0 }}>Project created</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>·</span>
            <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }}>
              {latestResult.repoFullName}
            </span>
          </div>
          <div className="result-branches" style={{ margin: 0 }}>
            {latestResult.branchesCreated.map((branch) => (
              <span key={branch} className="branch-chip">{branch}</span>
            ))}
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>
            Workflow file:{" "}
            <strong style={{ color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }}>
              {latestResult.outputFileName}
            </strong>
            {latestResult.githubCommitUrl ? (
              <a
                href={latestResult.githubCommitUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: "0.75rem", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
              >
                {latestResult.githubCommitSha.slice(0, 10)}
              </a>
            ) : (
              <code style={{ marginLeft: "0.75rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {latestResult.githubCommitSha.slice(0, 10)}
              </code>
            )}
          </p>
          <div className="result-actions" style={{ margin: 0 }}>
            <a className="primary-button" href={latestResult.repoUrl} target="_blank" rel="noreferrer"
               style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem", minHeight: "2.4rem" }}>
              Open repo
            </a>
            <a className="ghost-button" href={`${latestResult.repoUrl}/actions`} target="_blank" rel="noreferrer"
               style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem", minHeight: "2.4rem" }}>
              Open Actions
            </a>
            <a
              className="ghost-button"
              href={`${latestResult.repoUrl}/blob/main/${latestResult.workflowPath}`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem", minHeight: "2.4rem" }}
            >
              View workflow
            </a>
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0 }}>
            Workflow committed to{" "}
            <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem" }}>
              {latestResult.workflowPath}
            </code>{" "}
            on <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem" }}>main</code>.
            Push to <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(255,255,255,0.06)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem" }}>test</code> to trigger your first CI run.
          </p>
        </div>
      ) : null}

      {/* ── Sub-tab bar ───────────────────────────────────────────── */}
      <div className="subtab-bar" role="tablist" aria-label="Current tab sections">
        <button
          type="button"
          role="tab"
          id="subtab-projects"
          aria-controls="subtab-panel-projects"
          aria-selected={subTab === "projects"}
          className={`subtab-btn${subTab === "projects" ? " active" : ""}`}
          onClick={() => setSubTab("projects")}
        >
          Projects
          {!loadingProjects && projects.length > 0 && (
            <span style={{ marginLeft: "0.35rem", color: subTab === "projects" ? "var(--brand)" : "var(--text-muted)", fontSize: "0.75rem" }}>
              {projects.length}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          id="subtab-history"
          aria-controls="subtab-panel-history"
          aria-selected={subTab === "history"}
          className={`subtab-btn${subTab === "history" ? " active" : ""}`}
          onClick={() => setSubTab("history")}
        >
          History
          {!loadingHistory && history.length > 0 && (
            <span style={{ marginLeft: "0.35rem", color: subTab === "history" ? "var(--brand)" : "var(--text-muted)", fontSize: "0.75rem" }}>
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Projects panel ───────────────────────────────────────── */}
      {subTab === "projects" && (
        <div
          id="subtab-panel-projects"
          role="tabpanel"
          aria-labelledby="subtab-projects"
        >
          {loadingProjects ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton-card" style={{ minHeight: "8rem" }} />)}
            </div>
          ) : projects.length === 0 ? (
            <div style={{ padding: "2.5rem 0", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", margin: "0 0 1rem", fontSize: "0.88rem" }}>
                No provisioned projects yet.
              </p>
              <button className="primary-button" type="button" onClick={onOpenSetup}
                      style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem", minHeight: "2.5rem" }}>
                Create your first project
              </button>
            </div>
          ) : (
            <div className="history-grid">
              {projects.map((project) => (
                <article key={project.id} className="project-card">
                  {/* Header: repo name + status */}
                  <div className="project-card-header">
                    {project.repoUrl ? (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="project-card-repo"
                      >
                        {project.repoFullName}
                      </a>
                    ) : (
                      <span className="project-card-repo" style={{ cursor: "default" }}>
                        {project.repoFullName}
                      </span>
                    )}
                    <span className={`project-status-badge ${statusVariant(project.status)}`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Meta tags: projectTypeId + workflowRecipeId */}
                  <div className="project-card-meta-row">
                    {project.projectTypeId && (
                      <span className="project-card-tag">{project.projectTypeId}</span>
                    )}
                    {project.workflowRecipeId && (
                      <span className="project-card-tag">{project.workflowRecipeId}</span>
                    )}
                    {project.visibility && (
                      <span className="project-card-tag">{project.visibility}</span>
                    )}
                  </div>

                  {/* Key-value details */}
                  <dl className="project-kv-grid">
                    <dt className="project-kv-key">Service</dt>
                    <dd className="project-kv-val">{project.serviceName}</dd>

                    {project.workflowPath && (
                      <>
                        <dt className="project-kv-key">Workflow</dt>
                        <dd className="project-kv-val" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
                          {project.workflowPath}
                        </dd>
                      </>
                    )}

                    {selectedChecks(project) !== "None" && (
                      <>
                        <dt className="project-kv-key">Checks</dt>
                        <dd className="project-kv-val">{selectedChecks(project)}</dd>
                      </>
                    )}

                    {project.githubCommitSha && (
                      <>
                        <dt className="project-kv-key">Commit</dt>
                        <dd className="project-kv-val" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}>
                          {project.githubCommitSha.slice(0, 10)}
                        </dd>
                      </>
                    )}
                  </dl>

                  {project.failureReason ? (
                    <p className="error-text" style={{ margin: 0, fontSize: "0.78rem" }}>
                      {project.failureReason}
                    </p>
                  ) : null}

                  {/* Action buttons */}
                  <div className="project-card-actions">
                    {project.repoUrl && (
                      <a
                        className="ghost-button"
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                      >
                        Open repo
                      </a>
                    )}
                    {project.repoUrl && (
                      <a
                        className="ghost-button"
                        href={`${project.repoUrl}/actions`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                      >
                        Actions
                      </a>
                    )}
                    {project.githubCommitUrl && (
                      <a
                        className="ghost-button"
                        href={project.githubCommitUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                      >
                        Commit
                      </a>
                    )}
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={onOpenSetup}
                      style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                    >
                      New project
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History panel ─────────────────────────────────────────── */}
      {subTab === "history" && (
        <div
          id="subtab-panel-history"
          role="tabpanel"
          aria-labelledby="subtab-history"
        >
          {loadingHistory ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton-card" style={{ minHeight: "7rem" }} />)}
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: "2.5rem 0", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", margin: "0 0 1rem", fontSize: "0.88rem" }}>
                No generated workflow history yet.
              </p>
              <button className="primary-button" type="button" onClick={onOpenSetup}
                      style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem", minHeight: "2.5rem" }}>
                Generate your first workflow
              </button>
            </div>
          ) : (
            <div className="history-grid">
              {history.map((entry) => (
                <article key={entry.id} className="history-entry-card">
                  {/* Header */}
                  <div className="history-entry-header">
                    <h3 className="history-entry-title">{entry.templateName}</h3>
                    <p className="history-entry-date">{formatDate(entry.createdAt)}</p>
                  </div>

                  {/* Meta tags: stack + file name */}
                  <div className="history-entry-meta">
                    {entry.stack && (
                      <span className="template-stack-badge">{entry.stack}</span>
                    )}
                    <span className="project-card-tag" style={{ fontFamily: "ui-monospace, monospace" }}>
                      {entry.outputFileName}
                    </span>
                  </div>

                  {/* Key-value row */}
                  <dl className="project-kv-grid">
                    <dt className="project-kv-key">Service</dt>
                    <dd className="project-kv-val">{entry.serviceName}</dd>

                    {entry.sourceWorkflowFile && (
                      <>
                        <dt className="project-kv-key">Source</dt>
                        <dd className="project-kv-val" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.74rem" }}>
                          {toSourcePath(entry.sourceWorkflowFile)}
                        </dd>
                      </>
                    )}
                  </dl>

                  {/* Actions */}
                  <div className="history-entry-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onCopyYaml(entry.yaml)}
                      style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                    >
                      Copy YAML
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onDownloadYaml(entry.yaml, entry.outputFileName)}
                      style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                    >
                      Download
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={onOpenSetup}
                      style={{ padding: "0.42rem 0.9rem", fontSize: "0.8rem", minHeight: "2.2rem" }}
                    >
                      New project
                    </button>
                  </div>

                  {/* YAML preview */}
                  <details>
                    <summary style={{ cursor: "pointer", color: "var(--brand)", fontWeight: 700, fontSize: "0.82rem", marginTop: "0.25rem" }}>
                      Preview YAML
                    </summary>
                    <pre style={{ marginTop: "0.5rem" }}>{entry.yaml}</pre>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}
