"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface GeneratingOverlayProps {
  isVisible: boolean;
}

/** Animated ellipsis that cycles . → .. → ... */
function AnimatedDots() {
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{ display: "inline-block", minWidth: "1.5rem", textAlign: "left" }}>
      {".".repeat(dots)}
    </span>
  );
}

const PIPELINE_STAGES = ["Source", "Build", "Test", "Deploy"] as const;
const NODE_CX = [28, 84, 140, 196];
const CONNECTOR_X_START = [38, 94, 150];
const CONNECTOR_WIDTH = 36;

function PipelineProgressNodes() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % PIPELINE_STAGES.length);
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <svg
      width="224"
      height="72"
      viewBox="0 0 224 72"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {/* Connector lines */}
      {CONNECTOR_X_START.map((x, i) => (
        <line
          key={`conn-${i}`}
          x1={x}
          y1={28}
          x2={x + CONNECTOR_WIDTH}
          y2={28}
          stroke={i < activeIdx ? "rgba(88, 166, 255,0.7)" : "rgba(88, 166, 255,0.15)"}
          strokeWidth="1.5"
          strokeDasharray={i === activeIdx - 1 ? "4 3" : "none"}
          style={{ transition: "stroke 0.3s ease" }}
        />
      ))}

      {/* Nodes */}
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = i === activeIdx;
        const isPassed = i < activeIdx;
        return (
          <g key={stage}>
            {/* Outer glow ring — only on active */}
            {isActive && (
              <motion.circle
                cx={NODE_CX[i]}
                cy={28}
                r={15}
                fill="none"
                stroke="rgba(88, 166, 255,0.25)"
                strokeWidth="1"
                initial={{ r: 12, opacity: 0.6 }}
                animate={{ r: [12, 16, 12], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.2, ease: "easeOut", repeat: Infinity }}
              />
            )}
            {/* Main circle */}
            <motion.circle
              cx={NODE_CX[i]}
              cy={28}
              r={10}
              fill={
                isActive
                  ? "rgba(88, 166, 255,0.15)"
                  : isPassed
                  ? "rgba(52,211,153,0.12)"
                  : "rgba(17, 17, 22,0.6)"
              }
              stroke={
                isActive
                  ? "rgba(88, 166, 255,0.9)"
                  : isPassed
                  ? "rgba(52,211,153,0.6)"
                  : "rgba(255,255,255,0.12)"
              }
              strokeWidth="1.5"
              animate={{
                filter: isActive
                  ? "drop-shadow(0 0 6px rgba(88, 166, 255,0.8))"
                  : "none",
              }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            />
            {/* Check mark for passed nodes */}
            {isPassed && (
              <motion.path
                d={`M ${NODE_CX[i] - 4} 28 L ${NODE_CX[i] - 1} 31 L ${NODE_CX[i] + 5} 24`}
                fill="none"
                stroke="rgba(52,211,153,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.22 }}
              />
            )}
            {/* Active dot */}
            {isActive && (
              <motion.circle
                cx={NODE_CX[i]}
                cy={28}
                r={3}
                fill="rgba(88, 166, 255,0.9)"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
            {/* Label */}
            <text
              x={NODE_CX[i]}
              y={50}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              letterSpacing="0.05em"
              fill={
                isActive
                  ? "rgba(88, 166, 255,0.9)"
                  : isPassed
                  ? "rgba(52,211,153,0.7)"
                  : "rgba(116, 116, 127,0.6)"
              }
              style={{ transition: "fill 0.3s ease" }}
            >
              {stage.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GeneratingOverlay({ isVisible }: GeneratingOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="generating-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10, 10, 14, 0.85)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {/* Floating card */}
          <motion.div
            role="status"
            aria-label="Generating repository, please wait"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
              maxWidth: "400px",
              width: "calc(100% - 3rem)",
              padding: "2.5rem 2rem",
              background: "rgba(17, 17, 22, 0.92)",
              border: "1px solid rgba(88, 166, 255, 0.25)",
              borderRadius: "1.25rem",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.8), 0 0 40px rgba(88, 166, 255, 0.05)",
            }}
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.9 }}
          >
            <PipelineProgressNodes />

            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: "0 0 0.45rem",
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  color: "var(--text-primary, #f2f2f4)",
                  letterSpacing: "-0.01em",
                }}
              >
                Generating repository<AnimatedDots />
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--text-muted, rgba(162, 162, 172, 0.75))",
                  lineHeight: 1.55,
                }}
              >
                Setting up branches, committing workflow
              </p>
            </div>

            {/* Subtle ambient glow bar at bottom */}
            <div
              style={{
                width: "100%",
                height: "3px",
                borderRadius: "2px",
                background: "linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.6), transparent)",
                backgroundSize: "200% 100%",
                animation: "glow-sweep 1.8s linear infinite",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
