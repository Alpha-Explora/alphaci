"use client";

import Link from "next/link";

import { LoadingRows } from "@/features/groups/workspace";
import { useSelectedTeamViewModel } from "@/features/teams/shell";

import { canManageTeamSettings, teamMembersHref } from "../../model/teams-rules";
import { TeamSettingsPanel } from "./team-settings-panel";

/**
 * The Settings page's Team tab: the settings of the team selected in the
 * header. The Settings page already sits inside a WorkspaceProvider with the
 * header, so the selection is read from there; nothing here picks a team.
 */
export function SelectedTeamSettings({ enabled = true }: Readonly<{ enabled?: boolean }>) {
  const vm = useSelectedTeamViewModel({ guest: false, enabled, loadProjects: true });
  const team = vm.team;

  if (vm.status === "loading" || vm.status === "idle") return <LoadingRows rows={3} />;
  if (vm.error) {
    return (
      <p className="error-text" role="alert" style={{ margin: 0 }}>
        {vm.error}
      </p>
    );
  }
  if (!team) {
    return (
      <p className="team-settings__lede">
        You are not in a team yet. Create one from the picker in the header.
      </p>
    );
  }
  if (!canManageTeamSettings(team.role)) {
    return (
      <p className="team-settings__lede">
        Only a Lead or Delegated lead of {team.name} can change its settings.{" "}
        <Link className="inline-link" href={teamMembersHref(team.id)}>
          See its members
        </Link>
      </p>
    );
  }
  return (
    <TeamSettingsPanel
      key={team.id}
      team={team}
      projectCount={vm.projects.length}
      onChanged={vm.refreshTeam}
      onDeleted={vm.reload}
    />
  );
}
