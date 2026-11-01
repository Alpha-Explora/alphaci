/* "Add repository" inside a Project: the request body, the hosting choice,
 * and how the outcome reads. Pure: no React, no fetch.
 *
 * The body is derived from the create wizard's own payload
 * (buildCreateProjectPayload in workflows/studio), so stack, recipe, Node
 * version, tests and workflow file are validated and defaulted exactly as the
 * wizard does it; this file only renames what the endpoint calls differently. */
import type {
  CreateProjectRequest,
  DeploymentProvisioningRequest,
  DeploymentProvisioningTargetRequest,
} from "@/shared/api/contracts";
import { ApiError } from "@/shared/api/request";

import type {
  CreateRepositoryRequest,
  CreatedRepositoryResponse,
  RepositoryHostingFailure,
} from "../data/hierarchy-contracts";
import { creationRefusalMessage } from "./creation-role-rules";
import { apiErrorCode } from "./project-members-rules";

/* ── Hosting ──────────────────────────────────────────────────────────── */

/**
 * `managed`: ALPHACI-managed hosting with the server's defaults (Vercel for a
 * frontend stack, Render for a backend one) — the body sends nothing.
 * `custom`: managed hosting with fields the person changed under Advanced —
 * the body sends the wizard form's request. `off`: no hosting.
 */
export type HostingChoice =
  | { mode: "managed" }
  | { mode: "custom"; request: DeploymentProvisioningRequest }
  | { mode: "off" };

export const HOSTING_OFF_REQUEST: DeploymentProvisioningRequest = { enabled: false, targets: [] };

export interface HostingOverrides {
  rootDirectory: string;
  buildCommand: string;
}

export const NO_HOSTING_OVERRIDES: HostingOverrides = { rootDirectory: "", buildCommand: "" };

export function hasHostingOverrides(overrides: HostingOverrides): boolean {
  return overrides.rootDirectory.trim() !== "" || overrides.buildCommand.trim() !== "";
}

function overrideTarget(
  target: DeploymentProvisioningTargetRequest,
  overrides: HostingOverrides,
): DeploymentProvisioningTargetRequest {
  const rootDirectory = overrides.rootDirectory.trim();
  const buildCommand = overrides.buildCommand.trim();
  return {
    ...target,
    ...(rootDirectory ? { rootDirectory } : {}),
    ...(buildCommand ? { buildCommand } : {}),
  };
}

/**
 * The hosting choice for the body. Managed hosting with no Advanced edits is
 * left to the server's defaults; with edits, the wizard form's default target
 * (`formPayload`) carries them. A form that has not produced its payload yet
 * also falls back to the server's defaults rather than sending nothing useful.
 */
export function resolveHostingChoice(input: {
  hostingEnabled: boolean;
  overrides: HostingOverrides;
  formPayload: DeploymentProvisioningRequest | undefined;
}): HostingChoice {
  if (!input.hostingEnabled) return { mode: "off" };
  if (!hasHostingOverrides(input.overrides) || !input.formPayload) return { mode: "managed" };
  return {
    mode: "custom",
    request: {
      ...input.formPayload,
      targets: input.formPayload.targets.map((target) => overrideTarget(target, input.overrides)),
    },
  };
}

function hostingField(choice: HostingChoice): Pick<CreateRepositoryRequest, "deploymentProvisioning"> {
  if (choice.mode === "off") return { deploymentProvisioning: HOSTING_OFF_REQUEST };
  if (choice.mode === "custom") return { deploymentProvisioning: choice.request };
  return {};
}

export function hostingProviderName(kind: "frontend" | "backend"): string {
  return kind === "frontend" ? "Vercel" : "Render";
}

/* ── Request body ─────────────────────────────────────────────────────── */

function repoShapeField(repoShape: string | undefined): Pick<CreateRepositoryRequest, "repoShape"> {
  return repoShape === "mono" || repoShape === "monorepo" ? { repoShape } : { repoShape: "standalone" };
}

/**
 * POST /delivery-projects/:id/repositories from the wizard's payload. The
 * wizard's `repoName` is this endpoint's `name`; owner, team, Project and
 * multi-repository fields do not apply to one repository in a Project.
 */
