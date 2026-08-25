"use client";

import { motion, useReducedMotion } from "framer-motion";

/* ── Stage motif icons (shared visual language with the /runs pipeline) ──── */

function AccessMotif() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function QualityMotif() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function PackageMotif() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

const GATE_STAGES = [
  {
    key: "access",
    label: "Access",
    description:
      "Confirms the pipeline can reach the repository and required secrets exist.",
    Icon: AccessMotif,
  },
  {
    key: "quality",
    label: "Quality",
    description:
      "Runs lint, type checks, unit tests, coverage, and security scans.",
    Icon: QualityMotif,
  },
  {
    key: "package",
    label: "Package",
    description: "Builds and ships the artifact to its deploy target.",
    Icon: PackageMotif,
  },
] as const;

const PROMOTION_RUNGS = ["uat", "main"] as const;

export type FlowExplainerVariant = "full" | "compact";

interface FlowExplainerProps {
  /**
   * "full" shows gated stages + promotion ladder + deploy line (guide, empty state).
   * "compact" shows only the gated-stage row, sized for tighter spaces (welcome modal).
   */
  variant?: FlowExplainerVariant;
  /** Optional heading rendered above the stages. Pass null to omit entirely. */
  heading?: string | null;
  className?: string;
}

/**
 * Shared visual explainer for ALPHACI's core mental model:
 * 3 gated stages (Access -> Quality -> Package) and the uat -> main
 * promotion ladder, with a short Render/Vercel deploy note.
 *
 * Reuses the motif iconography and connector language from the /runs pipeline
 * visualization (StageNode/StageConnector) but is status-agnostic — there is
 * no live run behind this, so it never claims success/failure, only explains
 * what each stage *does*.
 */
export function FlowExplainer({
  variant = "full",
  heading = "How ALPHACI works",
  className,
}: FlowExplainerProps) {
  const reduced = useReducedMotion();

  return (
    <div className={["flow-explainer", className].filter(Boolean).join(" ")}>
      {heading ? <p className="flow-explainer__heading">{heading}</p> : null}

      {/* Gated stage row */}
      <div
        className="flow-explainer__stages"
        role="group"
        aria-label="The three gated pipeline stages"
      >
        {GATE_STAGES.map((stage, index) => (
          <div key={stage.key} className="flow-explainer__stage-wrap">
            <motion.div
              className="flow-explainer__stage"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0, 0, 1],
                delay: index * 0.1,
              }}
            >
              <span className="flow-explainer__stage-icon" aria-hidden="true">
                <stage.Icon />
              </span>
              <span className="flow-explainer__stage-label">{stage.label}</span>
              {variant === "full" ? (
                <span className="flow-explainer__stage-desc">
                  {stage.description}
                </span>
              ) : null}
            </motion.div>
            {index < GATE_STAGES.length - 1 ? (
              <span className="flow-explainer__connector" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>

      {variant === "full" ? (
        <>
          {/* Promotion ladder */}
          <div
            className="flow-explainer__promotion"
            role="group"
            aria-label="Branch promotion flow"
          >
            {PROMOTION_RUNGS.map((rung, index) => (
              <div key={rung} className="flow-explainer__rung-wrap">
                <span className="flow-explainer__rung">{rung}</span>
                {index < PROMOTION_RUNGS.length - 1 ? (
                  <span
                    className="flow-explainer__rung-arrow"
                    aria-hidden="true"
                  >
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="flow-explainer__deploy-note">
            Every project passes through these gates on each branch, then
            deploys automatically — backend to <strong>Render</strong>, frontend
            to <strong>Vercel</strong>.
          </p>
        </>
      ) : null}
    </div>
  );
}
