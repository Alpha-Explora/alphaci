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
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0,
          paddingBottom: "0.25rem",
        }}
      >
        {STAGE_ORDER.map((stageName, index) => {
          const stage = stageMap.get(stageName);
          if (!stage) return null;

          return (
            <div key={stageName} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
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
              style={{
                marginTop: "0.85rem",
                display: "grid",
                gap: "0.6rem",
                padding: "0.75rem",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "0.75rem",
                border: "1px solid var(--border-soft)",
              }}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
