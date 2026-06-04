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

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } }
};

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
      style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}
    >
      {/* ── Latest result banner ──────────────────────────────────── */}
      {latestResult ? (
        <div className="glass-panel" style={{
          marginBottom: "1.5rem",
          padding: "1.25rem",
          borderRadius: "var(--radius-card)",
          background: "linear-gradient(135deg, rgba(52, 211, 153, 0.06) 0%, rgba(15, 23, 42, 0.6) 100%)",
          border: "1px solid rgba(52, 211, 153, 0.25)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          boxShadow: "var(--shadow-card)",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }} />
            <p className="eyebrow" style={{ color: "var(--success)", margin: 0, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Project Created Successfully</p>
            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>·</span>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-primary)", fontFamily: "ui-monospace, monospace" }}>
              {latestResult.repoFullName}
            </span>
          </div>
          <div className="result-branches" style={{ margin: 0, display: "flex", gap: "0.35rem" }}>
            {latestResult.branchesCreated.map((branch) => (
              <span key={branch} className="branch-chip" style={{
                fontSize: "0.7rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "4px",
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-soft)",
                fontFamily: "ui-monospace, monospace"
              }}>{branch}</span>
            ))}
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>
            Workflow file:{" "}
            <strong style={{ color: "var(--brand)", fontFamily: "ui-monospace, monospace" }}>
              {latestResult.outputFileName}
            </strong>
            {latestResult.githubCommitUrl ? (
              <a
                href={latestResult.githubCommitUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: "0.75rem", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", textDecoration: "none" }}
              >
                commit: <span style={{ color: "var(--brand)", borderBottom: "1px dashed var(--brand)" }}>{latestResult.githubCommitSha.slice(0, 10)}</span>
              </a>
            ) : (
              <code style={{ marginLeft: "0.75rem", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                {latestResult.githubCommitSha.slice(0, 10)}
              </code>
            )}
          </p>
          <div className="result-actions" style={{ margin: "0.25rem 0", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <a className="primary-button" href={latestResult.repoUrl} target="_blank" rel="noreferrer"
               style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2.2rem", display: "inline-flex", alignItems: "center" }}>
              Open Repository
            </a>
            <a className="ghost-button" href={`${latestResult.repoUrl}/actions`} target="_blank" rel="noreferrer"
               style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2.2rem", display: "inline-flex", alignItems: "center" }}>
              Open Actions
            </a>
            <a
              className="ghost-button"
              href={`${latestResult.repoUrl}/blob/main/${latestResult.workflowPath}`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", minHeight: "2.2rem", display: "inline-flex", alignItems: "center" }}
            >
              View Workflow File
            </a>
          </div>
          <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
            Workflow committed to{" "}
            <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(0,0,0,0.15)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem", border: "1px solid var(--border-soft)" }}>
              {latestResult.workflowPath}
            </code>{" "}
            on <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(0,0,0,0.15)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem", border: "1px solid var(--border-soft)" }}>main</code>.
            Push to <code style={{ fontFamily: "ui-monospace, monospace", background: "rgba(0,0,0,0.15)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem", border: "1px solid var(--border-soft)" }}>test</code> to trigger your first CI run.
          </p>
        </div>
      ) : null}

      {/* ── Sub-tab bar ───────────────────────────────────────────── */}
      <div className="subtab-bar" role="tablist" aria-label="Current tab sections" style={{
        position: "relative",
        display: "flex",
        gap: "0.25rem",
        padding: "0.25rem",
        background: "rgba(15, 23, 42, 0.4)",
        border: "1px solid var(--border-soft)",
        borderRadius: "0.6rem",
        width: "fit-content",
        marginBottom: "1.25rem"
      }}>
        {(["projects", "history"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`subtab-${tab}`}
            aria-controls={`subtab-panel-${tab}`}
            aria-selected={subTab === tab}
            onClick={() => setSubTab(tab)}
            style={{
              position: "relative",
              padding: "0.4rem 1.1rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              transition: "color 0.2s ease",
              color: subTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
              zIndex: 1,
              fontWeight: 600,
              fontSize: "0.82rem"
            }}
          >
            {subTab === tab && (
              <motion.span
                layoutId="current-subtab-indicator"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "0.4rem",
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  boxShadow: "0 0 12px rgba(56, 189, 248, 0.15)",
                  zIndex: -1,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {tab === "projects" ? "Projects" : "History"}
            {tab === "projects" && !loadingProjects && projects.length > 0 && (
              <span style={{ marginLeft: "0.35rem", color: subTab === "projects" ? "var(--brand)" : "var(--text-muted)", fontSize: "0.75rem" }}>
                {projects.length}
              </span>
            )}
            {tab === "history" && !loadingHistory && history.length > 0 && (
              <span style={{ marginLeft: "0.35rem", color: subTab === "history" ? "var(--brand)" : "var(--text-muted)", fontSize: "0.75rem" }}>
                {history.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Projects panel ───────────────────────────────────────── */}
      {subTab === "projects" && (
        <div
          id="subtab-panel-projects"
          role="tabpanel"
          aria-labelledby="subtab-projects"
        >
          {loadingProjects ? (
            <div className="repo-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-card glass-panel" style={{ minHeight: "12rem", background: "rgba(15, 23, 42, 0.3)", animation: "state-pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="glass-panel" style={{ padding: "3rem 1.5rem", textAlign: "center", background: "rgba(15, 23, 42, 0.3)" }}>
              <p style={{ color: "var(--text-secondary)", margin: "0 0 1.25rem", fontSize: "0.88rem" }}>
                No provisioned projects yet.
              </p>
              <button className="primary-button" type="button" onClick={onOpenSetup}
                      style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem", minHeight: "2.5rem" }}>
                Create your first project
              </button>
            </div>
          ) : (
            <motion.div
              className="repo-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {projects.map((project) => (
                <motion.article
                  key={project.id}
                  variants={cardVariants}
                  className="repo-card glass-panel"
                  style={{
                    background: "rgba(15, 23, 42, 0.45)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "1.25rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                    transition: "all 0.25s ease",
                  }}
                  whileHover={{
                    y: -3,
                    borderColor: "rgba(56, 189, 248, 0.3)",
                    boxShadow: "var(--shadow-card), 0 0 24px rgba(56, 189, 248, 0.05)"
                  }}
                >
                  {/* Header: repo name + status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                    {project.repoUrl ? (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="repo-card-title"
                        style={{ fontSize: "0.95rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.repoFullName.split("/")[1]}
                        </span>
                      </a>
                    ) : (
                      <span className="repo-card-title" style={{ cursor: "default", fontSize: "0.95rem", fontWeight: 700 }}>
                        {project.repoFullName}
                      </span>
                    )}
                    <span className={`project-status-badge ${statusVariant(project.status)}`} style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "4px",
                      background: project.status === "provisioned" ? "rgba(52, 211, 153, 0.1)" : project.status === "provisioning" ? "rgba(251, 191, 36, 0.1)" : "rgba(248, 113, 113, 0.1)",
                      color: project.status === "provisioned" ? "var(--success)" : project.status === "provisioning" ? "var(--warning)" : "var(--danger)",
                      border: project.status === "provisioned" ? "1px solid rgba(52, 211, 153, 0.25)" : project.status === "provisioning" ? "1px solid rgba(251, 191, 36, 0.25)" : "1px solid rgba(248, 113, 113, 0.25)",
                    }}>
                      {project.status}
                    </span>
                  </div>

                  {/* Meta tags */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", margin: "0.1rem 0" }}>
                    {project.projectTypeId && (
                      <span className="project-card-tag" style={{
                        fontSize: "0.68rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "rgba(56, 189, 248, 0.1)",
                        color: "var(--brand)",
                        border: "1px solid rgba(56, 189, 248, 0.15)"
                      }}>{project.projectTypeId}</span>
                    )}
                    {project.workflowRecipeId && (
                      <span className="project-card-tag" style={{
                        fontSize: "0.68rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-soft)"
                      }}>{project.workflowRecipeId}</span>
                    )}
                    {project.visibility && (
                      <span className="project-card-tag" style={{
                        fontSize: "0.68rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        background: "rgba(255, 255, 255, 0.04)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-soft)"
                      }}>{project.visibility}</span>
                    )}
                  </div>

                  {/* Key-value details */}
                  <dl style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.45rem 1rem",
                    background: "rgba(0,0,0,0.15)",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.78rem",
                    margin: "0.25rem 0"
                  }}>
                    <dt style={{ color: "var(--text-muted)" }}>Service</dt>
                    <dd style={{ color: "var(--text-primary)", fontWeight: 600 }}>{project.serviceName}</dd>

                    {project.workflowPath && (
                      <>
                        <dt style={{ color: "var(--text-muted)" }}>Workflow</dt>
                        <dd style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem", wordBreak: "break-all" }}>
                          {project.workflowPath}
                        </dd>
                      </>
                    )}

                    {selectedChecks(project) !== "None" && (
                      <>
                        <dt style={{ color: "var(--text-muted)" }}>Checks</dt>
                        <dd style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedChecks(project)}</dd>
                      </>
                    )}

                    {project.githubCommitSha && (
                      <>
                        <dt style={{ color: "var(--text-muted)" }}>Commit</dt>
                        <dd style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }}>
                          {project.githubCommitSha.slice(0, 10)}
                        </dd>
                      </>
                    )}
                  </dl>

                  {project.failureReason ? (
                    <p className="error-text" style={{ margin: 0, fontSize: "0.78rem", color: "var(--danger)" }}>
                      {project.failureReason}
                    </p>
                  ) : null}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "auto", borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem", flexWrap: "wrap" }}>
                    {project.repoUrl && (
                      <a
                        className="ghost-button"
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.78rem",
                          minHeight: "2rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          textAlign: "center"
                        }}
                      >
                        Repo
                      </a>
                    )}
                    {project.repoUrl && (
                      <a
                        className="ghost-button"
                        href={`${project.repoUrl}/actions`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.78rem",
                          minHeight: "2rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          textAlign: "center"
                        }}
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
                        style={{
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.78rem",
                          minHeight: "2rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          textAlign: "center"
                        }}
                      >
                        Commit
                      </a>
                    )}
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={onOpenSetup}
                      style={{
                        marginLeft: "auto",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.2)",
                        color: "var(--brand)",
                        background: "rgba(56, 189, 248, 0.04)"
                      }}
                    >
                      New
                    </button>
                  </div>
                </motion.article>
              ))}
            </motion.div>
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
            <div className="repo-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-card glass-panel" style={{ minHeight: "10rem", background: "rgba(15, 23, 42, 0.3)", animation: "state-pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="glass-panel" style={{ padding: "3rem 1.5rem", textAlign: "center", background: "rgba(15, 23, 42, 0.3)" }}>
              <p style={{ color: "var(--text-secondary)", margin: "0 0 1.25rem", fontSize: "0.88rem" }}>
                No generated workflow history yet.
              </p>
              <button className="primary-button" type="button" onClick={onOpenSetup}
                      style={{ padding: "0.6rem 1.4rem", fontSize: "0.88rem", minHeight: "2.5rem" }}>
                Generate your first workflow
              </button>
            </div>
          ) : (
            <motion.div
              className="repo-grid"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {history.map((entry) => (
                <motion.article
                  key={entry.id}
                  variants={cardVariants}
                  className="repo-card glass-panel"
                  style={{
                    background: "rgba(15, 23, 42, 0.45)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "1.25rem",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                    transition: "all 0.25s ease",
                  }}
                  whileHover={{
                    y: -3,
                    borderColor: "rgba(56, 189, 248, 0.3)",
                    boxShadow: "var(--shadow-card), 0 0 24px rgba(56, 189, 248, 0.05)"
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{entry.templateName}</h3>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>{formatDate(entry.createdAt)}</p>
                  </div>

                  {/* Meta tags: stack + file name */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {entry.stack && (
                      <span className="template-stack-badge" style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        background: "rgba(56, 189, 248, 0.1)",
                        color: "var(--brand)",
                        border: "1px solid rgba(56, 189, 248, 0.15)"
                      }}>{entry.stack}</span>
                    )}
                    <span className="project-card-tag" style={{
                      fontSize: "0.68rem",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.04)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-soft)",
                      fontFamily: "ui-monospace, monospace"
                    }}>
                      {entry.outputFileName}
                    </span>
                  </div>

                  {/* Key-value row */}
                  <dl style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: "0.45rem 1rem",
                    background: "rgba(0,0,0,0.15)",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.78rem",
                    margin: "0.1rem 0"
                  }}>
                    <dt style={{ color: "var(--text-muted)" }}>Service</dt>
                    <dd style={{ color: "var(--text-primary)", fontWeight: 600 }}>{entry.serviceName}</dd>

                    {entry.sourceWorkflowFile && (
                      <>
                        <dt style={{ color: "var(--text-muted)" }}>Source</dt>
                        <dd style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem", wordBreak: "break-all" }}>
                          {toSourcePath(entry.sourceWorkflowFile)}
                        </dd>
                      </>
                    )}
                  </dl>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "auto", borderTop: "1px solid var(--border-soft)", paddingTop: "0.75rem" }}>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onCopyYaml(entry.yaml)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Copy YAML
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onDownloadYaml(entry.yaml, entry.outputFileName)}
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Download
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={onOpenSetup}
                      style={{
                        marginLeft: "auto",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.78rem",
                        minHeight: "2rem",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.2)",
                        color: "var(--brand)",
                        background: "rgba(56, 189, 248, 0.04)"
                      }}
                    >
                      New
                    </button>
                  </div>

                  {/* YAML preview */}
                  <details style={{ marginTop: "0.25rem" }}>
                    <summary style={{ cursor: "pointer", color: "var(--brand)", fontWeight: 700, fontSize: "0.82rem", outline: "none", userSelect: "none" }}>
                      Preview YAML config
                    </summary>
                    <pre style={{
                      marginTop: "0.5rem",
                      padding: "0.75rem",
                      background: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "6px",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      overflowX: "auto",
                      maxHeight: "150px"
                    }}>{entry.yaml}</pre>
                  </details>
                </motion.article>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </motion.section>
  );
}
