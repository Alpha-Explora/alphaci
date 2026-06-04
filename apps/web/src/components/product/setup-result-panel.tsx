"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { CreateProjectResult } from "@/lib/api/contracts";

interface SetupResultPanelProps {
  setupResult: CreateProjectResult | null;
  onViewProject: () => void;
}

export function SetupResultPanel({
  setupResult,
  onViewProject,
}: Readonly<SetupResultPanelProps>) {
  return (
    <aside className="result-panel">
      <h2>Latest Project</h2>
      <AnimatePresence mode="wait">
        {setupResult ? (
          <motion.div
            key={setupResult.repoUrl}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div className="result-repo-header">
              <span className="result-status-dot" aria-hidden="true" />
              <a
                href={setupResult.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="result-repo-name"
              >
                {setupResult.repoFullName}
              </a>
            </div>

            <div className="result-branches">
              {setupResult.branchesCreated.map((branch) => (
                <span key={branch} className="branch-chip">{branch}</span>
              ))}
            </div>

            <p className="helper-text" style={{ margin: 0 }}>
              Workflow: <strong>{setupResult.outputFileName}</strong>
            </p>
            <p className="helper-text" style={{ margin: 0 }}>
              Commit:{" "}
              {setupResult.githubCommitUrl ? (
                <a href={setupResult.githubCommitUrl} target="_blank" rel="noreferrer">
                  <code>{setupResult.githubCommitSha.slice(0, 10)}</code>
                </a>
              ) : (
                <code>{setupResult.githubCommitSha.slice(0, 10)}</code>
              )}
            </p>

            <div className="result-actions">
              <a className="primary-button" href={setupResult.repoUrl} target="_blank" rel="noreferrer">
                Open repo
              </a>
              <a
                className="ghost-button"
                href={`${setupResult.repoUrl}/blob/main/${setupResult.workflowPath}`}
                target="_blank"
                rel="noreferrer"
              >
                View workflow
              </a>
              <button className="ghost-button" type="button" onClick={onViewProject}>
                View history
              </button>
            </div>

            <p className="helper-text" style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>
              Workflow committed to <code>{setupResult.workflowPath}</code> on <code>main</code>.
              Push to <code>test</code> to trigger your first CI run.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="setup-placeholder"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.65rem",
              padding: "1.6rem 0.8rem",
              textAlign: "center",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "2.8rem",
                height: "2.8rem",
                borderRadius: "0.74rem",
                background: "rgba(59,142,240,0.08)",
                border: "1px solid rgba(59,142,240,0.2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </span>
            <p className="helper-text" style={{ maxWidth: "28ch", margin: 0 }}>
              Enter a repo name, choose a project type, and click Create GitHub Repository.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
