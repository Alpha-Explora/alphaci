/* Pure rules for the teams domain. No React, no Next, no fetch. */
import { ApiError } from "@/shared/api/request";

import type { Team } from "./teams-types";

/**
 * Which team this page shows.
 *
 * The header owns the selection, but fall back to the first team so the page is
 * never blank merely because nothing has been picked yet this session. Resolved
 * as a rule rather than at render time because the project fetch is scoped to
 * whatever this returns.
 */
export function resolveSelectedTeam(
  teams: readonly Team[] | null,
  selectedId: string | null,
): Team | null {
  const list = teams ?? [];
  return list.find((team) => team.id === selectedId) ?? list[0] ?? null;
}

/** Plural-aware member count, e.g. "1 member" / "4 members". */
export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

const GENERIC_LOAD_ERROR = "Could not load this team.";

/**
 * Map a thrown value to a message safe to render.
 *
 * The route collapsed every failure into one string, so a signed-out session
 * and a deleted team read identically. Views receive this, never the error.
 */
export function toUserError(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_LOAD_ERROR;

  switch (err.status) {
    case 401:
      return "Your session expired. Please sign in again.";
    case 403:
      return "You do not have access to this team.";
    case 404:
      return "This team no longer exists.";
    default:
      return GENERIC_LOAD_ERROR;
  }
}
