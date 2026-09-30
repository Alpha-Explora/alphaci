"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getDeliveryProject } from "@/features/groups";
import type { WorkspaceSummary } from "@/shared/api/contracts";

import {
  effectiveDeliveryProjectId,
  parseCreateTargetParams,
  readTargetProject,
  targetProjectLabel,
  type ResolvedTargetProject,
} from "../model/create-target-rules";

export interface CreateTarget {
  /** The team a link asked for on arrival; the workspace load preselects it. */
  initialGroupId: string | null;
  /** "Team / Project" for the wizard, or null when no Project applies. */
  label: string | null;
  /** The Project id to send for a repository created in `workspaceId`. */
  deliveryProjectIdFor: (workspaceId: string | null | undefined) => string | undefined;
}

/**
 * Reads `?group=` and `?project=` for the Create Project wizard.
 *
 * `?project=` is resolved against the server before it is used, so a stale or
 * foreign id is dropped instead of sent. A later link to the same page (the
 * studio's own "Create repository in this Project") changes the search params
 * without remounting, so the change is applied while rendering, the way React
 * recommends for state derived from a changing input.
 */
export function useCreateTarget(options: {
  guest: boolean;
  workspaces: WorkspaceSummary[] | null;
  selectedWorkspaceId: string | null;
  selectWorkspace: (workspaceId: string) => void;
  openSetup: () => void;
}): CreateTarget {
  const { guest, workspaces, selectedWorkspaceId, selectWorkspace, openSetup } = options;
  const searchParams = useSearchParams();
  const link = parseCreateTargetParams(searchParams);
  const [initialGroupId] = useState(link.groupId);
  const [target, setTarget] = useState<ResolvedTargetProject | null>(null);
  const searchKey = searchParams.toString();
  const [seenSearch, setSeenSearch] = useState(searchKey);

  if (searchKey !== seenSearch) {
    setSeenSearch(searchKey);
    if (searchParams.get("tab") === "setup") openSetup();
    if (link.groupId && workspaces?.some((workspace) => workspace.id === link.groupId)) {
      selectWorkspace(link.groupId);
    }
    if (!link.deliveryProjectId) setTarget(null);
  }

  // Only a wizard link (?tab=setup) names a Project to create IN. Without it,
  // ?project= is the Projects view opening that Project's detail, and must not
  // quietly file the next repository created from the header's button there.
  const deliveryProjectId =
    searchParams.get("tab") === "setup" ? link.deliveryProjectId : null;
  useEffect(() => {
    if (!deliveryProjectId || guest) return;
    let active = true;
    getDeliveryProject(deliveryProjectId)
      .then((raw) => {
        if (active) setTarget(readTargetProject(raw, deliveryProjectId));
      })
      .catch(() => {
        // Not found, not visible, or offline: create without a Project, as
        // before this link existed, rather than blocking the wizard.
        if (active) setTarget(null);
      });
    return () => {
      active = false;
    };
  }, [deliveryProjectId, guest]);

  return {
    initialGroupId,
    label: targetProjectLabel(target, selectedWorkspaceId, workspaces),
    deliveryProjectIdFor: (workspaceId) => effectiveDeliveryProjectId(target, workspaceId),
  };
}
