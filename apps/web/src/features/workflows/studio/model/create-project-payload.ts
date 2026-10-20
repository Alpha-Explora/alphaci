import type {
  CreateProjectRequest,
  EnvTargetSlot,
  MvpProjectOptionKey,
} from "@/shared/api/contracts";
import { withOnpremTargets } from "./onprem-hosting-rules";
import { setupHostAssignmentsProblem } from "./setup-host-assignment-rules";
import {
  environmentsProblem,
  type EnvironmentDraft,
} from "./project-environments-rules";
import { validateProjectName } from "./project-name-rules";
import { toSlug } from "./workflow-studio-rules";

export type CreateProjectPayloadResult =
  | { ok: true; payload: CreateProjectRequest }
  | { ok: false; message: string };

export interface CreateProjectPayloadInput {
  /**
   * The Project name to send, or null when the repository joins an existing
   * Project (a deliveryProjectId is sent instead and the name is not asked for).
   */
  projectName: string | null;
  repoName: string;
  visibility: CreateProjectRequest["visibility"];
  nodeVersion: string;
  coverageThreshold: string;
  outputFileName: string;
  backendProjectTypeId: string;
  backendWorkflowRecipeId: string;
  backendServiceName: string;
  backendServicePath: string;
  frontendProjectTypeId: string;
  frontendWorkflowRecipeId: string;
  frontendServiceName: string;
  frontendServicePath: string;
  isMicroservicesShape: boolean;
  isMultiRepoShape: boolean;
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
  ownerType?: "personal" | "organization";
  installationId?: number;
  deploymentProvisioning?: CreateProjectRequest["deploymentProvisioning"];
  /** Set only when the project is created with its own environments (on-prem hosting). */
  environments?: readonly EnvironmentDraft[];
  /**
   * The project's deployable slots, set only when the deployment offers
   * on-prem hosting. Without it every environment's "Runs on" is ignored and
   * the request is exactly what it was before on-prem existed.
   */
  onpremSlots?: readonly EnvTargetSlot[];
}

/**
 * Every workflow option on, Docker included, whatever the catalog defaults
 * say. The create wizard no longer offers the options: only Docker changes
 * the scaffold (it adds the ./Dockerfile that managed Render and on-prem
 * deploys build), and the other four have no effect on the generated pipeline.
 */
export const ALWAYS_ON_TESTS: Readonly<Record<MvpProjectOptionKey, boolean>> = {
  lint: true,
  unit: true,
  build: true,
  coverage: true,
  security: true,
  docker: true,
};

function sanitizeRepoNameInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\s+/, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/[^a-z0-9._-]/g, "");
}

export function normalizeRepoName(value: string): string {
  return sanitizeRepoNameInput(value).replaceAll(/^[-._]+|[-._]+$/g, "");
}

export { sanitizeRepoNameInput };

/**
 * The two repositories a two-repository project creates, as the backend names
 * them (`deriveMultiRepoNames`): `<name>-be` and `<name>-fe`, without doubling
 * a `-be` the name already ends with.
 */
export function multiRepoRepositoryNames(repoName: string): {
  backend: string;
  frontend: string;
} {
  const normalized = normalizeRepoName(repoName);
  const backend = normalized.endsWith("-be") ? normalized : `${normalized}-be`;
  return { backend, frontend: backend.replace(/-be$/, "-fe") };
}

function invalidRepoName(repoName: string): CreateProjectPayloadResult | null {
  if (!normalizeRepoName(repoName)) {
    return { ok: false, message: "Repository name is required." };
  }
  return null;
}

function invalidProjectName(
  projectName: string | null,
): CreateProjectPayloadResult | null {
  if (projectName === null) {
    return null;
  }
  const check = validateProjectName(projectName);
  return check.ok ? null : { ok: false, message: check.message };
}

function projectNameField(
  projectName: string | null,
): Pick<CreateProjectRequest, "projectName"> {
  const check = projectName === null ? null : validateProjectName(projectName);
  return check?.ok ? { projectName: check.name } : {};
}

