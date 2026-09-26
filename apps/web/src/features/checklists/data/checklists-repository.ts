import { request } from "@/shared/api/request";

import type {
  CreateQaChecklistInput,
  QaChecklist,
  QaChecklistItemInput,
  QaChecklistListResponse,
  UpdateQaChecklistInput,
} from "../model/checklist-types";

/* The only place in the checklists domain that performs I/O. View-models call
 * this; views never do. Every write that edits a checklist carries the version
 * the caller read, so two leads editing at once get a 409 instead of silently
 * overwriting each other. */

function id(value: string): string {
  return encodeURIComponent(value);
}

function jsonBody(body: unknown): RequestInit {
  return { body: JSON.stringify(body) };
}

export const checklistsRepository = {
  listForWorkspace(
    workspaceId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<QaChecklistListResponse> {
    const includeArchived = options.includeArchived === true ? "true" : "false";
    return request<QaChecklistListResponse>(
      `/workspaces/${id(workspaceId)}/qa-checklists?includeArchived=${includeArchived}`,
    );
  },

  listForProject(projectId: string): Promise<QaChecklistListResponse> {
    return request<QaChecklistListResponse>(`/projects/${id(projectId)}/qa-checklists`);
  },

  get(checklistId: string): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}`);
  },

  create(workspaceId: string, input: CreateQaChecklistInput): Promise<QaChecklist> {
    return request<QaChecklist>(`/workspaces/${id(workspaceId)}/qa-checklists`, {
      method: "POST",
      ...jsonBody(input),
    });
  },

  update(checklistId: string, input: UpdateQaChecklistInput): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}`, {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  replaceItems(
    checklistId: string,
    expectedVersion: number,
    items: QaChecklistItemInput[],
  ): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}/items`, {
      method: "PUT",
      ...jsonBody({ expectedVersion, items }),
    });
  },

  archive(checklistId: string): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}/archive`, {
      method: "POST",
    });
  },

  share(checklistId: string, projectIds: string[]): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}/projects`, {
      method: "PUT",
      ...jsonBody({ projectIds }),
    });
  },

  /**
   * Add or remove individual project shares. Unlike `share` (a full replace),
   * this never touches a project it does not name, so a view scoped to a few
   * projects (a team Project's repositories) cannot un-share the rest.
   */
  updateShares(
    checklistId: string,
    change: { add?: string[]; remove?: string[] },
  ): Promise<QaChecklist> {
    return request<QaChecklist>(`/qa-checklists/${id(checklistId)}/projects`, {
      method: "PATCH",
      ...jsonBody(change),
    });
  },
};
