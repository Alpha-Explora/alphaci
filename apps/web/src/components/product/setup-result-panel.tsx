"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { CreateProjectResponse } from "@/lib/api/contracts";

interface SetupResultPanelProps {
  setupResult: CreateProjectResponse | null;
  onViewProject: () => void;
}

export function SetupResultPanel({ setupResult, onViewProject }: Readonly<SetupResultPanelProps>) {
  return (
    <aside className="result-panel">
      <h2>Latest Project</h2>
      <AnimatePresence mode="wait">
        {setupResult ? (
          <motion.div
            key={setupResult.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="helper-text">
              Repo:{" "}
              <a href={setupResult.repoUrl} target="_blank" rel="noreferrer">
                {setupResult.repoFullName}
              </a>
            </p>
            <p className="helper-text">Workflow: {setupResult.workflowPath}</p>
            <p className="helper-text">Commit: {setupResult.githubCommitSha}</p>
            <div className="result-actions">
              <a className="ghost-button" href={setupResult.repoUrl} target="_blank" rel="noreferrer">
                Open repo
              </a>
              {setupResult.githubCommitUrl ? (
                <a className="ghost-button" href={setupResult.githubCommitUrl} target="_blank" rel="noreferrer">
                  Open commit
                </a>
              ) : null}
              <a className="ghost-button" href={`${setupResult.repoUrl}/actions`} target="_blank" rel="noreferrer">
                Open Actions
              </a>
              <button className="ghost-button" type="button" onClick={onViewProject}>
                View project
              </button>
            </div>
            <p className="helper-text">
              Push a commit to trigger the CI pipeline. The validate-access job calls /v1/ci/validate automatically.
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
              Link a GitHub App installation, choose a project type, and create a repo. Your result will appear here.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