function invalidShape(repoShapeId: string): CreateProjectPayloadResult | null {
  if (!repoShapeId) {
    return { ok: false, message: "Choose a repository shape." };
  }
  return null;
}

function invalidCoverage(
  coverageThreshold: string,
): CreateProjectPayloadResult | null {
  const coverage = Number(coverageThreshold);
  if (!Number.isInteger(coverage) || coverage < 0 || coverage > 100) {
    return {
      ok: false,
      message: "Coverage threshold must be between 0 and 100.",
    };
  }
  return null;
}

function invalidOutputFileName(
  outputFileName: string,
): CreateProjectPayloadResult | null {
  const normalized = outputFileName.trim() || "ci.yml";
  if (normalized.includes("/") || normalized.includes("\\")) {
    return {
      ok: false,
      message: "Workflow file name must be a .yml or .yaml basename.",
    };
  }
  if (!/\.ya?ml$/i.test(normalized)) {
    return {
      ok: false,
      message: "Workflow file name must be a .yml or .yaml basename.",
    };
  }
  return null;
}

function invalidOwner(
  ownerType: "personal" | "organization" | undefined,
  installationId: number | undefined,
): CreateProjectPayloadResult | null {
  if ((ownerType ?? "personal") === "organization" && !installationId) {
    return { ok: false, message: "Choose a linked GitHub organization." };
  }
  return null;
}

function ownerFields(
  ownerType: "personal" | "organization" | undefined,
  installationId: number | undefined,
): Pick<CreateProjectRequest, "ownerType" | "installationId"> {
  if (!ownerType) {
    return {};
  }
  if (ownerType === "organization" && installationId) {
    return { ownerType, installationId };
  }
  return { ownerType };
}

function dualSlotNames(
  input: CreateProjectPayloadInput,
  normalizedRepoName: string,
) {
  return {
    backend: toSlug(
      input.backendServiceName || `${normalizedRepoName}-backend`,
    ),
    frontend: toSlug(
      input.frontendServiceName || `${normalizedRepoName}-frontend`,
    ),
  };
}

function sharedFields(
  input: CreateProjectPayloadInput,
  normalizedRepoName: string,
  coverage: number,
  outputFileName: string,
): Omit<
  CreateProjectRequest,
  "projectTypeId" | "workflowRecipeId" | "serviceName" | "servicePath"
> {
  return {
    ...projectNameField(input.projectName),
    repoName: normalizedRepoName,
    visibility: input.visibility,
    ...ownerFields(input.ownerType, input.installationId),
    repoShape: input.repoShapeId,
    nodeVersion: input.nodeVersion.trim() || "24",
    coverageThreshold: coverage,
    tests: input.tests,
    outputFileName,
    ...(input.deploymentProvisioning
      ? { deploymentProvisioning: input.deploymentProvisioning }
      : {}),
  };
}

function dualSlotConfig(
  input: CreateProjectPayloadInput,
  names: { backend: string; frontend: string },
) {
  return {
    backend: {
      projectTypeId: input.backendProjectTypeId,
      workflowRecipeId: input.backendWorkflowRecipeId,
      serviceName: names.backend,
      servicePath: input.backendServicePath.trim() || "backend/",
    },
    frontend: {
      projectTypeId: input.frontendProjectTypeId,
      workflowRecipeId: input.frontendWorkflowRecipeId,
      serviceName: names.frontend,
      servicePath: input.frontendServicePath.trim() || "frontend/",
    },
  };
}

/**
 * Two services. Two repositories may carry their own environments (on-prem
 * hosting, a target per environment for both slots); two services in one
 * repository never do, so any environments are ignored there, as before.
 */
