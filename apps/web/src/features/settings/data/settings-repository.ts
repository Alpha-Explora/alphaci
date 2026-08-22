import { deleteAccount } from "@/lib/api/auth";
import { getMyWorkspaces } from "@/lib/api/workspaces";

import type { WorkspacesMeResponse } from "../model/settings-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */
export const settingsRepository = {
  workspaces(): Promise<WorkspacesMeResponse> {
    return getMyWorkspaces();
  },

  /** Irreversible. The view gates this behind a typed confirmation. */
  deleteAccount(): Promise<void> {
    return deleteAccount().then(() => undefined);
  },
};
