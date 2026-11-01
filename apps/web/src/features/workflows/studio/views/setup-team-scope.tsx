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

/**
 * The Project the new repository joins: a `?project=` link's, or the one a
 * Developer picked. The one context line once a Project is known; its team is
 * the Project's own, so no team box is shown beside it. A picked Project can
 * be let go of, to bring the team picker back.
 */
function TargetProjectLine({
  label,
  onClearProject,
}: Readonly<{ label: string; onClearProject: (() => void) | null }>) {
  return (
    <div className="repo-creation-scope" role="status" data-testid="setup-target-project">
      <span className="repo-creation-scope__dot" aria-hidden="true" />
      <span>
        <strong>Project: {label}</strong> The new repository joins this
        Project. For a frontend and backend pair, both do.
      </span>
      {onClearProject ? (
        <button
          type="button"
          className="inline-link repo-creation-scope__action"
          onClick={onClearProject}
        >
          Change team
        </button>
      ) : null}
    </div>
  );
}

export function SetupTeamScope({
  creationScope,
  isExistingMode,
  onChangeWorkspace,
  onClearProject = null,
  projectKnown = false,
  selectedWorkspaceId,
  workspaces,
  targetProjectLabel,
}: Readonly<{
  creationScope: "choose-team" | "in-team";
  isExistingMode: boolean;
  onChangeWorkspace?: (workspaceId: string | null) => void;
  /** Un-pick a Developer's Project (several teams only), or null. */
  onClearProject?: (() => void) | null;
  /** A Project is known, so its team is used and no team box is shown. */
  projectKnown?: boolean;
  selectedWorkspaceId?: string | null;
  workspaces?: WorkspaceSummary[] | null;
  /** "Team / Project" for the known Project, or null. */
  targetProjectLabel?: string | null;
}>) {
  if (isExistingMode) {
    return null;
  }
  if (projectKnown && targetProjectLabel) {
    const canChangeTeam = countWorkspaces(workspaces) > 1 ? onClearProject : null;
    return <TargetProjectLine label={targetProjectLabel} onClearProject={canChangeTeam} />;
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
