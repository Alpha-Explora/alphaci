"use client";

import { usePathname } from "next/navigation";

import { useCapabilities } from "@/features/capabilities/current";
import { useNotificationsSummaryViewModel } from "@/features/notifications/summary";

import {
  canOpenTeamActivity,
  sidebarMainItems,
  type SidebarMainItem,
  type WorkspaceAppRole,
} from "../model/workspace-types";
import { useWorkspaceSelection } from "../views/workspace-selection-context";
import { useWorkspaceSelectionViewModel } from "./use-workspace-selection-view-model";

export interface AppNavViewModel {
  pathname: string;
  status: ReturnType<typeof useWorkspaceSelectionViewModel>["status"];
  error: string | null;
  notifications: ReturnType<typeof useNotificationsSummaryViewModel>;
  workspaces: ReturnType<typeof useWorkspaceSelectionViewModel>;
  /** The Main entries to draw, in order. */
  mainItems: SidebarMainItem[];
}

/** Route state and shell data for the navigation view. */
export function useAppNavViewModel(options: {
  guest: boolean;
  /** The same signal that shows Admin: adds the other teams to the picker. */
  isPlatformAdmin?: boolean;
  /** The session's global role and platform role: who may open /activity. */
  appRole?: WorkspaceAppRole | null;
  platformRole?: string | null;
}): AppNavViewModel {
  const pathname = usePathname();
  const workspaces = useWorkspaceSelectionViewModel({
    enabled: !options.guest,
    includeOtherTeams: Boolean(options.isPlatformAdmin),
  });
  const notifications = useNotificationsSummaryViewModel({ guest: options.guest });
  const { qaChecklistsEnabled } = useCapabilities();
  // The header team's role decides Activity: the feed is per team, and the
  // backend opens it to that team's Lead and Delegated leads only.
  const { selectedWorkspace } = useWorkspaceSelection();
  const canOpenActivity = canOpenTeamActivity({
    guest: options.guest,
    appRole: options.appRole,
    platformRole: options.platformRole,
    teamRole: selectedWorkspace?.role ?? null,
  });

  return {
    pathname,
    status: workspaces.status,
    error: workspaces.error,
    workspaces,
    notifications,
    mainItems: sidebarMainItems({ guest: options.guest, qaChecklistsEnabled, canOpenActivity }),
  };
}
