/**
 * On-prem hosting in the create wizard: whether the deployment offers it, where
 * each environment runs, and the creation targets that choice sends.
 *
 * Pure functions only. The backend stays the authority; these rules only make
 * sure the wizard never sends a request it would refuse (an environment with
 * both on-prem and hosted targets).
 */
import type {
  CreateDeploymentProvisioningRequest,
  EnvTargetSlot,
  OnpremProvisioningTargetRequest,
} from "@/shared/api/contracts";
import type { EnvironmentDraft, EnvironmentRunsOn } from "./project-environments-rules";
import { inferSingleProjectKind, projectKindToSlot } from "./setup-tab-rules";

export const ONPREM_PROVIDER_ID = "onprem-compose";

export const ONPREM_DISABLED_FALLBACK_REASON =
  "On-prem hosting is not turned on for this deployment.";

export const ALL_ONPREM_DELIVERY_NOTICE =
  "Every environment runs on your on-prem host. After the project is created, register the host on the project's Hosting tab.";

/** One entry of `GET /deployment-providers`, as far as the wizard reads it. */
export interface DeploymentProviderAvailability {
  id: string;
  label?: string;
  enabled: boolean;
  reason?: string;
  supportedSlots?: string[];
}

/**
 * hidden: the backend does not list on-prem (an older backend) or the read
 * failed, so the wizard is exactly as before. disabled: listed but off, with
 * the server's reason. enabled: offered.
 */
export type OnpremHosting =
  | { status: "hidden" }
  | { status: "disabled"; reason: string }
  | { status: "enabled" };

export function onpremHostingFrom(
  providers: readonly DeploymentProviderAvailability[] | null,
): OnpremHosting {
  const onprem = providers?.find(({ id }) => id === ONPREM_PROVIDER_ID);
  if (!onprem) return { status: "hidden" };
  if (onprem.enabled === true) return { status: "enabled" };
  return {
    status: "disabled",
    reason: onprem.reason?.trim() || ONPREM_DISABLED_FALLBACK_REASON,
  };
}

export function isOnpremEnvironment(environment: EnvironmentDraft): boolean {
  return environment.runsOn === "onprem";
}

export function setEnvironmentRunsOn(
  environments: readonly EnvironmentDraft[],
  index: number,
  runsOn: EnvironmentRunsOn,
): EnvironmentDraft[] {
  return environments.map((environment, position) =>
    position === index ? { ...environment, runsOn } : environment,
  );
}

export function runEveryEnvironmentOnprem(
  environments: readonly EnvironmentDraft[],
): EnvironmentDraft[] {
  return environments.map((environment) => ({ ...environment, runsOn: "onprem" }));
}

export type HostingMode = "managed" | "mixed" | "onprem";

export interface EnvironmentHosting {
  mode: HostingMode;
  /**
   * Every environment the project is created with, in promotion order; empty
   * when it has none of its own (not defined, or a two-repository shape).
   */
  environments: readonly EnvironmentDraft[];
  /** The environments that run on the on-prem host, in promotion order. */
  onprem: EnvironmentDraft[];
  /** The environments on managed hosting, in promotion order. */
  managed: EnvironmentDraft[];
}

/**
 * Where the project's environments run. A single application or a
 * two-repository project with its environments defined, on a deployment that
 * offers on-prem, can choose; everything else is managed hosting exactly as
 * before.
 */
export interface EnvironmentHostingInput {
  environments: readonly EnvironmentDraft[];
  environmentsEnabled: boolean;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  onpremStatus: OnpremHosting["status"];
}

/**
 * Two services in one repository create no environments of their own; a
 * single application and a two-repository project do.
 */
function definedEnvironments(input: EnvironmentHostingInput): readonly EnvironmentDraft[] {
  if (!input.environmentsEnabled) return [];
  return input.isMicroservicesShape ? [] : input.environments;
}

export function environmentHosting(input: EnvironmentHostingInput): EnvironmentHosting {
  const environments = definedEnvironments(input);
  const onprem =
    input.onpremStatus === "enabled" ? environments.filter(isOnpremEnvironment) : [];
  const managed = environments.filter((environment) => !onprem.includes(environment));
  return {
    mode: hostingMode(onprem.length, managed.length),
    environments,
    onprem,
    managed,
  };
}

function hostingMode(onpremCount: number, managedCount: number): HostingMode {
  if (onpremCount === 0) return "managed";
  return managedCount === 0 ? "onprem" : "mixed";
}

/**
 * The Render-variable rule applies to managed hosting only. With every
 * environment on-prem there is no Render service to configure.
 */
export function renderVariablesBlocking(missing: boolean, mode: HostingMode): boolean {
  return missing && mode !== "onprem";
}

/**
 * The project's deployable slots: the slots the hosted configuration already
 * produces targets for, else the one slot the project type deploys as.
 */
