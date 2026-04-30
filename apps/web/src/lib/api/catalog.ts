import type {
  CatalogCategoriesResponse,
  CatalogTemplatesResponse,
  ProjectOptionsResponse,
} from "./contracts";
import { request } from "./request";

export async function getCategories(): Promise<CatalogCategoriesResponse> {
  return request<CatalogCategoriesResponse>("/catalog/categories");
}

export async function getTemplates(params: {
  category?: string;
  stack?: string;
  q?: string;
}): Promise<CatalogTemplatesResponse> {
  const search = new URLSearchParams();
  if (params.category) {
    search.set("category", params.category);
  }
  if (params.stack) {
    search.set("stack", params.stack);
  }
  if (params.q) {
    search.set("q", params.q);
  }

  const suffix = search.size ? `?${search.toString()}` : "";
  return request<CatalogTemplatesResponse>(`/catalog/templates${suffix}`);
}

export async function getProjectOptions(): Promise<ProjectOptionsResponse> {
  return request<ProjectOptionsResponse>("/catalog/project-options");
}
