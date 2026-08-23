/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/groups/detail`,
 * `@/features/groups/members`, …) so a consumer pulls in one action rather
 * than the whole domain. */
export type {
  DeliveryProject,
  GroupMember,
  GroupSummary,
  HierarchyRepository,
  HierarchySystem,
} from "./model/groups-types";

export {
  isGlobalCreatorRole,
  isGroupManagerRole,
  projectStatusVariant,
  repoShortName,
} from "./model/groups-rules";
