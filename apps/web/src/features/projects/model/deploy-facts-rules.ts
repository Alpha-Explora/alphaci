import type {
  DeploymentHistoryStatus,
  ProjectBranchPreview,
  ProjectDeploymentHistoryItem,
} from "@/shared/api/contracts";

/*
 * How one deploy reads wherever it is listed: the Overview's environment
 * cards and the Hosting tab's deploy rows say the same words for the same
 * deploy. Pure rules; the views draw what these return.
 */

const DEPLOY_STATUS_WORDS: Record<DeploymentHistoryStatus, string> = {
  queued: "Queued",
  building: "Building",
  ready: "Live",
  failed: "Failed",
  canceled: "Canceled",
  superseded: "Replaced",
  unknown: "Unknown",
};

/** "Live", "Replaced", "Failed"…; a status this app does not know reads as itself. */
export function deployStatusWord(status: string): string {
  return DEPLOY_STATUS_WORDS[status as DeploymentHistoryStatus] ?? status;
}

export type DeployDotTone = "ok" | "pending" | "danger" | "idle";

/** A listed deploy's dot: a replaced or unknown deploy is quiet, not amber. */
export function deployDotTone(status: string): DeployDotTone {
  if (status === "ready") return "ok";
  if (status === "failed" || status === "canceled") return "danger";
  if (status === "queued" || status === "building") return "pending";
  return "idle";
}

const TRIGGER_WORDS: Readonly<Record<string, string>> = {
  api: "API",
  new_commit: "New commit",
  manual: "Manual",
  deploy_hook: "Deploy hook",
  rollback: "Rollback",
  blueprint_sync: "Blueprint sync",
  service_resumed: "Service resumed",
  service_updated: "Service updated",
};

/** "API", "New commit"; an unknown word with its underscores spaced out; null when the host did not say. */
export function deployTriggerLabel(trigger: string | null | undefined): string | null {
  const word = trigger?.trim();
  if (!word) return null;
  const known = TRIGGER_WORDS[word.toLowerCase()];
  if (known) return known;
  const spaced = word.replace(/_/g, " ");
  return `${spaced.slice(0, 1).toUpperCase()}${spaced.slice(1)}`;
}

/**
 * How long a finished deploy took, "20s" or "1m 05s", from when the host began
 * it (or, without that, when it was created) to when it finished. Null while
 * it runs, or when the times do not parse.
 */
export function deployDurationLabel(
  deploy: { createdAt: string | null; startedAt?: string | null; readyAt: string | null },
): string | null {
  const start = Date.parse(deploy.startedAt ?? deploy.createdAt ?? "");
  const end = Date.parse(deploy.readyAt ?? "");
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * The Hosting deploy rows, with the commit message the branch previews
 * already looked up where the host sent none (a Render image deploy).
 */
export function withPreviewCommitMessages(
  deploys: ReadonlyArray<ProjectDeploymentHistoryItem>,
  previews: ReadonlyArray<ProjectBranchPreview> | null,
): ProjectDeploymentHistoryItem[] {
  const messages = new Map<string, string>();
  for (const preview of previews ?? []) {
    for (const deploy of preview.recentDeploys ?? []) {
      if (deploy.commitMessage) messages.set(deploy.id, deploy.commitMessage);
    }
  }
  return deploys.map((deploy) =>
    deploy.commitMessage || !messages.has(deploy.id)
      ? deploy
      : { ...deploy, commitMessage: messages.get(deploy.id) ?? null },
  );
}