function dualShapePayload(
  input: CreateProjectPayloadInput,
  kind: "microservices" | "multiRepo",
): CreateProjectPayloadResult {
  const withEnvironments =
    kind === "multiRepo" ? input : { ...input, environments: undefined };
  const environmentsInvalid = invalidEnvironments(withEnvironments.environments);
  if (environmentsInvalid) {
    return environmentsInvalid;
  }
  const normalizedRepoName = normalizeRepoName(input.repoName);
  const coverage = Number(input.coverageThreshold);
  const outputFileName = input.outputFileName.trim() || "ci.yml";
  const names = dualSlotNames(input, normalizedRepoName);
  const slots = dualSlotConfig(input, names);
  const payload: CreateProjectRequest = {
    ...sharedFields(
      {
        ...input,
        deploymentProvisioning: provisioningWithOnprem(withEnvironments),
      },
      normalizedRepoName,
      coverage,
      outputFileName,
    ),
    projectTypeId: input.backendProjectTypeId,
    workflowRecipeId: input.backendWorkflowRecipeId,
    serviceName: names.backend,
    servicePath: input.backendServicePath.trim() || "backend/",
    ...(kind === "microservices"
      ? { microservicesConfig: slots }
      : { multiRepoConfig: slots }),
    ...environmentsField(withEnvironments.environments),
  };
  return { ok: true, payload };
}

function invalidEnvironments(
  environments: readonly EnvironmentDraft[] | undefined,
): CreateProjectPayloadResult | null {
  const problem = environments
    ? (environmentsProblem(environments) ??
      setupHostAssignmentsProblem(environments))
    : null;
  return problem ? { ok: false, message: problem } : null;
}

function environmentsField(
  environments: readonly EnvironmentDraft[] | undefined,
): Pick<CreateProjectRequest, "environments"> {
  return environments
    ? { environments: environments.map(trimmedEnvironment) }
    : {};
}

/** Hosted targets, plus on-prem targets for the environments that run on-prem. */
function provisioningWithOnprem(
  input: CreateProjectPayloadInput,
): CreateProjectRequest["deploymentProvisioning"] {
  if (!input.environments || !input.onpremSlots) {
    return input.deploymentProvisioning;
  }
  return withOnpremTargets(
    input.deploymentProvisioning,
    input.environments,
    input.onpremSlots,
  );
}

function standalonePayload(
  input: CreateProjectPayloadInput,
): CreateProjectPayloadResult {
  if (!input.projectTypeId) {
    return { ok: false, message: "Choose a project type." };
  }
  if (!input.workflowRecipeId) {
    return { ok: false, message: "Choose a workflow recipe." };
  }
  const environmentsInvalid = invalidEnvironments(input.environments);
  if (environmentsInvalid) {
    return environmentsInvalid;
  }
  const normalizedRepoName = normalizeRepoName(input.repoName);
  const coverage = Number(input.coverageThreshold);
  const outputFileName = input.outputFileName.trim() || "ci.yml";
  return {
    ok: true,
    payload: {
      ...sharedFields(
        { ...input, deploymentProvisioning: provisioningWithOnprem(input) },
        normalizedRepoName,
        coverage,
        outputFileName,
      ),
      projectTypeId: input.projectTypeId,
      workflowRecipeId: input.workflowRecipeId,
      // Always the repository's slug at the repository root: nothing needs a
      // different name, and another path points the pipeline at a folder the
      // scaffold never creates.
      serviceName: toSlug(normalizedRepoName),
      servicePath: ".",
      ...environmentsField(input.environments),
    },
  };
}

function trimmedEnvironment(environment: EnvironmentDraft): EnvironmentDraft {
  return {
    ...(environment.hostAssignment
      ? { hostAssignment: environment.hostAssignment }
      : {}),
    slug: environment.slug.trim(),
    displayName: environment.displayName.trim(),
    sourceBranch: environment.sourceBranch.trim(),
    role: environment.role,
  };
}

export function buildCreateProjectPayload(
  input: CreateProjectPayloadInput,
): CreateProjectPayloadResult {
  const invalid =
    invalidProjectName(input.projectName) ??
    invalidRepoName(input.repoName) ??
    invalidShape(input.repoShapeId) ??
    invalidCoverage(input.coverageThreshold) ??
    invalidOutputFileName(input.outputFileName) ??
    invalidOwner(input.ownerType, input.installationId);
  if (invalid) {
    return invalid;
  }
  if (input.isMicroservicesShape) {
    return dualShapePayload(input, "microservices");
  }
  if (input.isMultiRepoShape) {
    return dualShapePayload(input, "multiRepo");
  }
  return standalonePayload(input);
}
