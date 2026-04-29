"use client";

import { AnimatePresence, motion } from "framer-motion";

import type { SetupProjectResponse } from "@/lib/api/contracts";

interface SetupResultPanelProps {
  setupResult: SetupProjectResponse | null;
  onViewProject: () => void;
}

export function SetupResultPanel({ setupResult, onViewProject }: Readonly<SetupResultPanelProps>) {
  return (
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
              <button className="ghost-button" type="button" onClick={onViewProject}>
                View project
              </button>
            </div>
            <p className="helper-text">
              Next step: push to the repository and confirm validate-access reaches /v1/ci/validate.
            </p>
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
  );
}
