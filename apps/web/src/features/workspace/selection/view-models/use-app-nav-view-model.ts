"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import { useHostAvailability } from "@/features/hosts/availability";
import { useNotificationsSummaryViewModel } from "@/features/notifications/summary";

import {
  canOpenTeamActivity,
  sidebarMainItems,
  type SidebarMainItem,
  type WorkspaceAppRole,
} from "../model/workspace-types";
import { pageWorkspaceToSelect } from "../model/workspace-switcher-rules";
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

/**
 * Puts the page's own team in the header once the header has listed it.
 *
 * An effect rather than `WorkspaceProvider`'s `initialWorkspaceId`: that is
 * read once on mount, and a project's team is only known after its overview
 * loads. Applied once per team, so the viewer's own pick afterwards stands.
 */
function useSelectPageWorkspace(pageWorkspaceId: string | null | undefined) {
  const { workspaces, otherWorkspaces, setSelectedWorkspaceId } =
    useWorkspaceSelection();
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    const next = pageWorkspaceToSelect({
      pageWorkspaceId,
      appliedFor: appliedFor.current,
      members: workspaces,
      others: otherWorkspaces,
    });
    if (!next) return;
    appliedFor.current = next;
    setSelectedWorkspaceId(next);
  }, [otherWorkspaces, pageWorkspaceId, setSelectedWorkspaceId, workspaces]);
}

/** Route state and shell data for the navigation view. */
export function useAppNavViewModel(options: {
  guest: boolean;
  /** The same signal that shows Admin: adds the other teams to the picker. */
  isPlatformAdmin?: boolean;
  /** The session's global role and platform role: who may open /activity. */
  appRole?: WorkspaceAppRole | null;
  platformRole?: string | null;
  /**
   * The team the page belongs to (a project's owning team), selected in the
   * header once it is known and listed. Omitted by pages that are not scoped
   * to one team.
   */
  pageWorkspaceId?: string | null;
}): AppNavViewModel {
  const pathname = usePathname();
  const workspaces = useWorkspaceSelectionViewModel({
    enabled: !options.guest,
    includeOtherTeams: Boolean(options.isPlatformAdmin),
  });
  useSelectPageWorkspace(options.pageWorkspaceId);
  const notifications = useNotificationsSummaryViewModel({
    guest: options.guest,
  });
  const { qaChecklistsEnabled, envProvisioningEnabled } = useCapabilities();
  const hostAvailability = useHostAvailability(
    !options.guest && envProvisioningEnabled,
  );
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
    mainItems: sidebarMainItems({
      guest: options.guest,
      qaChecklistsEnabled,
      canOpenActivity,
      hostsEnabled: hostAvailability === "enabled",
    }),
  };
}
