import type {
  CatalogTemplate,
  GenerateWorkflowRequest,
  SetupProjectRequest,
  WorkflowRecipeOption,
} from '@/shared/api/contracts';

import { validateProjectName } from './project-name-rules';

export function clampCoverageThreshold(raw: string): number {
  const coverage = Number(raw);
  if (Number.isFinite(coverage) && coverage >= 0 && coverage <= 100) {
    return coverage;
  }
  return 80;
}

export function resolveSetupTemplateId(
  selectedProjectTypeId: string,
  selectedWorkflowRecipeId: string,
  recipesForSelectedProject: Pick<
    WorkflowRecipeOption,
    'id' | 'templateByProjectType'
  >[],
): string {
  const recipeId = selectedWorkflowRecipeId || 'standard';
  const recipe = recipesForSelectedProject.find((item) => item.id === recipeId);
  return (
    recipe?.templateByProjectType[selectedProjectTypeId] ??
    `${selectedProjectTypeId}-${recipeId}`
  );
}

export interface SetupExistingRepoPayloadInput {
  repoFullName: string;
  selectedProjectTypeId: string;
  selectedWorkflowRecipeId: string;
  recipesForSelectedProject: Pick<
    WorkflowRecipeOption,
    'id' | 'templateByProjectType'
  >[];
  serviceName: string;
  discoveredServiceName?: string | null;
  servicePath: string;
  discoveredServicePath?: string | null;
  nodeVersion: string;
  coverageThreshold: string;
  outputFileName: string;
  deploymentProvisioning: SetupProjectRequest['deploymentProvisioning'];
  /**
   * The new Project's name, trimmed and validated by the caller; null when
   * the repository is filed into an existing Project, which keeps its name.
   */
  projectName: string | null;
}

/**
 * Where an existing repository is filed: a blocker (no Project for a
 * Developer, no Feature yet) stops it; an existing Project needs no name;
 * otherwise the new Project's name must be valid.
 */
export function existingRepoFiling(input: {
  deliveryProjectId: string | undefined;
  projectName: string;
  blocker: string | null;
}): { ok: true; projectName: string | null } | { ok: false; message: string } {
  if (input.blocker) return { ok: false, message: input.blocker };
  if (input.deliveryProjectId) return { ok: true, projectName: null };
  const checked = validateProjectName(input.projectName);
  return checked.ok
    ? { ok: true, projectName: checked.name }
    : { ok: false, message: checked.message };
}

export function buildSetupExistingRepoPayload(
  input: SetupExistingRepoPayloadInput,
): SetupProjectRequest {
  const fallbackServiceName = input.repoFullName.split('/').at(-1) ?? 'service';
  return {
    templateId: resolveSetupTemplateId(
      input.selectedProjectTypeId,
      input.selectedWorkflowRecipeId,
      input.recipesForSelectedProject,
    ),
    repoFullName: input.repoFullName,
    serviceName:
      input.serviceName || input.discoveredServiceName || fallbackServiceName,
    servicePath: input.servicePath || input.discoveredServicePath || '.',
    nodeVersion: input.nodeVersion || '24',
    coverageThreshold: clampCoverageThreshold(input.coverageThreshold),
    outputFileName: input.outputFileName || 'ci.yml',
    deploymentProvisioning: input.deploymentProvisioning,
    ...(input.projectName === null
      ? {}
      : { projectName: input.projectName.trim() }),
  };
}

export type GenerateWorkflowPayloadResult =
  | { ok: true; payload: GenerateWorkflowRequest }
  | { ok: false; message: string };

export interface GenerateWorkflowPayloadInput {
  serviceName: string;
  repoName: string;
  selectedTemplateId?: string;
  allTemplates: Pick<CatalogTemplate, 'id' | 'stack'>[];
  selectedProjectTypeId?: string;
  servicePath: string;
  nodeVersion: string;
  coverageThreshold: string;
}

export function resolveGenerateTemplateId(
  selectedTemplateId: string | undefined,
  allTemplates: Pick<CatalogTemplate, 'id' | 'stack'>[],
  selectedProjectTypeId: string | undefined,
): string | undefined {
  return (
    selectedTemplateId ??
    allTemplates.find((template) => template.stack === selectedProjectTypeId)
      ?.id ??
    allTemplates[0]?.id
  );
}

export function buildGenerateWorkflowPayload(
  input: GenerateWorkflowPayloadInput,
): GenerateWorkflowPayloadResult {
  const serviceName = input.serviceName || input.repoName;
  if (!serviceName) {
    return {
      ok: false,
      message: 'Enter a service name to generate a workflow.',
    };
  }
  const templateId = resolveGenerateTemplateId(
    input.selectedTemplateId,
    input.allTemplates,
    input.selectedProjectTypeId,
  );
  if (!templateId) {
    return {
      ok: false,
      message: 'No workflow templates available. Check catalog configuration.',
    };
  }
  return {
    ok: true,
    payload: {
      templateId,
      serviceName,
      servicePath: input.servicePath || '.',
      nodeVersion: input.nodeVersion || '24',
      coverageThreshold: clampCoverageThreshold(input.coverageThreshold),
    },
  };
}
