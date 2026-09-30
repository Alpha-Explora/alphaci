/* The chrome and the selected-team ViewModel every team page shares: /teams
 * (members), /checklists, /activity, and the Settings page's Team tab. The
 * header's workspace picker is the only team selector; nothing here keeps a
 * second one. */
export {
  TeamPageShell,
  type TeamPageContext,
  type TeamPageHeading,
  type TeamPageShellProps,
} from "./views/team-page-shell";
export { TeamsEmptyState } from "./views/teams-empty-state";
export {
  useSelectedTeamViewModel,
  type SelectedTeamViewModel,
} from "./view-models/use-selected-team-view-model";
