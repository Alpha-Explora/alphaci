"use client";

import { motion } from "framer-motion";
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
  const delay = index * 0.06;

  return (
    <motion.article
      className="runs-run-card glass-panel"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 0, 0, 1], delay }}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "clamp(1.1rem, 2vw, 1.5rem)",
        display: "grid",
        gap: "1rem",
      }}
    >
      {/* Status-colored top border accent */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: colors.ring,
          boxShadow: `0 0 18px ${colors.glow}`,
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
        }}
      />

      {/* Card header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", minWidth: 0 }}>
          {/* Repo + branch */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "22ch",
              }}
            >
              {repoName}
            </span>
            {/* Branch chip */}
            <span
              className="runs-branch-chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.7rem",
                fontFamily: "ui-monospace, monospace",
                fontWeight: 600,
                color: "var(--accent-violet)",
                background: "var(--accent-violet-light)",
                border: "1px solid var(--border-violet)",
                borderRadius: "var(--radius-pill)",
                padding: "0.15rem 0.5rem",
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {run.branch}
            </span>
          </div>

          {/* Commit + time */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span
              style={{
                fontSize: "0.7rem",
                fontFamily: "ui-monospace, monospace",
                color: "var(--text-muted)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-soft)",
                borderRadius: "0.3rem",
                padding: "0.1rem 0.35rem",
              }}
            >
              {shortSha(run.commitSha)}
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {relativeTime(run.startedAt)}
            </span>
          </div>
        </div>

        {/* Overall status badge */}
        <span
          className="runs-overall-badge"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: colors.text,
            background: colors.bg,
            border: `1px solid ${colors.ring}`,
            borderRadius: "var(--radius-pill)",
            padding: "0.22rem 0.65rem",
            flexShrink: 0,
            boxShadow: `0 0 12px ${colors.glow}`,
          }}
        >
          {colors.label}
        </span>
      </div>

      {/* Pipeline */}
      <RunPipeline run={run} reduced={reduced} />

      {/* Separator + hint */}
      <div style={{
        borderTop: "1px solid var(--border-soft)",
        paddingTop: "0.65rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        flexWrap: "wrap",
      }}>
        <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>
          {run.repoFullName}
        </p>
        <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--text-muted)" }}>
          Click a stage node to see details
        </p>
      </div>
    </motion.article>
  );
}
