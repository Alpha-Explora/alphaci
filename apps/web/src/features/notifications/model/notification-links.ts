/* Where clicking a notification goes (spec §8.6). Pure — no React, no fetch,
 * no Next router. Every id read goes through `?? null` so an older backend
 * that omits projectId/groupId/deliveryProjectId entirely behaves exactly
 * like one that sends them as null. */

import type { AppRole } from "@/shared/api/contracts";
import { canOpenQaStudio } from "@/features/projects/detail";

import type { NotificationItem } from "./notifications-types";

/** The event codes covered by §6's "Returned to Dev" loop and §5's promotion
 * flow: all land in QA Studio for a viewer who may open it, else Overview. */
const QA_STUDIO_DEEP_LINK_EVENTS: ReadonlySet<string> = new Set([
  "qa.run.signed_off",
  "qa.item.retest_requested",
  "qa.item.blocked",
  "qa.promotion.merged",
]);

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

/** §6: the developer goes to Overview, with the "My QA items" card asked to
 * scroll into view and briefly highlight itself. */
function returnedToDevHref(projectId: string | null): string | null {
  if (!projectId) return null;
  return `${projectPath(projectId)}?focus=my-qa-items#overview`;
}

/** §7: straight into the project folder when both ids are known, else the
 * plain project page (an older backend, or a project outside any folder). */
function projectCreatedHref(input: {
  projectId: string | null;
  groupId: string | null;
  deliveryProjectId: string | null;
}): string | null {
  if (input.groupId && input.deliveryProjectId) {
    return `/groups/${encodeURIComponent(input.groupId)}/delivery-projects/${encodeURIComponent(input.deliveryProjectId)}`;
  }
  if (!input.projectId) return null;
  return projectPath(input.projectId);
}

function qaStudioDeepLinkHref(
  projectId: string | null,
  appRole: AppRole | null | undefined,
): string | null {
  if (!projectId) return null;
  return `${projectPath(projectId)}#${canOpenQaStudio(appRole) ? "qa" : "overview"}`;
}

/**
 * The href for a notification row, or null when it has nowhere to go (no
 * `projectId` at all — the row stays a plain, non-interactive row).
 */
export function notificationHref(
  item: Pick<NotificationItem, "eventCode" | "projectId" | "groupId" | "deliveryProjectId">,
  appRole: AppRole | null | undefined,
): string | null {
  const projectId = item.projectId ?? null;

  if (item.eventCode === "qa.item.returned_to_dev") {
    return returnedToDevHref(projectId);
  }
  if (item.eventCode === "project_created") {
    return projectCreatedHref({
      projectId,
      groupId: item.groupId ?? null,
      deliveryProjectId: item.deliveryProjectId ?? null,
    });
  }
  if (QA_STUDIO_DEEP_LINK_EVENTS.has(item.eventCode)) {
    return qaStudioDeepLinkHref(projectId, appRole);
  }
  if (!projectId) return null;
  return projectPath(projectId);
}
