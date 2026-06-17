"use client";

import { motion } from "framer-motion";
import type { StageReport } from "@/lib/api/contracts";
import { stageStatusColors, stageLabel } from "@/lib/runs/utils";

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

/* ── Stage node motif icons (access / quality / package) ────────────────── */

function AccessMotif() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function QualityMotif() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function PackageMotif() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
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
      className="runs-connector"
      aria-hidden="true"
      style={{ position: "relative", flex: "1 1 0%", minWidth: 32, maxWidth: 72, height: 2 }}
    >
      {/* base track */}
      <div
        style={{
          position: "absolute",
          inset: "50% 0 50% 0",
          transform: "translateY(-50%)",
          height: 2,
          background: "var(--border-soft)",
          borderRadius: 1,
        }}
      />
      {/* animated fill */}
      {!reduced && active ? (
        <motion.div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            height: 2,
            borderRadius: 1,
            background: "linear-gradient(90deg, var(--brand), var(--success))",
            transformOrigin: "left center",
            transform: "translateY(-50%)",
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0, 0, 1], delay }}
        />
      ) : active ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 2,
            borderRadius: 1,
            background: "linear-gradient(90deg, var(--brand), var(--success))",
            transform: "translateY(-50%)",
          }}
        />
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      {/* The clickable ring node */}
      <motion.button
        type="button"
        className="runs-stage-node"
        aria-label={`${label} stage — ${stage.status}. ${isExpanded ? "Collapse" : "Expand"} details`}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        initial={reduced ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.25, 0, 0, 1], delay }}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        style={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: `2.5px solid ${colors.ring}`,
          background: colors.bg,
          boxShadow: `0 0 18px ${colors.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.iconColor,
          flexShrink: 0,
          outline: "none",
          transition: "box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* Focus ring */}
        <span
          className="runs-stage-focus-ring"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `2px solid ${colors.ring}`,
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
        />
        {/* Stage motif icon (top-left corner) */}
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 4,
            color: colors.iconColor,
            opacity: 0.6,
          }}
        >
          {stage.stage === "access" && <AccessMotif />}
          {stage.stage === "quality" && <QualityMotif />}
          {stage.stage === "package" && <PackageMotif />}
        </span>
        {/* Status icon */}
        <StageIcon status={stage.status} iconColor={colors.iconColor} />
      </motion.button>

      {/* Label below */}
      <motion.span
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.1, duration: 0.25 }}
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isExpanded ? colors.ring : "var(--text-muted)",
          transition: "color 0.18s ease",
          userSelect: "none",
        }}
      >
        {label}
      </motion.span>
    </div>
  );
}
