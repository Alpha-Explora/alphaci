"use client";

import { usePathname } from "next/navigation";

import { useNotificationsSummaryViewModel } from "@/features/notifications/summary";

import { useWorkspaceSelectionViewModel } from "./use-workspace-selection-view-model";

export interface AppNavViewModel {
  pathname: string;
  status: ReturnType<typeof useWorkspaceSelectionViewModel>["status"];
  error: string | null;
  notifications: ReturnType<typeof useNotificationsSummaryViewModel>;
  workspaces: ReturnType<typeof useWorkspaceSelectionViewModel>;
}

/** Route state and shell data for the navigation view. */
export function useAppNavViewModel(options: { guest: boolean }): AppNavViewModel {
  const pathname = usePathname();
  const workspaces = useWorkspaceSelectionViewModel({ enabled: !options.guest });
  const notifications = useNotificationsSummaryViewModel({ guest: options.guest });

  return { pathname, status: workspaces.status, error: workspaces.error, workspaces, notifications };
}
