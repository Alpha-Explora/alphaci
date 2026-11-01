"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getProjectOptions } from "@/features/workflows/studio/data/catalog-api";
import type {
  MvpProjectOptionKey,
  ProjectOptionSet,
  ProjectOptionsResponse,
  ProjectTypeOption,
  RepoShapeOption,
  WorkflowRecipeOption,
} from "@/shared/api/contracts";

const emptyCatalog: ProjectOptionsResponse = {
  repoShapes: [],
  projectTypes: [],
  recipes: [],
  nodeVersions: [],
  enforcedOrg: "",
};

export const mvpProjectOptionKeys: MvpProjectOptionKey[] = [
  "lint",
  "unit",
  "build",
  "coverage",
  "security",
  "docker",
];

export const projectOptionLabels: Record<MvpProjectOptionKey, string> = {
  lint: "Lint",
  unit: "Unit tests",
  build: "Build",
  coverage: "Coverage",
  security: "Security",
  docker: "Docker",
};

function optionDefaults(
  projectType: ProjectTypeOption | null,
  recipe: WorkflowRecipeOption | null,
): Record<MvpProjectOptionKey, boolean> {
  return Object.fromEntries(
    mvpProjectOptionKeys.map((key) => [
      key,
      Boolean(projectType?.defaultOptions[key]) && recipe?.supportedOptions[key] !== false,
    ]),
  ) as Record<MvpProjectOptionKey, boolean>;
}

function recipesForProject(
  projectType: ProjectTypeOption | null,
  recipes: WorkflowRecipeOption[],
): WorkflowRecipeOption[] {
  if (!projectType) {
    return [];
  }

  return recipes.filter(
    (recipe) =>
      projectType.allowedRecipes.includes(recipe.id) &&
      recipe.supportedProjectTypes.includes(projectType.id),
  );
}

/** The picked shape, project type, recipe and test options, changed together. */
interface Selection {
  repoShapeId: string;
  projectTypeId: string;
  workflowRecipeId: string;
  tests: Record<MvpProjectOptionKey, boolean>;
}

interface OptionsState {
  catalog: ProjectOptionsResponse;
  selection: Selection;
}

const initialOptions: OptionsState = {
  catalog: emptyCatalog,
  selection: {
    repoShapeId: "",
    projectTypeId: "",
    workflowRecipeId: "",
    tests: optionDefaults(null, null),
  },
};

function enabledShapesOf(catalog: ProjectOptionsResponse): RepoShapeOption[] {
  return catalog.repoShapes.filter((shape) => shape.enabled);
}

function typesForShape(catalog: ProjectOptionsResponse, repoShapeId: string): ProjectTypeOption[] {
  if (!repoShapeId) {
    return [];
  }

  return catalog.projectTypes.filter((projectType) => projectType.repoShapes.includes(repoShapeId));
}

/** The current id while the options still have it, else the first option's. */
function keepOrFirst(options: { id: string }[], current: string): string {
  if (options.some((option) => option.id === current)) {
    return current;
  }

  return options[0]?.id ?? "";
}

/** The current recipe while the project type still allows it, else its default, else the first. */
function pickRecipe(
  projectType: ProjectTypeOption | null,
  recipes: WorkflowRecipeOption[],
  current: string,
): string {
  if (!projectType || recipes.length === 0) {
    return "";
  }

  if (recipes.some((recipe) => recipe.id === current)) {
    return current;
  }

  const defaultRecipe = recipes.find((recipe) => recipe.id === projectType.defaultRecipe);
  return defaultRecipe?.id ?? recipes[0]?.id ?? "";
}

/** The project type and recipe objects a selection points at. */
function resolveSelection(catalog: ProjectOptionsResponse, selection: Selection) {
  const types = typesForShape(catalog, selection.repoShapeId);
  const projectType = types.find((option) => option.id === selection.projectTypeId) ?? null;
  const recipes = recipesForProject(projectType, catalog.recipes);
  const recipe = recipes.find((option) => option.id === selection.workflowRecipeId) ?? null;
  return { projectType, recipe };
}

/**
 * The project type once its list changed (a new shape or catalog): kept while
 * the new list has it, else the list's first. A dropped type also drops the
 * recipe, so the new type's default recipe applies.
 */
