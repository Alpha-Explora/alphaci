"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PipelineLogo } from "@/components/layout/pipeline-logo";
import { FlowBackground } from "@/components/layout/flow-background";

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface PipelineLoaderProps {
  label?: string;
}

/* ── Stage config ───────────────────────────────────────────────────────────── */

const STAGES = [
  { id: "source",  label: "source",  color: "var(--brand)",         glow: "rgba(56,189,248,0.45)" },
  { id: "lint",    label: "lint",    color: "var(--accent-violet)",  glow: "rgba(167,139,250,0.45)" },
  { id: "test",    label: "test",    color: "var(--accent-teal)",    glow: "rgba(45,212,191,0.45)" },
  { id: "build",   label: "build",   color: "var(--accent-coral)",   glow: "rgba(251,113,133,0.45)" },
  { id: "deploy",  label: "deploy",  color: "var(--accent-amber)",   glow: "rgba(251,191,36,0.45)" },
];

const EASE_OUT: [number, number, number, number] = [0.25, 0, 0, 1];

/* ── PipelineLoader ─────────────────────────────────────────────────────────── */

export function PipelineLoader({ label = "Loading" }: Readonly<PipelineLoaderProps>) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pulsing, setPulsing] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const cycleInterval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STAGES.length);
      setPulsing(false);
      const pulseTimer = setTimeout(() => setPulsing(true), 60);
      return () => clearTimeout(pulseTimer);
    }, 520);

    return () => clearInterval(cycleInterval);
  }, [prefersReducedMotion]);

  const activeStage = STAGES[activeIndex];

  return (
    <main className="dash-shell pipeline-loader-shell">
      <FlowBackground />

      <div className="pipeline-loader-center" role="status" aria-label={label}>
        {/* Logo lockup */}
        <motion.div
          className="pipeline-loader-logo"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
        >
          <div
            className="pipeline-loader-logo-ring"
            style={prefersReducedMotion ? {} : {
              boxShadow: `0 0 28px ${activeStage?.glow ?? "rgba(56,189,248,0.45)"}`,
              borderColor: activeStage?.color ?? "var(--brand)",
              transition: "box-shadow 0.52s ease, border-color 0.52s ease",
            }}
          >
            <PipelineLogo size={28} />
          </div>
        </motion.div>

        {/* Label */}
        <motion.p
          className="pipeline-loader-label"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.12 }}
        >
          {label}
        </motion.p>

        {/* Stage track */}
        <motion.div
          className="pipeline-loader-track"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.22 }}
          aria-hidden="true"
        >
          {STAGES.map((stage, i) => {
            const isActive  = i === activeIndex;
            const isDone    = i < activeIndex;
            const isPending = i > activeIndex;
            return (
              <span key={stage.id} className="pipeline-loader-stage-group">
                {/* Node dot */}
                <span
                  className="pipeline-loader-node"
                  style={
                    prefersReducedMotion
                      ? { background: "var(--brand)", opacity: 0.8 }
                      : {
                          background: isDone
                            ? stage.color
                            : isActive
                            ? stage.color
                            : "var(--loader-track-mid)",
                          borderColor: isDone
                            ? stage.color
                            : isActive
                            ? stage.color
                            : "var(--loader-track-strong)",
                          boxShadow: isActive && pulsing
                            ? `0 0 14px ${stage.glow}`
                            : "none",
                          transform: isActive ? "scale(1.35)" : "scale(1)",
                          transition:
                            "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease",
                          opacity: isPending ? 0.35 : 1,
                        }
                  }
                />

                {/* Stage label under node */}
                <span
                  className="pipeline-loader-node-label"
                  style={
                    prefersReducedMotion
                      ? {}
                      : {
                          color: isActive
                            ? stage.color
                            : isDone
                            ? "var(--text-secondary)"
                            : "var(--text-muted)",
                          fontWeight: isActive ? 700 : 500,
                          transition: "color 0.3s ease, font-weight 0.1s",
                          opacity: isPending ? 0.4 : 1,
                        }
                  }
                >
                  {stage.label}
                </span>

                {/* Connector line (not after last stage) */}
                {i < STAGES.length - 1 && (
                  <span
                    className="pipeline-loader-connector"
                    style={
                      prefersReducedMotion
                        ? {}
                        : {
                            background: isDone
                              ? `linear-gradient(90deg, ${stage.color}, ${STAGES[i + 1]?.color ?? stage.color})`
                              : "var(--loader-track-mid)",
                            transition: "background 0.4s ease",
                          }
                    }
                    aria-hidden="true"
                  />
                )}
              </span>
            );
          })}
        </motion.div>

        {/* Traveling pulse line */}
        {!prefersReducedMotion && (
          <div className="pipeline-loader-pulse-line" aria-hidden="true">
            <motion.span
              className="pipeline-loader-pulse-dot"
              style={{ background: activeStage?.color ?? "var(--brand)" }}
              animate={{ x: ["0%", "100%"] }}
              transition={{ duration: 2.6, ease: "linear", repeat: Infinity }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
