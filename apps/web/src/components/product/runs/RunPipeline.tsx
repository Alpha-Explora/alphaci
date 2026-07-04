"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RunGroup, StageReport } from "@/lib/api/contracts";
import { StageNode, StageConnector } from "./StageNode";
import { MessageCard } from "./MessageCard";

const STAGE_ORDER: Array<StageReport["stage"]> = ["access", "quality", "package"];

interface RunPipelineProps {
  run: RunGroup;
  reduced: boolean;
}

export function RunPipeline({ run, reduced }: RunPipelineProps) {
  const [expandedStage, setExpandedStage] = useState<StageReport["stage"] | null>(null);

  // Build an ordered map of stages
  const stageMap = new Map(run.stages.map((s) => [s.stage, s]));

  function handleToggle(stage: StageReport["stage"]) {
    setExpandedStage((prev) => (prev === stage ? null : stage));
  }

  const expandedStageData = expandedStage ? stageMap.get(expandedStage) : null;

  // A connector is "active" (colored) when the stage to its left is success
  function connectorActive(afterIndex: number): boolean {
    const leftStage = STAGE_ORDER[afterIndex];
    return stageMap.get(leftStage)?.status === "success";
  }

  return (
    <div>
      {/* Pipeline row */}
      <div
        className="runs-pipeline-row"
        role="group"
        aria-label="Pipeline stages"
      >
        {STAGE_ORDER.map((stageName, index) => {
          const stage = stageMap.get(stageName);
          if (!stage) return null;

          return (
            <div key={stageName} className="runs-stage-wrap">
              <StageNode
                stage={stage}
                index={index}
                isExpanded={expandedStage === stageName}
                reduced={reduced}
                onToggle={() => handleToggle(stageName)}
              />
              {index < STAGE_ORDER.length - 1 && (
                <StageConnector
                  active={connectorActive(index)}
                  reduced={reduced}
                  delay={index * 0.1 + 0.25}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded messages panel */}
      <AnimatePresence>
        {expandedStageData && (
          <motion.div
            key={expandedStage}
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0, 0, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="runs-messages-panel"
            >
              {expandedStageData.friendlyMessages.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No messages for this stage.
                </p>
              ) : (
                expandedStageData.friendlyMessages.map((msg, i) => (
                  <MessageCard
                    key={i}
                    message={msg}
                    githubRunUrl={expandedStageData.githubRunUrl}
                  />
                ))
              )}

              {/* Raw logs — rendered only when the backend provides them */}
              {expandedStageData.rawLogs && (
                <details
                  style={{
                    marginTop: "0.35rem",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                  }}
                >
                  <summary
                    style={{
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      listStyle: "none",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    View raw logs
                  </summary>
                  <pre
                    style={{
                      margin: 0,
                      padding: "0.75rem",
                      fontSize: "0.72rem",
                      lineHeight: 1.6,
                      fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
                      color: "var(--text-secondary)",
                      background: "rgba(0,0,0,0.3)",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {expandedStageData.rawLogs}
                  </pre>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
