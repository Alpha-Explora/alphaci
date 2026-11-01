import { deleteAccount } from "@/features/auth/session";
import { getMyWorkspaces, getWorkspaceMembers } from "@/features/workspace";
import type { WorkspaceMemberSummary } from "@/shared/api/contracts";

import type { WorkspacesMeResponse } from "../model/settings-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */
export const settingsRepository = {
  workspaces(): Promise<WorkspacesMeResponse> {
    return getMyWorkspaces();
  },

  /** Read-only: the roster is edited on /teams. */
  workspaceMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
    return getWorkspaceMembers(workspaceId);
  },

  /** Irreversible. The view gates this behind a typed confirmation. */
  deleteAccount(): Promise<void> {
    return deleteAccount().then(() => undefined);
  },
};
