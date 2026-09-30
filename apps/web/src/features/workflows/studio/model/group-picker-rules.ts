/* The /workflows group dropdown: which groups a search shows, which group the
 * page opens on, and how the choice is written back into the URL. Pure. */

/** Case-insensitive "name contains", on the trimmed query. Blank shows every group. */
export function filterGroupsByName<T extends { name: string }>(
  groups: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...groups];
  return groups.filter((group) => group.name.toLowerCase().includes(needle));
}

/**
 * The group the page opens on: the `?group=` link when it names a listed group,
 * else the header's selected workspace when it is listed, else the first group.
 *
 * The header selection is only READ. The header lists the teams the caller is a
 * member of; for an admin the groups list holds every team, so the page never
 * writes its choice back into the header.
 */
export function chooseInitialGroupId(input: {
  requestedGroupId: string | null | undefined;
  headerWorkspaceId: string | null | undefined;
  groupIds: readonly string[];
}): string | null {
  const { requestedGroupId, headerWorkspaceId, groupIds } = input;
  if (requestedGroupId && groupIds.includes(requestedGroupId)) return requestedGroupId;
  if (headerWorkspaceId && groupIds.includes(headerWorkspaceId)) return headerWorkspaceId;
  return groupIds[0] ?? null;
}

/**
 * The query string after choosing a group: `group` set, every other param kept
 * except `tab`. The dropdown only exists on the projects view, and a leftover
 * `tab=setup` would send the page back to the create view on the next change.
 */
export function searchWithGroup(search: string, groupId: string): string {
  const params = new URLSearchParams(search);
  params.set("group", groupId);
  params.delete("tab");
  return params.toString();
}

/** "1 repository", "12 repositories". */
export function repositoryCountText(count: number): string {
  return `${count} ${count === 1 ? "repository" : "repositories"}`;
}

/**
 * The option to highlight when the list opens or the query changes: the
 * selected group when it is still listed, else the first option, else none.
 */
export function initialActiveIndex(
  options: readonly { id: string }[],
  selectedId: string | null,
): number {
  if (options.length === 0) return -1;
  const index = options.findIndex((option) => option.id === selectedId);
  return index === -1 ? 0 : index;
}

/** Up/Down within the list, clamped at both ends (no wrap). */
export function stepActiveIndex(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  return Math.min(count - 1, Math.max(0, current + delta));
}

/** The team the create view preselects for a group, kept only when the caller can create in it. */
export function createWorkspaceForGroup(
  groupId: string | null,
  workspaces: readonly { id: string }[] | null,
  current: string | null,
): string | null {
  if (!groupId) return current;
  // Unknown list: take the group; the workspace load keeps an existing choice.
  if (workspaces === null) return groupId;
  return workspaces.some((workspace) => workspace.id === groupId) ? groupId : current;
}
