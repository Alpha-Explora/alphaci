import { request } from "@/shared/api/request";

import { normalizeTestCategories } from "../model/test-case-rules";
import type { TestCaseInput, TestCategoryDefinition } from "../model/test-case-types";
import { record } from "../model/wire-readers";

/* The only place in the checklists domain that writes QA's test cases: the
 * categories and test cases under a User story (ADR-0014, amendment 10).
 * Only the QA Team and admins may; the server refuses everyone else with
 * TEST_CASE_MANAGE_FORBIDDEN. Every write answers the story's whole set,
 * normalised here. Edits carry the row version read. */

const enc = encodeURIComponent;

function storyPath(requirementId: string, itemId: string): string {
  return `/requirements/${enc(requirementId)}/items/${enc(itemId)}`;
}

function send(method: "POST" | "PATCH" | "DELETE", body?: unknown): RequestInit {
  return body === undefined ? { method } : { method, body: JSON.stringify(body) };
}

async function categoriesFrom(promise: Promise<unknown>): Promise<TestCategoryDefinition[]> {
  return normalizeTestCategories(record(await promise)?.testCategories);
}

export const testCasesRepository = {
  addCategory(requirementId: string, itemId: string, name: string): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(request<unknown>(`${storyPath(requirementId, itemId)}/test-categories`, send("POST", { name })));
  },

  renameCategory(
    requirementId: string,
    itemId: string,
    categoryId: string,
    input: { name: string; expectedRowVersion: number },
  ): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(
      request<unknown>(`${storyPath(requirementId, itemId)}/test-categories/${enc(categoryId)}`, send("PATCH", input)),
    );
  },

  /** Deletes the category with its test cases. */
  deleteCategory(requirementId: string, itemId: string, categoryId: string): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(
      request<unknown>(`${storyPath(requirementId, itemId)}/test-categories/${enc(categoryId)}`, send("DELETE")),
    );
  },

  addTestCase(
    requirementId: string,
    itemId: string,
    categoryId: string,
    input: TestCaseInput,
  ): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(
      request<unknown>(
        `${storyPath(requirementId, itemId)}/test-categories/${enc(categoryId)}/test-cases`,
        send("POST", input),
      ),
    );
  },

  updateTestCase(
    requirementId: string,
    itemId: string,
    testCaseId: string,
    input: TestCaseInput & { expectedRowVersion: number },
  ): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(
      request<unknown>(`${storyPath(requirementId, itemId)}/test-cases/${enc(testCaseId)}`, send("PATCH", input)),
    );
  },

  deleteTestCase(requirementId: string, itemId: string, testCaseId: string): Promise<TestCategoryDefinition[]> {
    return categoriesFrom(
      request<unknown>(`${storyPath(requirementId, itemId)}/test-cases/${enc(testCaseId)}`, send("DELETE")),
    );
  },
};