function settleProjectType(
  types: ProjectTypeOption[],
  draft: Selection,
  listChanged: boolean,
): { projectTypeId: string; recipeCandidate: string } {
  if (!listChanged) {
    return { projectTypeId: draft.projectTypeId, recipeCandidate: draft.workflowRecipeId };
  }

  const projectTypeId = keepOrFirst(types, draft.projectTypeId);
  const dropped = projectTypeId !== draft.projectTypeId;
  return { projectTypeId, recipeCandidate: dropped ? "" : draft.workflowRecipeId };
}

/**
 * Settles a selection after one of its inputs changed, the way the picks
 * cascade: a new catalog re-picks the shape; a new shape (or catalog)
 * re-picks the project type; a new project type (or catalog) re-picks the
 * recipe; a new project type or recipe resets the test options to their
 * defaults. A pick whose list did not change is kept as given.
 */
function settleSelection(
  previous: OptionsState,
  catalog: ProjectOptionsResponse,
  draft: Selection,
): OptionsState {
  const newCatalog = catalog !== previous.catalog;
  const repoShapeId = newCatalog ? keepOrFirst(enabledShapesOf(catalog), draft.repoShapeId) : draft.repoShapeId;
  const types = typesForShape(catalog, repoShapeId);
  const typesChanged = newCatalog || repoShapeId !== previous.selection.repoShapeId;
  const { projectTypeId, recipeCandidate } = settleProjectType(types, draft, typesChanged);
  const projectType = types.find((option) => option.id === projectTypeId) ?? null;
  const before = resolveSelection(previous.catalog, previous.selection);
  const recipes = recipesForProject(projectType, catalog.recipes);
  const recipesChanged = newCatalog || projectType !== before.projectType;
  const workflowRecipeId = recipesChanged
    ? pickRecipe(projectType, recipes, recipeCandidate)
    : draft.workflowRecipeId;
  const recipe = recipes.find((option) => option.id === workflowRecipeId) ?? null;
  const testsChanged = projectType !== before.projectType || recipe !== before.recipe;
  return {
    catalog,
    selection: {
      repoShapeId,
      projectTypeId,
      workflowRecipeId,
      tests: testsChanged ? optionDefaults(projectType, recipe) : draft.tests,
    },
  };
}

/**
 * The create-project options and the picks made from them. Each pick is
 * settled where it changes (the catalog read, a setter), never in an effect,
 * so a dependent pick never renders stale.
 */
