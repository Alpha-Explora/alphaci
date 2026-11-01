/* Pure rules for the settings surface. No React, no Next, no fetch. */

import { canManageTeamSettings } from "@/features/teams";

import type { SettingsSection } from "./settings-types";

/** App roles that lead teams. An allow-list: a new role (qa, …) is not one. */
const TEAM_LEAD_APP_ROLES: ReadonlySet<string> = new Set(["lead", "admin"]);

/**
 * Whether the Settings rail offers the Team tab for the header's team.
 *
 * Lead/admin only: the caller leads that team (Lead or Delegated lead there),
 * or holds a lead/admin app role — which the backend already treats as the
 * Lead of every team they are in. The tab itself re-checks against the team
 * record before showing a single control.
 */
export function canSeeTeamSettingsTab(
  teamRole: string | null | undefined,
  appRole: string | null | undefined,
): boolean {
  if (!teamRole) return false;
  return canManageTeamSettings(teamRole) || TEAM_LEAD_APP_ROLES.has(appRole ?? "");
}

/**
 * Whether the account-deletion button should be armed.
 *
 * The confirmation is the user's own login typed exactly — not a fixed word —
 * so the phrase differs per account and cannot be muscle-memoried.
 */
export function canDeleteAccount(
  typed: string,
  login: string | undefined,
): boolean {
  return Boolean(login) && typed === login;
}

/**
 * The settings rail, in order. "Team" (the header team's own settings) sits
 * under Account, and only for someone allowed to change that team.
 */
export function settingsNavSections(canManageTeam: boolean): SettingsSection[] {
  return [
    "account",
    ...(canManageTeam ? (["team"] as const) : []),
    "appearance",
    "connections",
    "guide",
    "danger",
  ];
}

const SECTIONS: ReadonlySet<string> = new Set<SettingsSection>([
  "account",
  "team",
  "appearance",
  "connections",
  "guide",
  "danger",
]);

/**
 * The section a `/settings?tab=…` link opens on — the forwarded
 * `/teams?section=settings` lands on `?tab=team`. Anything unknown opens
 * Account, as a plain /settings always has.
 */
export function settingsSectionFromSearch(search: string): SettingsSection {
  const tab = new URLSearchParams(search).get("tab") ?? "";
  return SECTIONS.has(tab) ? (tab as SettingsSection) : "account";
}

/**
 * The section to draw. The Team tab falls back to Account while the caller
 * may not see it — including while the header is still resolving their team,
 * after which a `?tab=team` link settles on Team without another click.
 */
export function visibleSettingsSection(
  active: SettingsSection,
  canManageTeam: boolean,
): SettingsSection {
  return active === "team" && !canManageTeam ? "account" : active;
}
