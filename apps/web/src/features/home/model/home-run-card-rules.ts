/* What a Home run card shows beyond its stage dots: each dot's tone, the one
 * line saying why a failed run failed, and where the card opens.
 * Pure: no React, no fetch. */

import { stripAnsi } from "@/shared/ui/strip-ansi";
import { RUN_STAGE_LABELS, RUN_STAGE_ORDER } from "./home-rules";
import { projectPageHref } from "./home-persona-rules";
import type { RunGroup, StageStatus } from "./home-types";
import type { FriendlyMessage, StageReport } from "@/shared/api/contracts";

const DOT_TONES: ReadonlySet<StageStatus> = new Set<StageStatus>([
  "success",
  "failure",
  "running",
  "cancelled",
  "pending",
  "blocked",
  "stalled",
]);

/** The dot class suffix for a stage status; anything unknown reads as pending. */
export function stageDotTone(status: StageStatus | string | null | undefined): StageStatus {
  return DOT_TONES.has(status as StageStatus) ? (status as StageStatus) : "pending";
}

export interface RunCardStage {
  id: StageReport["stage"];
  status: StageStatus;
}

/** The run's four stages in pipeline order; a stage the run never reported is pending. */
export function runCardStages(run: Pick<RunGroup, "stages">): RunCardStage[] {
  const byId = new Map(run.stages.map((stage) => [stage.stage, stage]));
  return RUN_STAGE_ORDER.map((id) => ({ id, status: stageDotTone(byId.get(id)?.status) }));
}

const FAILING: ReadonlySet<StageStatus> = new Set<StageStatus>(["failure", "stalled"]);

function failingStage(run: Pick<RunGroup, "stages">): StageReport | undefined {
  const ordered = RUN_STAGE_ORDER.map((id) => run.stages.find((stage) => stage.stage === id));
  return ordered.find((stage) => stage && FAILING.has(stage.status) && stage.friendlyMessages?.length);
}

function messageText(message: FriendlyMessage): string {
  return stripAnsi(message.title).trim() || stripAnsi(message.detail).trim();
}

function leadMessage(messages: ReadonlyArray<FriendlyMessage>): FriendlyMessage {
  return messages.find((message) => message.severity === "error") ?? messages[0];
}

/**
 * One line under a failed run: the first failing stage's own words, e.g.
 * "Quality: 3 tests failed". Null when the run did not fail or carries no
 * message for the stage that stopped it.
 */
export function runCardReason(run: Pick<RunGroup, "overallStatus" | "stages">): string | null {
  if (run.overallStatus !== "failure") return null;
  const stage = failingStage(run);
  if (!stage) return null;
  const text = messageText(leadMessage(stage.friendlyMessages));
  return text ? `${RUN_STAGE_LABELS[stage.stage]}: ${text}` : null;
}

/**
 * Where a run card opens: its repository's Pipeline tab in ALPHACI when the
 * repository belongs to a known Project (ids keyed by lower-case full name,
 * see repoProjectIds), else the runs page.
 */
export function runCardHref(
  run: Pick<RunGroup, "repoFullName">,
  projectIds: ReadonlyMap<string, string> | null | undefined,
): string {
  const id = projectIds?.get((run.repoFullName || "").toLowerCase());
  return id ? `${projectPageHref(id)}#pipeline` : "/runs";
}
