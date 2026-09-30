import { getGroups } from "@/features/groups";
import { getMyWorkspaces as requestMyWorkspaces } from "@/features/workspace/selection/data/workspaces-api";
import type { WorkspacesMeResponse as WorkspacesMeDto } from "@/shared/api/contracts";

import type { WorkspacesMeResponse } from "../model/workspace-types";

function mapWorkspaces(response: WorkspacesMeDto): WorkspacesMeResponse {
  return {
    enabled: response.enabled,
    items: response.items.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      kind: workspace.kind,
      role: workspace.role,
    })),
  };
}

export async function getWorkspaces(): Promise<WorkspacesMeResponse> {
  return mapWorkspaces(await requestMyWorkspaces());
}

/**
 * Every team the caller can see, as id + name. For a platform admin that is
 * all of them — the header subtracts their own teams to get "Other teams".
 */
export async function getVisibleTeams(): Promise<Array<{ id: string; name: string }>> {
  const groups = await getGroups();
  return groups.map((group) => ({ id: group.id, name: group.name }));
}
