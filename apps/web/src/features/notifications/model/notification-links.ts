/* Where clicking a notification goes (spec §8.6). Pure — no React, no fetch,
 * no Next router. Every id read goes through `?? null` so an older backend
 * that omits projectId/groupId/deliveryProjectId entirely behaves exactly
 * like one that sends them as null. */

import type { AppRole } from "@/shared/api/contracts";
import { studioTabFor } from "@/features/projects/detail";

import { isQaRefusal, qaRefusalHref } from "./notifications-rules";
import type { NotificationItem } from "./notifications-types";

/** The event codes covered by §6's "Returned to Dev" loop and §5's promotion
 * flow: all land in the viewer's studio (QA Studio or PO Studio), else Overview. */
const QA_STUDIO_DEEP_LINK_EVENTS: ReadonlySet<string> = new Set([
  "qa.run.signed_off",
  "qa.item.retest_requested",
  "qa.promotion.merged",
]);

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
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
  return `${projectPath(projectId)}#${studioTabFor(appRole) ?? "overview"}`;
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

  if (isQaRefusal(item)) {
    return qaRefusalHref(item);
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
