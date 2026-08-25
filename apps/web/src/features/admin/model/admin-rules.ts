/* Pure rules for the admin console. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

import type { AppRole, FeedbackStatus } from "./admin-types";

/** Roles the console offers, most privileged first. */
export const ROLE_ORDER: AppRole[] = ["admin", "lead", "member"];

/** Triage cycles forward and wraps, so one control advances any record. */
export const NEXT_FEEDBACK_STATUS: Record<FeedbackStatus, FeedbackStatus> = {
  open: "in_review",
  in_review: "resolved",
  resolved: "dismissed",
  dismissed: "open",
};

export const FEEDBACK_STATUS_FILTERS: Array<{
  value: FeedbackStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

/**
 * Turns a failed role write into something worth showing.
 *
 * The backend's own message is preferred where there is one: it is the only
 * thing that explains *why* a change was refused (super-admin only, last
 * admin, and so on), which a generic string would throw away. 403 is special
 * cased because the API says nothing useful for it.
 *
 * Reads as a fragment: callers embed it after "Failed to update role: ".
 */
export function describeRoleError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 403) return "you need platform-admin access.";
    const detail = cause.details as { message?: string | string[] } | undefined;
    const message = Array.isArray(detail?.message)
      ? detail?.message.join(", ")
      : detail?.message;
    return message ?? `request failed (${String(cause.status)}).`;
  }
  return "unexpected error. Please try again.";
}
