"use client";

import { SelectedTeamSettings } from "@/features/teams/settings";

import { SettingsSection, UserIcon } from "./settings-chrome";

/**
 * The Team tab: the header team's own settings — details, the Lead, archive,
 * and delete. It was the Configuration > Settings entry of the old team rail;
 * the Settings page is where settings live now.
 */
export function SettingsTeamSection({ teamName }: Readonly<{ teamName: string | null }>) {
  return (
    <SettingsSection icon={<UserIcon />} title={teamName ? `Team · ${teamName}` : "Team"} index={0}>
      <SelectedTeamSettings />
    </SettingsSection>
  );
}
