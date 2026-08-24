import { getMyWorkspaces as requestMyWorkspaces } from "@/lib/api/workspaces";
import type { WorkspacesMeResponse as WorkspacesMeDto } from "@/lib/api/contracts";

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
