/* Rolling a service back to an earlier deploy. Pure: no React, no fetch. */
import type {
  DeploymentRollbackHold,
  DeploymentTarget,
  DeploymentTargetActionsResponse,
  ProjectDeploymentHistoryItem,
  RollbackDeploymentTargetResponse,
} from "@/shared/api/contracts";

/** Statuses of a deploy that went live: the one serving now, or one replaced since. */
const WENT_LIVE = new Set(["ready", "superseded"]);

export const ROLLBACK_REASON_MIN = 3;
export const ROLLBACK_REASON_MAX = 500;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** The Vercel rollback holding new production deploys on this target, if any. */
export function rollbackHold(target: Pick<DeploymentTarget, "providerMetadata">): DeploymentRollbackHold | null {
  const raw = target.providerMetadata?.["rollback"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const deployId = text(value.deployId);
  if (!deployId) return null;
  return {
    deployId,
    commitSha: text(value.commitSha),
    commitMessage: text(value.commitMessage),
    reason: text(value.reason) ?? "",
    rolledBackBy: text(value.rolledBackBy) ?? "",
    rolledBackAt: text(value.rolledBackAt) ?? "",
    holdsNewDeploys: value.holdsNewDeploys === true,
  };
}

function isProductionLane(deploy: Pick<ProjectDeploymentHistoryItem, "environment">): boolean {
  return (deploy.environment ?? "production") === "production";
}

/**
 * The deploy serving traffic on this target: the held rollback's, else the
 * newest one that went live (on Vercel, the newest production one). Deploys
 * arrive newest first.
 */
export function liveDeployId(
  target: Pick<DeploymentTarget, "id" | "provider" | "providerMetadata">,
  deploys: ReadonlyArray<ProjectDeploymentHistoryItem>,
): string | null {
  const hold = rollbackHold(target);
  if (hold) return hold.deployId;
  const live = deploys.find(
    (deploy) =>
      deploy.targetId === target.id &&
      deploy.status === "ready" &&
      (target.provider !== "vercel" || isProductionLane(deploy)),
  );
  return live?.id ?? null;
}

/**
 * Whether this row offers Roll back: the viewer may, the backend offers it for
 * the target, and the deploy went live, belongs to the target, is not live now
 * and, on Vercel, is a production deployment. The server checks all of it again.
 */
export function canRollBackTo(input: {
  allowed: boolean;
  actions: DeploymentTargetActionsResponse | undefined;
  target: Pick<DeploymentTarget, "id" | "provider" | "providerMetadata">;
  deploy: ProjectDeploymentHistoryItem;
  liveId: string | null;
}): boolean {
  const { deploy, target } = input;
  if (!input.allowed || !input.actions?.actions.rollback?.enabled) return false;
  if (deploy.targetId !== target.id || !WENT_LIVE.has(deploy.status)) return false;
  if (target.provider === "vercel" && !isProductionLane(deploy)) return false;
  return deploy.id !== input.liveId;
}

/** The reason, or what is wrong with it. */
export function rollbackReasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < ROLLBACK_REASON_MIN) return "Say why you are rolling back.";
  if (trimmed.length > ROLLBACK_REASON_MAX) return `Keep the reason under ${ROLLBACK_REASON_MAX} characters.`;
  return null;
}

/** What a rollback means on this provider, said before it happens. */
export function rollbackConsequence(provider: DeploymentTarget["provider"], branch: string | null): string {
  const on = branch ? `on ${branch} ` : "";
  if (provider === "vercel") {
    return `The code ${on}does not change. New production deploys wait until you resume deploys; then the newest one goes live again, so merge a revert first if the bad change must not come back.`;
  }
  return `The code ${on}does not change. The next deploy from the pipeline puts the newest code back live, so merge a revert if the bad change must not come back.`;
}

/** The status line after a rollback. */
export function rollbackDoneMessage(
  target: Pick<DeploymentTarget, "providerProjectName">,
  sha: string | null,
  response: Pick<RollbackDeploymentTargetResponse, "rollback">,
): string {
  const to = sha ? `${sha}` : "the chosen deploy";
  const held = response.rollback?.holdsNewDeploys ? " New production deploys wait until you resume deploys." : "";
  return `${target.providerProjectName} is rolling back to ${to}.${held}`;
}

/** The status line after a hold is resumed. */
export function resumeDoneMessage(target: Pick<DeploymentTarget, "providerProjectName">): string {
  return `Deploys resumed: the newest production deploy of ${target.providerProjectName} is live again.`;
}

/** The target with the hold the server reported, set or cleared. */
export function withRollbackHold<T extends Pick<DeploymentTarget, "providerMetadata">>(
  target: T,
  hold: DeploymentRollbackHold | null,
): T {
  const metadata: Record<string, unknown> = { ...(target.providerMetadata ?? {}) };
  if (hold) metadata["rollback"] = hold;
  else delete metadata["rollback"];
  return { ...target, providerMetadata: metadata };
}
