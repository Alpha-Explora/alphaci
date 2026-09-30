"use client";

import { usePathname } from "next/navigation";

import { useCapabilities } from "@/features/capabilities/current";
import { useNotificationsSummaryViewModel } from "@/features/notifications/summary";

import { sidebarMainItems, type SidebarMainItem } from "../model/workspace-types";
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
  /** The same signal that shows Admin: adds "Other teams (admin)" to the picker. */
  isPlatformAdmin?: boolean;
}): AppNavViewModel {
  const pathname = usePathname();
  const workspaces = useWorkspaceSelectionViewModel({
    enabled: !options.guest,
    includeOtherTeams: Boolean(options.isPlatformAdmin),
  });
  const notifications = useNotificationsSummaryViewModel({ guest: options.guest });
  const { qaChecklistsEnabled } = useCapabilities();

  return {
    pathname,
    status: workspaces.status,
    error: workspaces.error,
    workspaces,
    notifications,
    mainItems: sidebarMainItems({ guest: options.guest, qaChecklistsEnabled }),
  };
}
