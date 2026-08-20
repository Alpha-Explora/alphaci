"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { StageReport } from "../../model/runs-types";
import { stageStatusColors, stageLabel } from "../../model/runs-presentation";

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SpinnerIcon({ color }: { color: string }) {
  return (
    <span
      role="status"
      aria-label="Running"
      style={{
        display: "block",
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: `2px solid rgba(255,255,255,0.15)`,
        borderTopColor: color,
        animation: "runs-spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Stage node icon selector ────────────────────────────────────────────── */

function StageIcon({ status, iconColor }: { status: StageReport["status"]; iconColor: string }) {
  switch (status) {
    case "success":
      return <CheckIcon />;
    case "failure":
      return <XIcon />;
    case "running":
      return <SpinnerIcon color={iconColor} />;
    case "cancelled":
    case "pending":
      return <ClockIcon />;
  }
}

/* ── Connector SVG with animated draw-on ────────────────────────────────── */

interface ConnectorProps {
  active: boolean;
  reduced: boolean;
  delay: number;
}

export function StageConnector({ active, reduced, delay }: ConnectorProps) {
  return (
    <div
      className={`runs-connector ${active ? "runs-connector--active" : ""}`}
      aria-hidden="true"
    >
      {!reduced && active ? (
        <motion.div
          className="runs-connector-fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0, 0, 1], delay }}
        />
      ) : active ? (
        <div className="runs-connector-fill" />
      ) : null}
    </div>
  );
}

/* ── Stage node ──────────────────────────────────────────────────────────── */

interface StageNodeProps {
  stage: StageReport;
  index: number;
  isExpanded: boolean;
  reduced: boolean;
  onToggle: () => void;
}

export function StageNode({ stage, index, isExpanded, reduced, onToggle }: StageNodeProps) {
  const colors = stageStatusColors(stage.status);
  const label = stageLabel(stage.stage);
  const delay = index * 0.1;

  return (
    <motion.button
      type="button"
      className={`runs-stage-node ${isExpanded ? "runs-stage-node--expanded" : ""}`}
      aria-label={`${label} stage: ${stage.status}. ${isExpanded ? "Collapse" : "Expand"} details`}
      aria-expanded={isExpanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.25, 0, 0, 1], delay }}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      style={
        {
          "--stage-ring": colors.ring,
          "--stage-bg": colors.bg,
          "--stage-glow": colors.glow,
          "--stage-icon": colors.iconColor,
        } as CSSProperties
      }
    >
      <span className="runs-stage-icon" aria-hidden="true">
        <StageIcon status={stage.status} iconColor={colors.iconColor} />
      </span>
      <span className="runs-stage-text">
        <span>{label}</span>
        <strong>{stage.status}</strong>
      </span>
      <span className="runs-stage-open-indicator" aria-hidden="true">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </motion.button>
  );
}
