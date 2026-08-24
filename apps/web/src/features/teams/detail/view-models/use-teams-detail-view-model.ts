"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaceSelection } from "@/features/workspace/selection";

import { teamsRepository } from "../../data/teams-repository";
import { resolveSelectedTeam, toUserError } from "../../model/teams-rules";
import type {
  ProvisionedProject,
  Team,
  TeamsStatus,
} from "../../model/teams-types";

export interface TeamsDetailViewModel {
  /** The team on screen, or null when the caller is in none. */
  team: Team | null;
  projects: ProvisionedProject[];
  status: TeamsStatus;
  /** Safe to render. Never an API detail. */
  error: string | null;
  /** Re-read the team list and drop it from the header picker too. */
  reload: () => void;
  /** Re-read the team list only — membership changed, the team still exists. */
  refreshTeam: () => void;
}

/**
 * ViewModel for the team detail surface.
 *
 * The header owns which team is selected, so this reads the selection from
 * WorkspaceProvider rather than holding its own. Exposes `status` plus a
 * user-safe `error`, as the skill requires of any interactive view-model.
 */
export function useTeamsDetailViewModel(options: {
  /** Guests see the sign-in gate instead of a fetch. */
  guest: boolean;
  /** Only fetch once the session is known good. */
  enabled: boolean;
}): TeamsDetailViewModel {
  const { guest, enabled } = options;
  const { selectedWorkspaceId, refreshWorkspaces } = useWorkspaceSelection();

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
      .then((loaded) => {
        if (!active || id !== teamsRequest.current) return;
        setTeams(loaded);
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
    if (!teamId) return;

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
        // the panel renders its own empty state rather than failing the surface.
        if (!active || id !== projectsRequest.current) return;
        setLoaded({ teamId, items: [] });
      });

    return () => {
      active = false;
    };
  }, [teamId, nonce]);

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
  };
}
