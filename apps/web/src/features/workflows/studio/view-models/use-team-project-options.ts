"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { projectFoldersRepository } from "@/features/teams/project-folders";

import {
  projectChoiceOptions,
  type ProjectChoiceOption,
} from "../model/create-target-rules";

export type TeamProjectOptionsStatus = "idle" | "loading" | "ready" | "error";

export interface TeamProjectOptions {
  /** idle: not asked for (no team yet, or the caller need not choose). */
  status: TeamProjectOptionsStatus;
  /** The team's Projects, in the server's order (by name). */
  options: ProjectChoiceOption[];
  retry: () => void;
}

interface Loaded<T> {
  groupId: string;
  value: T;
}

/**
 * The Projects of the team a Developer is creating in, for the wizard's
 * "Choose the Project this repository belongs to." select.
 *
 * Results are kept with the team they belong to, so switching teams never
 * offers the previous team's Projects, and a request counter keeps a slow
 * first answer from overwriting a fast second one.
 */
export function useTeamProjectOptions(options: {
  groupId: string | null;
  enabled: boolean;
}): TeamProjectOptions {
  const { groupId, enabled } = options;
  const [loaded, setLoaded] = useState<Loaded<ProjectChoiceOption[]> | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    if (!enabled || !groupId) return;
    request.current += 1;
    const id = request.current;
    projectFoldersRepository
      .list(groupId)
      .then((snapshot) => {
        if (id !== request.current) return;
        setLoaded({ groupId, value: projectChoiceOptions(snapshot.folders) });
        setFailed(null);
      })
      .catch(() => {
        if (id === request.current) setFailed(groupId);
      });
  }, [enabled, groupId, nonce]);

  const retry = useCallback(() => {
    setFailed(null);
    setNonce((n) => n + 1);
  }, []);

  if (!enabled || !groupId) return { status: "idle", options: [], retry };
  if (loaded && loaded.groupId === groupId) return { status: "ready", options: loaded.value, retry };
  return { status: failed === groupId ? "error" : "loading", options: [], retry };
}
