"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getProjectOptions } from "@/lib/api/client";
import type {
  MvpProjectOptionKey,
  ProjectOptionSet,
  ProjectOptionsResponse,
  ProjectTypeOption,
  RepoShapeOption,
  WorkflowRecipeOption,
} from "@/lib/api/contracts";

const emptyCatalog: ProjectOptionsResponse = {
  repoShapes: [],
  projectTypes: [],
  recipes: [],
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

export function useProjectOptionsCatalog() {
  const [catalog, setCatalog] = useState<ProjectOptionsResponse>(emptyCatalog);
  const [loadingProjectOptions, setLoadingProjectOptions] = useState(false);
  const [projectOptionsError, setProjectOptionsError] = useState<string | null>(null);
  const [selectedRepoShapeId, setSelectedRepoShapeIdState] = useState("");
  const [selectedProjectTypeId, setSelectedProjectTypeId] = useState("");
  const [selectedWorkflowRecipeId, setSelectedWorkflowRecipeId] = useState("");
  const [tests, setTests] = useState<Record<MvpProjectOptionKey, boolean>>(
    optionDefaults(null, null),
  );

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

        setCatalog(response);
      } catch {
        if (!active) {
          return;
        }

        setCatalog(emptyCatalog);
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

  const enabledRepoShapes = useMemo(
    () => catalog.repoShapes.filter((shape) => shape.enabled),
    [catalog.repoShapes],
  );

  const selectedRepoShape = useMemo<RepoShapeOption | null>(() => {
    return enabledRepoShapes.find((shape) => shape.id === selectedRepoShapeId) ?? null;
  }, [enabledRepoShapes, selectedRepoShapeId]);

  useEffect(() => {
    if (enabledRepoShapes.length === 0) {
      setSelectedRepoShapeIdState("");
      return;
    }

    setSelectedRepoShapeIdState((current) => {
      if (enabledRepoShapes.some((shape) => shape.id === current)) {
        return current;
      }

      return enabledRepoShapes[0]?.id ?? "";
    });
  }, [enabledRepoShapes]);

  const projectTypesForShape = useMemo(() => {
    if (!selectedRepoShapeId) {
      return [];
    }

    return catalog.projectTypes.filter((projectType) =>
      projectType.repoShapes.includes(selectedRepoShapeId),
    );
  }, [catalog.projectTypes, selectedRepoShapeId]);

  const selectedProjectType = useMemo<ProjectTypeOption | null>(() => {
    return projectTypesForShape.find((projectType) => projectType.id === selectedProjectTypeId) ?? null;
  }, [projectTypesForShape, selectedProjectTypeId]);

  useEffect(() => {
    if (projectTypesForShape.length === 0) {
      setSelectedProjectTypeId("");
      return;
    }

    setSelectedProjectTypeId((current) => {
      if (projectTypesForShape.some((projectType) => projectType.id === current)) {
        return current;
      }

      return projectTypesForShape[0]?.id ?? "";
    });
  }, [projectTypesForShape]);

  const recipesForSelectedProject = useMemo(
    () => recipesForProject(selectedProjectType, catalog.recipes),
    [catalog.recipes, selectedProjectType],
  );

  const selectedWorkflowRecipe = useMemo<WorkflowRecipeOption | null>(() => {
    return (
      recipesForSelectedProject.find((recipe) => recipe.id === selectedWorkflowRecipeId) ?? null
    );
  }, [recipesForSelectedProject, selectedWorkflowRecipeId]);

  useEffect(() => {
    if (!selectedProjectType || recipesForSelectedProject.length === 0) {
      setSelectedWorkflowRecipeId("");
      return;
    }

    setSelectedWorkflowRecipeId((current) => {
      if (recipesForSelectedProject.some((recipe) => recipe.id === current)) {
        return current;
      }

      const defaultRecipe = recipesForSelectedProject.find(
        (recipe) => recipe.id === selectedProjectType.defaultRecipe,
      );
      return defaultRecipe?.id ?? recipesForSelectedProject[0]?.id ?? "";
    });
  }, [recipesForSelectedProject, selectedProjectType]);

  useEffect(() => {
    setTests(optionDefaults(selectedProjectType, selectedWorkflowRecipe));
  }, [selectedProjectType, selectedWorkflowRecipe]);

  const setSelectedRepoShapeId = useCallback(
    (repoShapeId: string) => {
      const target = catalog.repoShapes.find((shape) => shape.id === repoShapeId);
      if (target?.enabled) {
        setSelectedRepoShapeIdState(repoShapeId);
      }
    },
    [catalog.repoShapes],
  );

  const toggleTestOption = useCallback(
    (key: MvpProjectOptionKey) => {
      if (!selectedWorkflowRecipe || selectedWorkflowRecipe.supportedOptions[key] === false) {
        return;
      }

      setTests((current) => ({
        ...current,
        [key]: !current[key],
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

  return {
    allRepoShapes: catalog.repoShapes,
    enabledRepoShapes,
    loadingProjectOptions,
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
