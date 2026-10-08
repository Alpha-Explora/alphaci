"use client";

import { useState } from "react";

import {
  inferSingleProjectKind,
  projectKindToSlot,
  toSlug,
  useCreateProjectForm,
  useDeploymentProvisioningForm,
  useProjectOptionsCatalog,
} from "@/features/workflows/studio";
import type { NodeVersionOption, ProjectTypeOption, RepoShapeOption, WorkflowRecipeOption } from "@/shared/api/contracts";

import { createRepository } from "../../data/hierarchy-api";
import type { CreatedRepositoryResponse, HierarchyRepository } from "../../data/hierarchy-contracts";
import {
  addRepositoryErrorMessage,
  addRepositoryRequest,
  hasHostingOverrides,
  hostingProviderName,
  NO_HOSTING_OVERRIDES,
  repositoryOutcome,
  resolveHostingChoice,
  singleRepositoryShapes,
  type HostingOverrides,
  type RepositoryOutcomeView,
} from "../../model/add-repository-rules";

/** editing -> submitting -> created (the result step), or back to editing on a refusal. */
export type CreateRepositoryStatus = "editing" | "submitting" | "created";

export interface CreateRepositoryViewModel {
  status: CreateRepositoryStatus;
  error: string | null;
  name: string;
  setName: (value: string) => void;
  /** Stacks from the wizard's catalog; empty until it loads. */
  stacks: ProjectTypeOption[];
  stacksLoading: boolean;
  stacksError: string | null;
  /** '' until the person picks one: the stack is never chosen for them. */
  stackId: string;
  setStackId: (stackId: string) => void;
  /** Single-repository shapes the catalog enables; the picker shows only with 2+. */
  shapes: RepoShapeOption[];
  shapeId: string;
  setShapeId: (shapeId: string) => void;
  recipes: WorkflowRecipeOption[];
  recipeId: string;
  setRecipeId: (recipeId: string) => void;
  nodeVersions: NodeVersionOption[];
  nodeVersion: string;
  setNodeVersion: (value: string) => void;
  hostingEnabled: boolean;
  setHostingEnabled: (enabled: boolean) => void;
  /** "Vercel" or "Render" for the chosen stack; null before a stack is chosen. */
  hostingProvider: string | null;
  overrides: HostingOverrides;
  setOverride: (field: keyof HostingOverrides, value: string) => void;
  canSubmit: boolean;
  submit: () => Promise<void>;
  outcome: RepositoryOutcomeView | null;
}

/**
 * "Add repository" inside a Project. The stack, recipe, Node version and
 * hosting come from the create wizard's own hooks, so a repository added here
 * is set up exactly like one created in the wizard.
 */
export function useCreateRepositoryViewModel(
  deliveryProjectId: string,
  onCreated: (repository: HierarchyRepository) => void,
): CreateRepositoryViewModel {
  const form = useCreateProjectForm();
  const catalog = useProjectOptionsCatalog();
  const hostingForm = useDeploymentProvisioningForm(catalog.selectedRepoShapeId);
  const [stackChosen, setStackChosen] = useState(false);
  const [hostingEnabled, setHostingEnabled] = useState(true);
  const [overrides, setOverrides] = useState<HostingOverrides>(NO_HOSTING_OVERRIDES);
  const [status, setStatus] = useState<CreateRepositoryStatus>("editing");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRepositoryResponse | null>(null);

  const stackId = stackChosen ? catalog.selectedProjectTypeId : "";
  const kindFor = (projectTypeId: string, kind?: "frontend" | "backend") =>
    inferSingleProjectKind({ selectedProjectTypeKind: kind, selectedProjectTypeId: projectTypeId });

  /* Advanced hosting edits ride on the wizard form's default target for this
   * stack and name, re-seeded whenever either changes while edits exist. */
  function seedHosting(projectTypeId: string, serviceName: string, next: HostingOverrides) {
    if (!hasHostingOverrides(next) || !projectTypeId) return;
    const type = catalog.projectTypesForShape.find((option) => option.id === projectTypeId);
    hostingForm.setDefaultTarget(projectKindToSlot(kindFor(projectTypeId, type?.kind)), serviceName);
  }

  function setName(value: string) {
    form.setRepoName(value);
    setError(null);
    seedHosting(stackId, toSlug(value), overrides);
  }

  function setStackId(next: string) {
    setStackChosen(next !== "");
    if (next) catalog.setSelectedProjectTypeId(next);
    setError(null);
    seedHosting(next, form.serviceName || form.repoName, overrides);
  }

  function setOverride(field: keyof HostingOverrides, value: string) {
    const next = { ...overrides, [field]: value };
    setOverrides(next);
    seedHosting(stackId, form.serviceName || form.repoName, next);
  }

  async function submit() {
    if (!stackChosen) {
      setError("Choose the stack for this repository.");
      return;
    }
    const built = form.buildPayload({
      projectName: null,
      isMicroservicesShape: false,
      isMultiRepoShape: false,
      repoShapeId: catalog.selectedRepoShapeId,
      projectTypeId: catalog.selectedProjectTypeId,
      workflowRecipeId: catalog.selectedWorkflowRecipeId,
      tests: catalog.tests,
    });
    if (!built.ok) {
      setError(built.message);
      return;
    }
    const body = addRepositoryRequest(
      built.payload,
      resolveHostingChoice({ hostingEnabled, overrides, formPayload: hostingForm.payload }),
    );
    setStatus("submitting");
    setError(null);
    try {
      const response = await createRepository(deliveryProjectId, body);
      const { provisioning: _provisioning, ...repository } = response;
      onCreated(repository);
      setCreated(response);
      setStatus("created");
    } catch (cause) {
      setError(addRepositoryErrorMessage(cause));
      setStatus("editing");
    }
  }

  const selectedKind = stackChosen
    ? kindFor(catalog.selectedProjectTypeId, catalog.selectedProjectType?.kind)
    : null;

  return {
    status,
    error,
    name: form.repoName,
    setName,
    stacks: catalog.projectTypesForShape,
    stacksLoading: catalog.loadingProjectOptions,
    stacksError: catalog.projectOptionsError,
    stackId,
    setStackId,
    shapes: singleRepositoryShapes(catalog.allRepoShapes),
    shapeId: catalog.selectedRepoShapeId,
    setShapeId: catalog.setSelectedRepoShapeId,
    recipes: catalog.recipesForSelectedProject,
    recipeId: catalog.selectedWorkflowRecipeId,
    setRecipeId: catalog.setSelectedWorkflowRecipeId,
    nodeVersions: catalog.nodeVersions,
    nodeVersion: form.nodeVersion,
    setNodeVersion: form.setNodeVersion,
    hostingEnabled,
    setHostingEnabled,
    hostingProvider: selectedKind ? hostingProviderName(selectedKind) : null,
    overrides,
    setOverride,
    canSubmit: status === "editing" && form.repoName.trim() !== "" && stackChosen,
    submit,
    outcome: created ? repositoryOutcome(created) : null,
  };
}
