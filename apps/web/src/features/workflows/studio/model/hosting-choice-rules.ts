/**
 * The create wizard's one project-wide Hosting choice: Vercel / Render, an
 * on-prem host, or none (CI only). It decides what the create request carries:
 *
 * - "hosted": today's provisioning, `deploymentProvisioning` with the hosted
 *   targets, and no `environments` (the fixed dev, uat, main pipeline).
 * - "onprem": the fixed dev, uat, main `environments`, each with its own
 *   on-prem target per slot (one slot for a single application, backend and
 *   frontend for two repositories). No hosted targets, variable groups or
 *   shared env.
 * - "none": `deploymentProvisioning = { enabled: false, targets: [] }`, which
 *   the backend reads as "no hosting" and adds no default target to.
 *
 * Pure functions only; the backend stays the authority.
 */
import type {
  CreateDeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
  EnvTargetSlot,
} from "@/shared/api/contracts";
import { multiRepoRepositoryNames } from "./create-project-payload";
import { providerLabel } from "./deployment-provisioning-rules";
import {
  ALL_ONPREM_DELIVERY_NOTICE,
  runEveryEnvironmentOnprem,
  type OnpremHosting,
} from "./onprem-hosting-rules";
import type { EnvironmentDraft } from "./project-environments-rules";
import { fitHostAssignments, type HostSlot } from "./setup-host-assignment-rules";
import {
  defaultProjectName,
  inferSingleProjectKind,
  projectKindToSlot,
} from "./setup-tab-rules";
import { toSlug } from "./workflow-studio-rules";

export type HostingChoice = "hosted" | "onprem" | "none";

export const DEFAULT_HOSTING_CHOICE: HostingChoice = "hosted";

export const HOSTING_LABELS: Record<HostingChoice, string> = {
  hosted: "Vercel / Render",
  onprem: "On-prem host",
  none: "None — CI only",
};

/** The line under the choice, for the option that is selected. */
export const HOSTING_DESCRIPTIONS: Record<HostingChoice, string> = {
  hosted:
    "ALPHACI creates the Render service or Vercel project on its own accounts and deploys it from the pipeline.",
  onprem: ALL_ONPREM_DELIVERY_NOTICE,
  none: "Only the repository and its CI workflow are created. Nothing is deployed.",
};

/**
 * How the project's code is laid out: one application, two services in one
 * repository (microservices), or two repositories (multi-repo).
 */
export type ServiceLayout = "single" | "microservices" | "multiRepo";

export const ONPREM_MICROSERVICES_REASON =
  "On-prem isn't available yet for two services in one repository. Use two repositories, or Vercel / Render.";

/** "None": an explicit "no hosting", so the backend adds no default target. */
export const CI_ONLY_PROVISIONING: CreateDeploymentProvisioningRequest = {
  enabled: false,
  targets: [],
};

export interface HostingOption {
  value: HostingChoice;
  label: string;
  disabled: boolean;
  /** Why the option cannot be chosen, shown beside it; absent when it can. */
  reason?: string;
}

/**
 * The options to show. On-prem follows `GET /deployment-providers`: hidden
 * when not listed, disabled with the server's reason when listed but off, and
 * disabled for two services in one repository, whose environments the
 * backend refuses. A single application and two repositories can choose it.
 */
export function hostingOptions(input: {
  onprem: OnpremHosting;
  layout: ServiceLayout;
}): HostingOption[] {
  const options: HostingOption[] = [option("hosted")];
  const onprem = onpremOption(input.onprem, input.layout);
  if (onprem) options.push(onprem);
  options.push(option("none"));
  return options;
}

function option(value: HostingChoice): HostingOption {
  return { value, label: HOSTING_LABELS[value], disabled: false };
}

function onpremOption(onprem: OnpremHosting, layout: ServiceLayout): HostingOption | null {
  if (onprem.status === "hidden") return null;
  if (onprem.status === "disabled") {
    return { ...option("onprem"), disabled: true, reason: onprem.reason };
  }
  if (layout === "microservices") {
    return { ...option("onprem"), disabled: true, reason: ONPREM_MICROSERVICES_REASON };
  }
  return option("onprem");
}

/**
 * The slots each environment's on-prem host runs: the one the application
 * deploys as, or the backend and the frontend for two repositories.
 * Microservices never reach on-prem; they get both slots for completeness.
 */
export function onpremSlotsForLayout(
  layout: ServiceLayout,
  selectedProjectKind: "frontend" | "backend",
): HostSlot[] {
  return layout === "single" ? [selectedProjectKind] : ["backend", "frontend"];
}

/**
 * The choice that applies: the person's pick while it is still offered, else
 * the default. A pick of on-prem never survives on-prem turning out to be
 * unavailable (a later provider answer, or a switch to two services in one
 * repository).
 */
export function effectiveHostingChoice(
  choice: HostingChoice,
  options: readonly HostingOption[],
): HostingChoice {
  const picked = options.find((candidate) => candidate.value === choice);
  return picked && !picked.disabled ? choice : DEFAULT_HOSTING_CHOICE;
}

/** The part of the create input the Hosting choice decides. */
export interface HostingCreateFields {
  deploymentProvisioning?: CreateDeploymentProvisioningRequest;
  environments?: readonly EnvironmentDraft[];
  onpremSlots?: readonly EnvTargetSlot[];
}

