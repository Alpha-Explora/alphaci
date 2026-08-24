/* Pure rules for the project detail surface. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

/** Status-badge variant for a provisioned project. */
export function projectStatusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

/**
 * Whether a repository sits outside the org the product provisions into.
 *
 * Only labels already-attached repositories; existing external attachments are
 * left alone by design. Unknown org means no claim either way.
 */
export function isExternalRepo(
  repoFullName: string,
  enforcedOrg?: string,
): boolean {
  if (!enforcedOrg) return false;
  return repoFullName.split("/")[0]?.toLowerCase() !== enforcedOrg.toLowerCase();
}

/**
 * Message for a failed overview load.
 *
 * 404 is called out separately because it usually means the project was
 * disconnected rather than that something broke, and saying "retry" there would
 * send someone round a loop that cannot succeed.
 */
export function toOverviewError(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 404) {
    return "This project could not be found. It may have been disconnected.";
  }
  return "Could not load this project. Please retry.";
}
