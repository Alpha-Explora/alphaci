/* Domain barrel — shared types and pure rules only.
 *
 * Actions are imported from their own slice (`@/features/teams/detail`,
 * `@/features/teams/settings`, …) so a consumer pulls in one action rather
 * than the whole domain. */
export type {
  ProvisionedProject,
  Team,
  TeamsStatus,
} from "./model/teams-types";

export {
  SETTINGS_TEAM_TAB,
  TEAM_PAGE_PATHS,
  canManageTeamSettings,
  legacyTeamsRedirect,
  memberCountLabel,
  resolveSelectedTeam,
  teamMembersHref,
} from "./model/teams-rules";
