'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  getCategories,
  getTemplates,
} from '@/features/workflows/studio/data/catalog-api';
import type { CatalogTemplate, CategorySummary } from '@/shared/api/contracts';
import {
  categoryFallbacks,
  chooseSelectedTemplate,
} from '../model/workflow-studio-rules';

interface TemplateFilters {
  category: string;
  stack: string;
  query: string;
}

/** The templates, the filters and the template picked under them, changed together. */
interface TemplateView extends TemplateFilters {
  templates: CatalogTemplate[];
  selected: CatalogTemplate | null;
}

const INITIAL_VIEW: TemplateView = {
  templates: [],
  category: 'All',
  stack: 'all',
  query: '',
  selected: null,
};

function filterTemplates(
  templates: CatalogTemplate[],
  filters: TemplateFilters,
): CatalogTemplate[] {
  const lowerQuery = filters.query.trim().toLowerCase();

  return templates.filter((template) => {
    if (
      filters.category !== 'All' &&
      !template.categories.includes(filters.category)
    ) {
      return false;
    }

    if (filters.stack !== 'all' && template.stack !== filters.stack) {
      return false;
    }

    if (!lowerQuery) {
      return true;
    }

    return (
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.categories.some((category) =>
        category.toLowerCase().includes(lowerQuery),
      )
    );
  });
}

/** Keeps the picked template while the filtered list still has it, else the list's first. */
function withSelection(view: TemplateView): TemplateView {
  return {
    ...view,
    selected: chooseSelectedTemplate(
      filterTemplates(view.templates, view),
      view.selected,
    ),
  };
}

function sameFilters(
  view: TemplateView,
  change: Partial<TemplateFilters>,
): boolean {
  return (Object.keys(change) as (keyof TemplateFilters)[]).every(
    (key) => view[key] === change[key],
  );
}

/**
 * The template catalog and its local filters. The picked template is settled
 * where the list changes (the catalog read, a filter change), never in an effect.
 */
export function useWorkflowCatalog() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [view, setView] = useState<TemplateView>(INITIAL_VIEW);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      setLoadingCatalog(true);
      setCatalogError(null);

      try {
        const [categoriesResponse, templatesResponse] = await Promise.all([
          getCategories(),
          getTemplates({}),
        ]);

        if (!active) {
          return;
        }

        setCategories(categoriesResponse.categories);
        setView((current) =>
          withSelection({ ...current, templates: templatesResponse.templates }),
        );
      } catch {
        if (!active) {
          return;
        }

        setCatalogError(
          'Unable to load workflow templates from cicd-workflow right now.',
        );
        setCategories([]);
        setView((current) => withSelection({ ...current, templates: [] }));
      } finally {
        if (active) {
          setLoadingCatalog(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  const {
    templates: allTemplates,
    category: selectedCategory,
    stack: selectedStack,
    query: searchQuery,
  } = view;
  const fallbackCategories = useMemo(
    () => categoryFallbacks(allTemplates),
    [allTemplates],
  );
  const availableCategories =
    categories.length > 0 ? categories : fallbackCategories;

  const filteredTemplates = useMemo(
    () =>
      filterTemplates(allTemplates, {
        category: selectedCategory,
        stack: selectedStack,
        query: searchQuery,
      }),
    [allTemplates, searchQuery, selectedCategory, selectedStack],
  );

  /** A filter change re-settles the picked template against the new list. */
  function changeFilters(change: Partial<TemplateFilters>) {
    setView((current) =>
      sameFilters(current, change)
        ? current
        : withSelection({ ...current, ...change }),
    );
  }

  return {
    allTemplates,
    availableCategories,
    catalogError,
    filteredTemplates,
    loadingCatalog,
    /** Uniform status field: loading or ready, per the VM contract. */
    status: loadingCatalog ? ('loading' as const) : ('ready' as const),
    /** Uniform error field: same as catalogError. */
    error: catalogError,
    searchQuery,
    selectedCategory,
    selectedStack,
    selectedTemplate: view.selected,
    setSearchQuery: (query: string) => changeFilters({ query }),
    setSelectedCategory: (category: string) => changeFilters({ category }),
    setSelectedStack: (stack: string) => changeFilters({ stack }),
    setSelectedTemplate: (selected: CatalogTemplate | null) =>
      setView((current) => ({ ...current, selected })),
  };
}

export type WorkflowCatalogState = ReturnType<typeof useWorkflowCatalog>;
