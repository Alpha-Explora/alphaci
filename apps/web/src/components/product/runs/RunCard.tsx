"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { RunGroup } from "@/lib/api/contracts";
import { runStatusColors, relativeTime, shortSha } from "@/lib/runs/utils";
import { RunPipeline } from "./RunPipeline";

interface RunCardProps {
  run: RunGroup;
  index: number;
  reduced: boolean;
}

export function RunCard({ run, index, reduced }: RunCardProps) {
  const colors = runStatusColors(run.overallStatus);
  const repoName = run.repoFullName.split("/")[1] ?? run.repoFullName;
  const ownerName = run.repoFullName.split("/")[0] ?? "";
  const delay = index * 0.06;

  return (
    <motion.article
      className="runs-run-card"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0, 0, 1], delay }}
      style={{
        "--run-accent": colors.ring,
        "--run-glow": colors.glow,
      } as CSSProperties}
    >
      <div className="runs-card-accent" aria-hidden="true" />

      <div className="runs-card-header">
        <div className="runs-repo-block">
          <div className="runs-repo-title-row">
            <span className="runs-repo-icon" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3v12" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
            </span>
            <div className="runs-repo-name-wrap">
              <span className="runs-owner-name">{ownerName}</span>
              <span className="runs-repo-name">{repoName}</span>
            </div>
          </div>

          <div className="runs-card-meta">
            <span className="runs-meta-chip">{run.branch}</span>
            <span className="runs-meta-chip runs-meta-chip--mono">
              {shortSha(run.commitSha)}
            </span>
            <span className="runs-meta-time">{relativeTime(run.startedAt)}</span>
          </div>
        </div>

        <span
          className="runs-overall-badge"
          style={{
            color: colors.text,
            background: colors.bg,
            border: `1px solid ${colors.ring}`,
            boxShadow: `0 0 12px ${colors.glow}`,
          }}
        >
          <span aria-hidden="true" style={{ background: colors.ring }} />
          {colors.label}
        </span>
      </div>

      <RunPipeline run={run} reduced={reduced} />

      <div className="runs-card-footer">
        <p>
          {run.repoFullName}
        </p>
        <p>
          Select a stage for details
        </p>
      </div>
    </motion.article>
  );
}
