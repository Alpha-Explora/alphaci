/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/teams/detail`) so a
 * consumer pulls in one action rather than the whole domain. */
export type {
  ProvisionedProject,
  Team,
  TeamsStatus,
} from "./model/teams-types";

export { memberCountLabel, resolveSelectedTeam } from "./model/teams-rules";