export function deployableSlots(
  deploymentProvisioning: CreateDeploymentProvisioningRequest | undefined,
  selectedProjectKind: "frontend" | "backend",
): EnvTargetSlot[] {
  const slots = deploymentProvisioning?.enabled
    ? [...new Set(deploymentProvisioning.targets.map(({ slot }) => slot))]
    : [];
  return slots.length > 0 ? slots : [projectKindToSlot(selectedProjectKind)];
}

/**
 * The slots on-prem targets are sent for, or undefined when the deployment
 * does not offer on-prem (the payload then ignores every "Runs on").
 */
export function onpremSlotsFor(input: {
  status: OnpremHosting["status"];
  deploymentProvisioning: CreateDeploymentProvisioningRequest | undefined;
  selectedProjectType: { kind?: "frontend" | "backend" } | null | undefined;
  selectedProjectTypeId: string;
}): EnvTargetSlot[] | undefined {
  if (input.status !== "enabled") return undefined;
  const kind = inferSingleProjectKind({
    selectedProjectTypeKind: input.selectedProjectType?.kind,
    selectedProjectTypeId: input.selectedProjectTypeId,
  });
  return deployableSlots(input.deploymentProvisioning, kind);
}

function onpremTarget(
  slot: EnvTargetSlot,
  environmentSlug: string,
): OnpremProvisioningTargetRequest {
  return { slot, provider: ONPREM_PROVIDER_ID, ownershipMode: "byo", environmentSlug };
}

/**
 * The deployment provisioning to send once each environment's "Runs on" is
 * known.
 *
 * - No environment on-prem: `deploymentProvisioning` unchanged (the same
 *   object), so the request is exactly what it was before on-prem existed.
 * - Some on-prem: the hosted (shared) targets stay for the managed
 *   environments, and each on-prem environment gets its own on-prem target for
 *   every slot, which replaces the shared target there, so no environment
 *   mixes on-prem and hosted delivery.
 * - All on-prem: only on-prem targets, one per environment and slot. They are
 *   scoped rather than shared on purpose: with no hosted target for a slot the
 *   backend adds its default managed one (Render or Vercel) as a SHARED
 *   target, and a shared on-prem target would then sit beside it in every
 *   environment. A scoped target replaces that default in its environment.
 *
 * Slugs are trimmed exactly as the environments themselves are sent.
 */
export function withOnpremTargets(
  deploymentProvisioning: CreateDeploymentProvisioningRequest | undefined,
  environments: readonly EnvironmentDraft[],
  slots: readonly EnvTargetSlot[],
): CreateDeploymentProvisioningRequest | undefined {
  const onprem = environments.filter(isOnpremEnvironment);
  if (onprem.length === 0) return deploymentProvisioning;
  const scoped = onprem.flatMap((environment) =>
    slots.map((slot) => onpremTarget(slot, environment.slug.trim())),
  );
  if (onprem.length === environments.length) {
    return { enabled: true, targets: scoped };
  }
  return {
    ...deploymentProvisioning,
    enabled: true,
    targets: [...(deploymentProvisioning?.targets ?? []), ...scoped],
  };
}

export function environmentName(environment: EnvironmentDraft): string {
  return environment.displayName.trim() || environment.slug.trim() || "Environment";
}

function listNames(environments: readonly EnvironmentDraft[]): string {
  const names = environments.map(environmentName);
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names.at(-1);
}

/** The Delivery step's line for a project with some environments on-prem. */
export function mixedHostingLine(hosting: EnvironmentHosting): string {
  const verb = hosting.onprem.length === 1 ? "runs" : "run";
  return (
    listNames(hosting.onprem) +
    " " +
    verb +
    " on your on-prem host; register the host on the project's Hosting tab after the project is created. The hosting below applies to " +
    listNames(hosting.managed) +
    "."
  );
}

export function runsOnLabel(runsOn: EnvironmentRunsOn): string {
  return runsOn === "onprem" ? "On-prem host" : "Managed hosting";
}

/** The Review step's "where each environment runs" line, in promotion order. */
export function environmentsRunOnSummary(hosting: EnvironmentHosting): string {
  const onprem = new Set(hosting.onprem);
  return hosting.environments
    .map(
      (environment) =>
        environmentName(environment) +
        ": " +
        runsOnLabel(onprem.has(environment) ? "onprem" : "managed"),
    )
    .join(" · ");
}

/** The Review step's Delivery value. */
export function hostingDeliveryLabel(
  provisioningEnabled: boolean,
  mode: HostingMode,
): string {
  if (mode === "onprem") return "On-prem host for every environment";
  const hosted = provisioningEnabled ? "Deployment setup included" : "CI workflow only";
  return mode === "mixed" ? hosted + " · on-prem host for some environments" : hosted;
}
