"use client";

import { useEffect, useMemo, useState } from "react";

import { getCategories, getTemplates } from "@/lib/api/client";
import type { CatalogTemplate, CategorySummary } from "@/lib/api/contracts";
import { categoryFallbacks, chooseSelectedTemplate } from "@/components/product/workflow-builder-utils";

export function useWorkflowCatalog() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [allTemplates, setAllTemplates] = useState<CatalogTemplate[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStack, setSelectedStack] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);

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
        setAllTemplates(templatesResponse.templates);
      } catch {
        if (!active) {
          return;
        }

        setCatalogError("Unable to load workflow templates from workflow-core right now.");
        setCategories([]);
        setAllTemplates([]);
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

  const fallbackCategories = useMemo(() => categoryFallbacks(allTemplates), [allTemplates]);
  const availableCategories = categories.length > 0 ? categories : fallbackCategories;

  const filteredTemplates = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();

    return allTemplates.filter((template) => {
      if (selectedCategory !== "All" && !template.categories.includes(selectedCategory)) {
        return false;
      }

      if (selectedStack !== "all" && template.stack !== selectedStack) {
        return false;
      }

      if (!lowerQuery) {
        return true;
      }

      return (
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.categories.some((category) => category.toLowerCase().includes(lowerQuery))
      );
    });
  }, [allTemplates, searchQuery, selectedCategory, selectedStack]);

  useEffect(() => {
    setSelectedTemplate((current) => chooseSelectedTemplate(filteredTemplates, current));
  }, [filteredTemplates]);

  return {
    allTemplates,
    availableCategories,
    catalogError,
    filteredTemplates,
    loadingCatalog,
    searchQuery,
    selectedCategory,
    selectedStack,
    selectedTemplate,
    setSearchQuery,
    setSelectedCategory,
    setSelectedStack,
    setSelectedTemplate,
  };
}

export type WorkflowCatalogState = ReturnType<typeof useWorkflowCatalog>;