export function addRepositoryRequest(
  wizard: CreateProjectRequest,
  hosting: HostingChoice,
): CreateRepositoryRequest {
  return {
    name: wizard.repoName,
    projectTypeId: wizard.projectTypeId,
    visibility: wizard.visibility,
    serviceName: wizard.serviceName,
    ...repoShapeField(wizard.repoShape),
    ...(wizard.workflowRecipeId ? { workflowRecipeId: wizard.workflowRecipeId } : {}),
    ...(wizard.servicePath ? { servicePath: wizard.servicePath } : {}),
    ...(wizard.nodeVersion ? { nodeVersion: wizard.nodeVersion } : {}),
    ...(wizard.coverageThreshold === undefined ? {} : { coverageThreshold: wizard.coverageThreshold }),
    ...(wizard.tests ? { tests: wizard.tests } : {}),
    ...(wizard.outputFileName ? { outputFileName: wizard.outputFileName } : {}),
    ...hostingField(hosting),
  };
}

/** Repository shapes "Add repository" can offer: one repository, never a pair. */
const SINGLE_REPOSITORY_SHAPES: ReadonlySet<string> = new Set(["standalone", "mono"]);

export function singleRepositoryShapes<T extends { id: string; enabled: boolean }>(
  shapes: ReadonlyArray<T>,
): T[] {
  return shapes.filter((shape) => shape.enabled && SINGLE_REPOSITORY_SHAPES.has(shape.id));
}

/* ── Outcome ──────────────────────────────────────────────────────────── */

export interface RepositoryOutcomeView {
  tone: "success" | "warning";
  title: string;
  message: string;
  /** One line per hosting target or variable that failed. */
  reasons: ReadonlyArray<string>;
  /** In-app link to the repository's Hosting tab, when there is something to fix. */
  hostingHref: string | null;
  /** In-app link to the repository's page. */
  repositoryHref: string;
}

function providerName(provider: string): string {
  if (provider === "vercel") return "Vercel";
  if (provider === "render") return "Render";
  return provider;
}

function failureLine(failure: RepositoryHostingFailure): string {
  return `${providerName(failure.provider)}: ${failure.reason}`;
}

/** How the create went, for the dialog's result step. */
export function repositoryOutcome(created: CreatedRepositoryResponse): RepositoryOutcomeView {
  const { projectId, hosting } = created.provisioning;
  const repositoryHref = `/projects/${encodeURIComponent(projectId)}`;
  const base = { reasons: [] as string[], hostingHref: null, repositoryHref };
  if (hosting.outcome === "provisioned") {
    return {
      ...base,
      tone: "success",
      title: "Repository created",
      message: `${created.name} is ready, and its hosting is set up. The first deploy runs after its pipeline's first build.`,
    };
  }
  if (hosting.outcome === "skipped") {
    return {
      ...base,
      tone: "success",
      title: "Repository created",
      message: `${created.name} is ready. No hosting was set up for it.`,
    };
  }
  const reasons = hosting.failures.map(failureLine);
  return {
    tone: "warning",
    title: "Hosting needs attention",
    message:
      hosting.outcome === "partial"
        ? "Repository created; hosting couldn't be fully set up:"
        : "Repository created; hosting couldn't be set up:",
    reasons: reasons.length > 0 ? reasons : ["No reason was reported."],
    hostingHref: `${repositoryHref}#hosting`,
    repositoryHref,
  };
}

/* ── Refusals ─────────────────────────────────────────────────────────── */

export const HOSTING_INVALID_MESSAGE =
  "The hosting settings weren't accepted. Check the Advanced hosting fields, or turn hosting off.";

/** One clear sentence for a failed "Add repository". */
export function addRepositoryErrorMessage(cause: unknown): string {
  if (apiErrorCode(cause) === "DEPLOYMENT_PROVISIONING_INVALID") return HOSTING_INVALID_MESSAGE;
  const refusal = creationRefusalMessage(cause);
  if (refusal) return refusal;
  if (cause instanceof ApiError && cause.status === 409) {
    return "A repository with that name already exists.";
  }
  if (cause instanceof ApiError && cause.status === 400) {
    return "The repository could not be created. Check the name and stack, then try again.";
  }
  return "The repository could not be created. Please try again.";
}
