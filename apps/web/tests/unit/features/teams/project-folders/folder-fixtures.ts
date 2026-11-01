import { ApiError } from "../../../../../src/shared/api/request";
import { normaliseProjectFolders } from "../../../../../src/features/teams/project-folders/model/project-folder-rules";
import type {
  ProjectFoldersResponseWire,
  ProjectFoldersSnapshot,
} from "../../../../../src/features/teams/project-folders/model/project-folder-types";

export const GROUP_ID = "ws-1";

/** Two Projects (a fe/be pair and an empty one) plus one unfiled project. */
export function foldersWire(overrides: Partial<ProjectFoldersResponseWire> = {}): ProjectFoldersResponseWire {
  return {
    groupId: GROUP_ID,
    canManage: true,
    folders: [
      {
        deliveryProjectId: "dp-1",
        systemId: "sys-1",
        name: "testfinals",
        createdAt: "2026-09-20T00:00:00.000Z",
        repositories: [
          {
            repositoryId: "repo-fe",
            name: "testfinals-frontend",
            repoFullName: "Org/testfinals-fe",
            status: "active",
            project: { id: "proj-fe", role: "frontend", status: "provisioned", repoShape: "multi-repo" },
          },
          {
            repositoryId: "repo-be",
            name: "testfinals-backend",
            repoFullName: "Org/testfinals-be",
            status: "active",
            project: { id: "proj-be", role: "backend", status: "provisioned", repoShape: "multi-repo" },
          },
        ],
      },
      {
        deliveryProjectId: "dp-2",
        systemId: "sys-1",
        name: "wallet",
        createdAt: "2026-09-21T00:00:00.000Z",
        repositories: [],
      },
    ],
    unfiled: [
      { id: "proj-blaine", name: "blaine", repoFullName: "Org/blaine", role: "app", status: "provisioned", repoShape: "standalone" },
    ],
    ...overrides,
  };
}

export function foldersSnapshot(overrides: Partial<ProjectFoldersResponseWire> = {}): ProjectFoldersSnapshot {
  return normaliseProjectFolders(foldersWire(overrides), GROUP_ID);
}

export function apiError(status: number, details?: unknown): ApiError {
  return new ApiError(`HTTP ${status}`, status, details);
}
