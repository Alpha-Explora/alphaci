"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FriendlyMessage, RunGroup, StageReport } from "../../model/runs-types";
import { StageNode, StageConnector } from "./stage-node";
import { MessageCard } from "./message-card";

const STAGE_ORDER: Array<StageReport["stage"]> = ["access", "quality", "package"];

interface RunPipelineProps {
  run: RunGroup;
  reduced: boolean;
}

function preferredStage(run: RunGroup): StageReport["stage"] | null {
  return (
    run.stages.find((stage) => stage.status === "failure")?.stage ??
    run.stages.find((stage) => stage.status === "running")?.stage ??
    null
  );
}

function fallbackStageMessage(stage: StageReport): FriendlyMessage {
  if (stage.status === "failure") {
    const guidance: Record<StageReport["stage"], { title: string; detail: string; hint: string }> = {
      access: {
        title: "Access check failed before details were reported",
        detail: "ALPHACI received the failed result but GitHub did not provide the failed job output for this commit.",
        hint: "Open the GitHub workflow, fix the first failed access step, then re-run. Check the ALPHACI_TOKEN secret and GitHub App repository access first.",
      },
      quality: {
        title: "Quality check failed before details were reported",
        detail: "ALPHACI received the failed result but GitHub did not provide test, lint, typecheck, or scan details for this commit.",
        hint: "Open the GitHub workflow, fix the first failed quality step, then re-run. New ALPHACI workflows report the failed job name here automatically.",
      },
      package: {
        title: "Build or package check failed before details were reported",
        detail: "ALPHACI received the failed result but GitHub did not provide the failed build step for this commit.",
        hint: "Open the GitHub workflow, fix the first failed build or package step, then re-run the workflow.",
      },
    };
    return { severity: "error", ...guidance[stage.stage] };
  }

  if (stage.status === "pending") {
    return {
      severity: "info",
      title: "This stage has not started",
      detail: "It is waiting for the earlier workflow stages to finish.",
      hint: "No action is needed unless an earlier stage fails.",
    };
  }

  if (stage.status === "cancelled") {
    return {
      severity: "warning",
      title: "This stage was cancelled",
      detail: "The workflow stopped before this stage could complete.",
      hint: "Fix the earlier failed stage, then re-run the workflow.",
    };
  }

  return {
    severity: "success",
    title: "This stage completed successfully",
    detail: "GitHub did not send additional details for this completed stage.",
    hint: "No action is needed.",
  };
}

export function RunPipeline({ run, reduced }: RunPipelineProps) {
  const [expandedStage, setExpandedStage] = useState<StageReport["stage"] | null>(() => preferredStage(run));

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
            <div key={stageName} className="runs-stage-segment">
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
              {(expandedStageData.friendlyMessages.length > 0
                ? expandedStageData.friendlyMessages
                : [fallbackStageMessage(expandedStageData)]
              ).map((msg, i) => (
                  <MessageCard
                    key={i}
                    message={msg}
                    githubRunUrl={expandedStageData.githubRunUrl}
                  />
                ))}

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