export function useProjectOptionsCatalog() {
  const [options, setOptions] = useState<OptionsState>(initialOptions);
  const [loadingProjectOptions, setLoadingProjectOptions] = useState(false);
  const [projectOptionsError, setProjectOptionsError] = useState<string | null>(null);
  const { catalog, selection } = options;
  const { repoShapeId: selectedRepoShapeId, projectTypeId: selectedProjectTypeId } = selection;
  const { workflowRecipeId: selectedWorkflowRecipeId, tests } = selection;

  useEffect(() => {
    let active = true;

    async function loadProjectOptions() {
      setLoadingProjectOptions(true);
      setProjectOptionsError(null);

      try {
        const response = await getProjectOptions();
        if (!active) {
          return;
        }

        setOptions((current) => settleSelection(current, response, current.selection));
      } catch {
        if (!active) {
          return;
        }

        setOptions((current) => settleSelection(current, emptyCatalog, current.selection));
        setProjectOptionsError("Unable to load create project options right now.");
      } finally {
        if (active) {
          setLoadingProjectOptions(false);
        }
      }
    }

    void loadProjectOptions();

    return () => {
      active = false;
    };
  }, []);

  const enabledRepoShapes = useMemo(() => enabledShapesOf(catalog), [catalog]);

  const selectedRepoShape = useMemo<RepoShapeOption | null>(() => {
    return enabledRepoShapes.find((shape) => shape.id === selectedRepoShapeId) ?? null;
  }, [enabledRepoShapes, selectedRepoShapeId]);

  const projectTypesForShape = useMemo(
    () => typesForShape(catalog, selectedRepoShapeId),
    [catalog, selectedRepoShapeId],
  );

  const selectedProjectType = useMemo<ProjectTypeOption | null>(() => {
    return projectTypesForShape.find((projectType) => projectType.id === selectedProjectTypeId) ?? null;
  }, [projectTypesForShape, selectedProjectTypeId]);

  const recipesForSelectedProject = useMemo(
    () => recipesForProject(selectedProjectType, catalog.recipes),
    [catalog.recipes, selectedProjectType],
  );

  const selectedWorkflowRecipe = useMemo<WorkflowRecipeOption | null>(() => {
    return (
      recipesForSelectedProject.find((recipe) => recipe.id === selectedWorkflowRecipeId) ?? null
    );
  }, [recipesForSelectedProject, selectedWorkflowRecipeId]);

  /** Applies one pick, then settles the picks that depend on it. */
  const pick = useCallback((change: Partial<Omit<Selection, "tests">>) => {
    setOptions((current) =>
      settleSelection(current, current.catalog, { ...current.selection, ...change }),
    );
  }, []);

  const setSelectedRepoShapeId = useCallback(
    (repoShapeId: string) => {
      const target = catalog.repoShapes.find((shape) => shape.id === repoShapeId);
      if (target?.enabled) {
        pick({ repoShapeId });
      }
    },
    [catalog.repoShapes, pick],
  );

  const setSelectedProjectTypeId = useCallback(
    (projectTypeId: string) => pick({ projectTypeId }),
    [pick],
  );

  const setSelectedWorkflowRecipeId = useCallback(
    (workflowRecipeId: string) => pick({ workflowRecipeId }),
    [pick],
  );

  const toggleTestOption = useCallback(
    (key: MvpProjectOptionKey) => {
      if (!selectedWorkflowRecipe || selectedWorkflowRecipe.supportedOptions[key] === false) {
        return;
      }

      setOptions((current) => ({
        ...current,
        selection: {
          ...current.selection,
          tests: { ...current.selection.tests, [key]: !current.selection.tests[key] },
        },
      }));
    },
    [selectedWorkflowRecipe],
  );

  const supportedTestOptions = useMemo(() => {
    return mvpProjectOptionKeys.map((key) => ({
      key,
      label: projectOptionLabels[key],
      job: selectedWorkflowRecipe?.optionJobs[key],
      supported: selectedWorkflowRecipe?.supportedOptions[key] !== false,
      checked: Boolean(tests[key]),
    }));
  }, [selectedWorkflowRecipe, tests]);

  const isMicroservicesShape = selectedRepoShapeId === "microservices";
  const isMultiRepoShape = selectedRepoShapeId === "multi";

  const backendProjectTypes = useMemo(
    () =>
      projectTypesForShape.filter((projectType) =>
        projectType.kind
          ? projectType.kind === "backend"
          : ["nestjs", "nodejs"].includes(projectType.id),
      ),
    [projectTypesForShape],
  );

  const frontendProjectTypes = useMemo(
    () =>
      projectTypesForShape.filter((projectType) =>
        projectType.kind
          ? projectType.kind === "frontend"
          : ["nextjs", "react"].includes(projectType.id),
      ),
    [projectTypesForShape],
  );

  const defaultNodeVersion = catalog.nodeVersions.at(-1)?.value;

  return {
    allRepoShapes: catalog.repoShapes,
    backendProjectTypes,
    defaultNodeVersion,
    enabledRepoShapes,
    enforcedOrg: catalog.enforcedOrg,
    frontendProjectTypes,
    isMicroservicesShape,
    isMultiRepoShape,
    loadingProjectOptions,
    nodeVersions: catalog.nodeVersions,
    projectOptionsError,
    projectTypesForShape,
    recipesForSelectedProject,
    selectedProjectType,
    selectedProjectTypeId,
    selectedRepoShape,
    selectedRepoShapeId,
    selectedWorkflowRecipe,
    selectedWorkflowRecipeId,
    setSelectedProjectTypeId,
    setSelectedRepoShapeId,
    setSelectedWorkflowRecipeId,
    supportedTestOptions,
    tests,
    toggleTestOption,
  };
}

export type ProjectOptionsCatalogState = ReturnType<typeof useProjectOptionsCatalog>;
export type CreateProjectTests = Record<MvpProjectOptionKey, boolean>;
export type CreateProjectTestInput = Record<MvpProjectOptionKey, boolean> | ProjectOptionSet;
