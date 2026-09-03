"use client";

import type { WorkspaceSummary } from "@/shared/api/contracts";
import { countWorkspaces, soleWorkspaceOf, teamChoiceState } from "../model/setup-tab-rules";

function InTeamScopeCopy() {
  return (
    <span>
      <strong>Team repository</strong> This repository belongs to the
      selected team, and every member of it can see the project.
    </span>
  );
}

function TeamPicker({
  onChangeWorkspace,
  selectedWorkspaceId,
  workspaces,
}: Readonly<{
  onChangeWorkspace?: (workspaceId: string | null) => void;
  selectedWorkspaceId?: string | null;
  workspaces?: WorkspaceSummary[] | null;
}>) {
  return (
    <label className="repo-creation-scope__picker">
      <span>
        <strong>Team</strong> Every member of the team you choose can
        see this project.
      </span>
      <select
        value={selectedWorkspaceId ?? ""}
        data-testid="setup-workspace-select"
        onChange={(event) =>
          onChangeWorkspace?.(event.target.value || null)
        }
      >
        <option value="">Select a team…</option>
        {workspaces?.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoTeamCopy() {
  return (
    <span>
      <strong>No team yet</strong> Every project belongs to a team.
      Ask a team admin to add you to one before creating a project.
    </span>
  );
}

function SoleOrDefaultTeamCopy({
  soleWorkspace,
}: Readonly<{ soleWorkspace: WorkspaceSummary | null }>) {
  if (soleWorkspace) {
    return (
      <span>
        <strong>Team repository</strong>{" "}
        {`This repository belongs to ${soleWorkspace.name}, and every member of it can see the project.`}
      </span>
    );
  }
  return (
    <span>
      <strong>Team repository</strong>{" "}
      Every member of your team can see this project.
    </span>
  );
}

function TeamScopeMessage({
  creationScope,
  hasNoTeam,
  needsTeamChoice,
  onChangeWorkspace,
  selectedWorkspaceId,
  soleWorkspace,
  workspaces,
}: Readonly<{
  creationScope: "choose-team" | "in-team";
  hasNoTeam: boolean;
  needsTeamChoice: boolean;
  onChangeWorkspace?: (workspaceId: string | null) => void;
  selectedWorkspaceId?: string | null;
  soleWorkspace: WorkspaceSummary | null;
  workspaces?: WorkspaceSummary[] | null;
}>) {
  if (creationScope === "in-team") {
    return <InTeamScopeCopy />;
  }
  if (needsTeamChoice) {
    /* Several teams and no group context: the caller picks. This
       used to claim the repository belonged to nobody but them,
       which stopped being true when personal workspaces were
       removed — a project now always belongs to a team. */
    return (
      <TeamPicker
        onChangeWorkspace={onChangeWorkspace}
        selectedWorkspaceId={selectedWorkspaceId}
        workspaces={workspaces}
      />
    );
  }
  if (hasNoTeam) {
    return <NoTeamCopy />;
  }
  return <SoleOrDefaultTeamCopy soleWorkspace={soleWorkspace} />;
}

export function SetupTeamScope({
  creationScope,
  isExistingMode,
  onChangeWorkspace,
  selectedWorkspaceId,
  workspaces,
}: Readonly<{
  creationScope: "choose-team" | "in-team";
  isExistingMode: boolean;
  onChangeWorkspace?: (workspaceId: string | null) => void;
  selectedWorkspaceId?: string | null;
  workspaces?: WorkspaceSummary[] | null;
}>) {
  if (isExistingMode) {
    return null;
  }

  const team = teamChoiceState({
    creationScope,
    workspaceCount: countWorkspaces(workspaces),
    selectedWorkspaceId,
  });
  const soleWorkspace = soleWorkspaceOf(team.mustChooseTeam, workspaces);

  return (
    <div className="repo-creation-scope" role="status">
      <span className="repo-creation-scope__dot" aria-hidden="true" />
      <TeamScopeMessage
        creationScope={creationScope}
        hasNoTeam={team.hasNoTeam}
        needsTeamChoice={team.needsTeamChoice}
        onChangeWorkspace={onChangeWorkspace}
        selectedWorkspaceId={selectedWorkspaceId}
        soleWorkspace={soleWorkspace}
        workspaces={workspaces}
      />
    </div>
  );
}