export function hostingCreateFields(input: {
  choice: HostingChoice;
  /**
   * The hosted (Vercel / Render) provisioning the target cards describe, or
   * undefined where the deployment does not offer provisioning (the backend
   * then adds its default target, as it always has).
   */
  hostedProvisioning: CreateDeploymentProvisioningRequest | undefined;
  /** The project's environments, in promotion order (dev, uat, main). */
  environments: readonly EnvironmentDraft[];
  /**
   * The slots each environment's host runs (one for a single application,
   * backend and frontend for two repositories).
   */
  onpremSlots: readonly HostSlot[];
}): HostingCreateFields {
  if (input.choice === "onprem") {
    return {
      // Every host assignment covers exactly these slots, even one picked
      // before the repository shape changed.
      environments: fitHostAssignments(
        runEveryEnvironmentOnprem(input.environments),
        input.onpremSlots,
      ),
      onpremSlots: input.onpremSlots,
    };
  }
  if (input.choice === "none") {
    return { deploymentProvisioning: CI_ONLY_PROVISIONING };
  }
  return { deploymentProvisioning: input.hostedProvisioning };
}

/**
 * The Render-variable rule holds only while the wizard configures a Render
 * service: Vercel / Render hosting, on a deployment that offers provisioning.
 */
export function renderVariablesBlockingFor(input: {
  choice: HostingChoice;
  provisioningOffered: boolean;
  missing: boolean;
}): boolean {
  return input.choice === "hosted" && input.provisioningOffered && input.missing;
}

/**
 * The shape facts hosting depends on: how the code is laid out (on-prem is
 * offered for one application and for two repositories, not for two services
 * in one repository), whether there are two services (two hosted targets),
 * and which one a single application deploys as.
 */
export function wizardShape(catalog: {
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  selectedProjectType: { kind?: "frontend" | "backend" } | null | undefined;
  selectedProjectTypeId: string;
}): {
  layout: ServiceLayout;
  isDualShape: boolean;
  selectedProjectKind: "frontend" | "backend";
} {
  return {
    layout: serviceLayout(catalog),
    isDualShape: catalog.isMicroservicesShape || catalog.isMultiRepoShape,
    selectedProjectKind: inferSingleProjectKind({
      selectedProjectTypeKind: catalog.selectedProjectType?.kind,
      selectedProjectTypeId: catalog.selectedProjectTypeId,
    }),
  };
}

function serviceLayout(catalog: {
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
}): ServiceLayout {
  if (catalog.isMicroservicesShape) return "microservices";
  return catalog.isMultiRepoShape ? "multiRepo" : "single";
}

/** One default hosted target: its slot and the name it starts with. */
export interface HostedTargetSeed {
  slot: EnvTargetSlot;
  projectName: string;
}

/**
 * The hosted targets the Vercel / Render option starts with, named after the
 * repository: one for a single application, a backend and a frontend for the
 * two-service shapes.
 */
export function hostedTargetSeeds(input: {
  isDualShape: boolean;
  repoName: string;
  backendServiceName: string;
  frontendServiceName: string;
  selectedProjectKind: "frontend" | "backend";
}): HostedTargetSeed[] {
  if (input.isDualShape) {
    return [
      {
        slot: "backend",
        projectName: defaultProjectName(input.backendServiceName, input.repoName, "backend"),
      },
      {
        slot: "frontend",
        projectName: defaultProjectName(input.frontendServiceName, input.repoName, "frontend"),
      },
    ];
  }
  return [
    { slot: projectKindToSlot(input.selectedProjectKind), projectName: toSlug(input.repoName) },
  ];
}

/** The environment ids in promotion order: "dev → uat → main". */
export function environmentPathLine(environments: readonly EnvironmentDraft[]): string {
  return environments.map(({ slug }) => slug).join(" → ");
}

const ONPREM_PROMOTION_SENTENCE =
  "Test deploys on every push to dev; UAT and Production receive a release only through promotion.";

/** What the read-only environments line says under each choice. */
export function environmentsCaption(
  choice: HostingChoice,
  layout: ServiceLayout = "single",
): string {
  if (choice === "onprem" && layout === "multiRepo") {
    return "Both repositories deploy to your on-prem host in each environment. " + ONPREM_PROMOTION_SENTENCE;
  }
  if (choice === "onprem") {
    return "Each runs on your on-prem host. " + ONPREM_PROMOTION_SENTENCE;
  }
  if (choice === "none") {
    return "The branches are created and the CI workflow runs on them. Nothing is deployed.";
  }
  // Today's managed pipeline hosts only uat and main (HOSTED_BRANCHES); dev
  // runs the checks and is never deployed.
  return "dev runs the checks on every push; uat and main are deployed when changes are promoted.";
}

/** "Backend repo · orders-be", "Frontend repo · orders-fe". */
function onpremRepositoryLines(repoName: string): string[] {
  const names = multiRepoRepositoryNames(repoName || "repository-name");
  return [`Backend repo · ${names.backend}`, `Frontend repo · ${names.frontend}`];
}

function hostedTargetLine(target: DeploymentProvisioningTargetRequest): string {
  const name = target.projectName?.trim() || "unnamed";
  return `${providerLabel(target.provider)} · ${name} (${target.slot})`;
}

/**
 * The Review step's Hosting value: a heading and one line per target, if any.
 * On-prem for two repositories names both repositories the host runs.
 */
export function hostingReviewLines(input: {
  choice: HostingChoice;
  environments: readonly EnvironmentDraft[];
  hostedTargets: readonly DeploymentProvisioningTargetRequest[];
  layout?: ServiceLayout;
  repoName?: string;
}): { heading: string; details: string[] } {
  if (input.choice === "onprem") {
    return {
      heading: "On-prem host — " + input.environments.map(({ slug }) => slug).join(", "),
      details: input.layout === "multiRepo" ? onpremRepositoryLines(input.repoName ?? "") : [],
    };
  }
  if (input.choice === "none") {
    return { heading: "None — CI workflow only", details: [] };
  }
  return { heading: HOSTING_LABELS.hosted, details: input.hostedTargets.map(hostedTargetLine) };
}
