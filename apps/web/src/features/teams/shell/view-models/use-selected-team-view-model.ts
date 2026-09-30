"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCapabilities } from "@/features/capabilities/current";
import { useWorkspaceSelection } from "@/features/workspace/selection";

import { teamsRepository } from "../../data/teams-repository";
import { resolveSelectedTeam, toUserError } from "../../model/teams-rules";
import type {
  ProvisionedProject,
  Team,
  TeamsStatus,
} from "../../model/teams-types";

export interface SelectedTeamViewModel {
  /** The team on screen, or null when the caller is in none. */
  team: Team | null;
  /** The team's repositories; always empty unless asked for with `loadProjects`. */
  projects: ProvisionedProject[];
  status: TeamsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** Re-read the team list and drop it from the header picker too. */
  reload: () => void;
  /** Re-read the team list only — membership changed, the team still exists. */
  refreshTeam: () => void;
  /** Backend capability: show the QA checklists surfaces. */
  qaChecklistsEnabled: boolean;
  /** False until the capabilities have loaded, so "off" is never a guess. */
  capabilitiesKnown: boolean;
}

/**
 * ViewModel for every team-scoped page: Teams (members), Checklists, Activity
 * and the Settings page's Team tab.
 *
 * The header owns which team is selected, so this reads the selection from
 * WorkspaceProvider rather than holding its own — no page carries a second
 * team picker that could disagree with it. Exposes `status` plus a user-safe
 * `error`, as the skill requires of any interactive view-model.
 */
export function useSelectedTeamViewModel(options: {
  /** Guests see the sign-in gate instead of a fetch. */
  guest: boolean;
  /** Only fetch once the session is known good. */
  enabled: boolean;
  /**
   * Also load the team's repositories — the checklist Share dialog offers
   * them, and deleting a team warns about them. Pages that need neither skip
   * the request.
   */
  loadProjects?: boolean;
}): SelectedTeamViewModel {
  const { guest, enabled, loadProjects = false } = options;
  const { selectedWorkspaceId, refreshWorkspaces } = useWorkspaceSelection();
  const { qaChecklistsEnabled, status: capabilitiesStatus } = useCapabilities();

  const [teams, setTeams] = useState<Team[] | null>(null);
  // Kept with the team it belongs to, so projects are derived rather than
  // cleared by an effect. That also stops the previous team's repositories
  // showing under the new team's heading during a switch.
  const [loaded, setLoaded] = useState<{
    teamId: string;
    items: ProvisionedProject[];
  } | null>(null);
  const [fetchStatus, setFetchStatus] = useState<TeamsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const teamsRequest = useRef(0);
  const projectsRequest = useRef(0);

  const team = useMemo(
    () => resolveSelectedTeam(teams, selectedWorkspaceId),
    [teams, selectedWorkspaceId],
  );
  const teamId = team?.id ?? null;

  useEffect(() => {
    if (!enabled || guest) return;

    teamsRequest.current += 1;
    const id = teamsRequest.current;
    let active = true;

    teamsRepository
      .list()
      .then((loadedTeams) => {
        if (!active || id !== teamsRequest.current) return;
        setTeams(loadedTeams);
        setError(null);
        setFetchStatus("ready");
      })
      .catch((err: unknown) => {
        if (!active || id !== teamsRequest.current) return;
        setTeams([]);
        setError(toUserError(err));
        setFetchStatus("error");
      });

    return () => {
      active = false;
    };
  }, [enabled, guest, nonce]);

  // Scoped to whichever team is on screen, and re-run when the header switches.
  useEffect(() => {
    if (!teamId || !loadProjects) return;

    projectsRequest.current += 1;
    const id = projectsRequest.current;
    let active = true;

    teamsRepository
      .listProjects(teamId)
      .then((items) => {
        if (!active || id !== projectsRequest.current) return;
        setLoaded({ teamId, items });
      })
      .catch(() => {
        // A team that loads but whose projects do not is still a usable page;
        // the section renders its own empty state rather than failing it.
        if (!active || id !== projectsRequest.current) return;
        setLoaded({ teamId, items: [] });
      });

    return () => {
      active = false;
    };
  }, [teamId, loadProjects, nonce]);

  const refreshTeam = useCallback(() => setNonce((n) => n + 1), []);

  // Both, deliberately: the list re-read updates this page, and
  // refreshWorkspaces drops the team from the header picker — which otherwise
  // kept offering a team that no longer exists.
  const reload = useCallback(() => {
    setNonce((n) => n + 1);
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  return {
    team,
    projects: loaded && loaded.teamId === teamId ? loaded.items : [],
    status: guest || !enabled ? "idle" : fetchStatus,
    error,
    reload,
    refreshTeam,
    qaChecklistsEnabled,
    capabilitiesKnown: capabilitiesStatus !== "loading",
  };
}
