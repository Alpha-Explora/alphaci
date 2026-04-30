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
              Next step: open Actions or push to the repository once Phase 4 validation is available.
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="setup-placeholder"
            className="helper-text"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Link an all-repositories GitHub App installation, choose a project type, and create a repo.
          </motion.p>
        )}
      </AnimatePresence>
    </aside>
  );
}
