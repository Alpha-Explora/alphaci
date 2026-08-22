/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/home/dashboard`) so a
 * consumer pulls in one action rather than the whole domain. */
export type {
  DeliveryPortfolioNode,
  ProjectTone,
  RunStats,
  SectionStatus,
} from "./model/home-types";

export {
  computeRunStats,
  projectBadgeLabel,
  projectTone,
  shortRepoName,
  timeAgo,
} from "./model/home-rules";
