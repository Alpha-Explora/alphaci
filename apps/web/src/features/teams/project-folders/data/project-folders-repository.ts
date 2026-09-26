import { checklistsRepository } from "@/features/checklists";
import { archiveDeliveryProject } from "@/features/groups";
import { request } from "@/shared/api/request";

import {
  normaliseChecklist,
  normaliseChecklists,
  normaliseMoveOutcome,
  normaliseProjectFolders,
} from "../model/project-folder-rules";
import type {
  ChecklistProjectsPatch,
  CreateProjectFolderRequest,
  FolderChecklist,
  MoveOutcome,
  MoveRepositoryRequest,
  ProjectFoldersSnapshot,
} from "../model/project-folder-types";

/* The only place in the project explorer that performs I/O. View-models call
 * this; views never do. Every read is normalised here, so nothing above this
 * file ever sees a raw wire object. */

const enc = encodeURIComponent;

export const projectFoldersRepository = {
  async list(groupId: string): Promise<ProjectFoldersSnapshot> {
    const raw = await request<unknown>(`/groups/${enc(groupId)}/project-folders`);
    return normaliseProjectFolders(raw, groupId);
  },

  /** Creates an empty Project in the team. Lead/admin only. */
  async create(groupId: string, input: CreateProjectFolderRequest): Promise<void> {
    await request<unknown>(`/groups/${enc(groupId)}/projects`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async moveRepository(repositoryId: string, deliveryProjectId: string): Promise<MoveOutcome> {
    const body: MoveRepositoryRequest = { deliveryProjectId };
    const raw = await request<unknown>(`/repositories/${enc(repositoryId)}/move`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return normaliseMoveOutcome(raw);
  },

  /** Hide an emptied Project (reuses the existing delivery-project archive). */
  async archive(deliveryProjectId: string): Promise<void> {
    await archiveDeliveryProject(deliveryProjectId);
  },

  /** The team's live checklists, for the per-Project count and attach list. */
  async listChecklists(groupId: string): Promise<FolderChecklist[]> {
    const response = await checklistsRepository.listForWorkspace(groupId);
    return normaliseChecklists((response as { items?: unknown } | null)?.items);
  },

  /** PATCH, never the PUT full replace: a Project must not un-share the rest. */
  async updateChecklistShares(
    checklistId: string,
    change: ChecklistProjectsPatch,
  ): Promise<FolderChecklist | null> {
    const saved = await checklistsRepository.updateShares(checklistId, change);
    return normaliseChecklist(saved);
  },
};
