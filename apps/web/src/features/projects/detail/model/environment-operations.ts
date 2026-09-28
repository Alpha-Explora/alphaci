import type { DeploymentTarget } from "@/shared/api/contracts";
import { providerDisplayName, providerPublicUrl } from "./provider-urls";

/**
 * What each project environment runs and what it may receive next, derived
 * from the backend's environments, releases, targets, and provider catalog.
 *
 * The backend decides every promotion. This only says which release the
 * previous environment runs, so the Promote action offers the one release
 * the backend would accept, and says why there is none when there is none.
 */

export type EnvironmentRole = "production" | "non_production";

export interface ProjectEnvironment {
  id: string;
  slug: string;
  displayName: string;
  sourceBranch: string;
  role: EnvironmentRole;
  position: number;
  autoDeploy: boolean;
}

export type EnvironmentDeploymentStatus =
  | "pending"
  | "deploying"
  | "healthy"
  | "failed"
  | "rolled_back";

export interface EnvironmentDeployment {
  id: string;
  environmentId: string;
  releaseId: string;
  trigger: "automatic" | "promotion";
  delivery?: "workflow" | "host";
  targetIds: string[];
  status: EnvironmentDeploymentStatus;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseArtifact {
  slot: string;
  image: string;
  digest: string;
}

export interface ProjectRelease {
  releaseId: string;
  sourceEnvironmentId: string;
  sourceBranch: string;
  commitSha: string;
  artifacts: ReleaseArtifact[];
  verificationStatus: "pending" | "verified";
  createdAt: string;
  deployments: EnvironmentDeployment[];
}

export interface DeploymentProviderSummary {
  id: string;
  label: string;
  enabled: boolean;
  capabilities: { connectivity: "direct" | "indirect" };
}

export interface EnvironmentDeploymentEntry {
  deployment: EnvironmentDeployment;
  release: ProjectRelease;
}

export interface EnvironmentTargetRow {
  id: string;
  slot: string;
  providerLabel: string;
  name: string;
  status: DeploymentTarget["status"];
  publicUrl: string | null;
}

export type PromotionOffer =
  | { kind: "automatic" }
  | { kind: "available"; release: ProjectRelease; from: ProjectEnvironment }
  | { kind: "unavailable"; reason: string };

export interface EnvironmentRow {
  environment: ProjectEnvironment;
  targets: EnvironmentTargetRow[];
  /** True when the environment's host pulls its releases (on-prem). */
  hostDelivered: boolean;
  current: EnvironmentDeploymentEntry | null;
  inFlight: EnvironmentDeploymentEntry | null;
  history: EnvironmentDeploymentEntry[];
  promotion: PromotionOffer;
}

const HISTORY_LIMIT = 5;
const IN_FLIGHT: ReadonlySet<EnvironmentDeploymentStatus> = new Set([
  "pending",
  "deploying",
]);

export function buildEnvironmentRows(input: {
  environments: readonly ProjectEnvironment[];
  releases: readonly ProjectRelease[];
  targets: readonly DeploymentTarget[];
  providers: readonly DeploymentProviderSummary[];
}): EnvironmentRow[] {
  const ordered = [...input.environments].sort(
    (left, right) => left.position - right.position,
  );
  const entries = deploymentEntries(input.releases);
  const rows = ordered.map((environment) =>
    environmentState(environment, entries, input),
  );
  return rows.map((row, index) => ({
    ...row,
    promotion: promotionOffer(row, rows[index - 1]),
  }));
}

/** Whether this deployment lets users register on-prem hosts. */
export function onpremHostsEnabled(
  providers: readonly DeploymentProviderSummary[],
): boolean {
  return providers.some(
    ({ enabled, capabilities }) =>
      enabled && capabilities.connectivity === "indirect",
  );
}

export function shortCommit(sha: string): string {
  return sha.slice(0, 7);
}

export function shortDigest(digest: string): string {
  return digest.replace(/^sha256:/, "").slice(0, 12);
}

const STATUS_LABELS: Record<EnvironmentDeploymentStatus, string> = {
  pending: "Waiting",
  deploying: "Deploying",
  healthy: "Healthy",
  failed: "Failed",
  rolled_back: "Rolled back",
};

export function deploymentStatusLabel(
  status: EnvironmentDeploymentStatus,
): string {
  return STATUS_LABELS[status];
}

/** Every deployment with its release, newest change first. */
function deploymentEntries(
  releases: readonly ProjectRelease[],
): EnvironmentDeploymentEntry[] {
  return releases
    .flatMap((release) =>
      release.deployments.map((deployment) => ({ deployment, release })),
    )
    .sort(
      (left, right) =>
        right.deployment.updatedAt.localeCompare(left.deployment.updatedAt) ||
        right.deployment.createdAt.localeCompare(left.deployment.createdAt),
    );
}

type EnvironmentState = Omit<EnvironmentRow, "promotion">;

function environmentState(
  environment: ProjectEnvironment,
  entries: readonly EnvironmentDeploymentEntry[],
  input: {
    targets: readonly DeploymentTarget[];
    providers: readonly DeploymentProviderSummary[];
  },
): EnvironmentState {
  const own = entries.filter(
    ({ deployment }) => deployment.environmentId === environment.id,
  );
  const targets = input.targets.filter(
    (target) => target.environmentId === environment.id,
  );
  return {
    environment,
    targets: targets.map((target) => targetRow(target, input.providers)),
    hostDelivered: targets.some(
      ({ provider }) =>
        providerSummary(provider, input.providers)?.capabilities
          .connectivity === "indirect",
    ),
    // The release an environment runs is its latest healthy deployment, as
    // the backend pins it.
    current:
      own.find(({ deployment }) => deployment.status === "healthy") ?? null,
    inFlight:
      own.find(({ deployment }) => IN_FLIGHT.has(deployment.status)) ?? null,
    history: own.slice(0, HISTORY_LIMIT),
  };
}

function promotionOffer(
  row: EnvironmentState,
  previous: EnvironmentState | undefined,
): PromotionOffer {
  if (!previous) return { kind: "automatic" };
  if (!previous.current) {
    return {
      kind: "unavailable",
      reason: previous.environment.displayName + " runs no release yet.",
    };
  }
  if (row.inFlight) {
    return { kind: "unavailable", reason: "A deployment is in progress." };
  }
  const release = previous.current.release;
  if (row.current?.release.releaseId === release.releaseId) {
    return {
      kind: "unavailable",
      reason:
        "Already runs " +
        shortCommit(release.commitSha) +
        ", the release " +
        previous.environment.displayName +
        " runs.",
    };
  }
  return { kind: "available", release, from: previous.environment };
}

function providerSummary(
  provider: string,
  providers: readonly DeploymentProviderSummary[],
): DeploymentProviderSummary | undefined {
  return providers.find(({ id }) => id === provider);
}

function targetRow(
  target: DeploymentTarget,
  providers: readonly DeploymentProviderSummary[],
): EnvironmentTargetRow {
  return {
    id: target.id,
    slot: target.slot,
    providerLabel:
      providerSummary(target.provider, providers)?.label ??
      providerDisplayName(target.provider),
    name: target.providerProjectName,
    status: target.status,
    publicUrl: providerPublicUrl(target),
  };
}
