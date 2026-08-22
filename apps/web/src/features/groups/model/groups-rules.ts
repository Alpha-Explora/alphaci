/* Pure rules for the groups domain. No React, no Next, no fetch.
 *
 * The two role predicates are re-exported rather than imported from lib/api by
 * each view: they are pure, but reaching into the API layer from a view is what
 * the boundary rules forbid, so the model is the way in. */
export {
  isGlobalCreatorRole,
  isGroupManagerRole,
} from "@/lib/api/hierarchy-contracts";

/** Status-badge variant for a provisioned project on the group projects grid. */
export function projectStatusVariant(status: string): string {
  if (status === "provisioned") return "provisioned";
  if (status === "provisioning" || status === "pending") return "provisioning";
  return "failed";
}

/** "acme/orders-api" -> "orders-api". Falls back to the whole string. */
export function repoShortName(repoFullName: string): string {
  return repoFullName.split("/")[1] ?? repoFullName;
}
