/**
 * The Projects of a team that a new member can join, for the Add member
 * dialog. Reads the team's Projects explorer (GET /groups/:id/project-folders),
 * which lists only active Projects.
 *
 * Its own module rather than more functions in hierarchy-api.ts: existing
 * tests replace that module with jest.mock factories, and a new export there
 * would be missing from every one of them.
 */

import type { TeamProjectChoice } from '@/features/groups/data/hierarchy-contracts';
import { request } from '@/shared/api/request';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Keeps only well-formed folders, sorted by name as the explorer shows them. */
export function toTeamProjectChoices(raw: unknown): TeamProjectChoice[] {
  const folders =
    isRecord(raw) && Array.isArray(raw['folders']) ? raw['folders'] : [];
  const choices: TeamProjectChoice[] = [];
  for (const folder of folders) {
    if (!isRecord(folder)) continue;
    const { deliveryProjectId, name } = folder;
    if (typeof deliveryProjectId === 'string' && typeof name === 'string') {
      choices.push({ deliveryProjectId, name });
    }
  }
  return choices.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export async function getTeamProjectChoices(
  groupId: string,
): Promise<TeamProjectChoice[]> {
  const raw = await request<unknown>(
    `/groups/${encodeURIComponent(groupId)}/project-folders`,
  );
  return toTeamProjectChoices(raw);
}
