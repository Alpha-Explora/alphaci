import type { WorkspaceSummary } from "./workspace-types";

/** The one heading over the picker's list of teams. */
export const OWN_TEAMS_HEADING = "Your teams";

/** One run of options in the header picker, with its heading. */
export interface SwitcherOptionGroup {
  key: "own";
  label: string;
  options: readonly WorkspaceSummary[];
}

/**
 * The picker's groups: ONE list under "Your teams" holding every team the
 * user can open, their own and (for a platform admin) the others, merged and
 * sorted by name. Empty when there is nothing to list.
 */
export function switcherOptionGroups(
  own: readonly WorkspaceSummary[],
  other: readonly WorkspaceSummary[],
): SwitcherOptionGroup[] {
  const options = [...own, ...other].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) ||
      a.id.localeCompare(b.id),
  );
  return options.length > 0 ? [{ key: "own", label: OWN_TEAMS_HEADING, options }] : [];
}

/**
 * The team a page that belongs to one (a project's owning team) should put in
 * the header, or null when there is nothing to do.
 *
 * It waits for the header's lists (`members` is null until they load) and
 * only names a team the header actually lists, so a project in a team the
 * viewer cannot open leaves the provider's own fallback in place instead of
 * persisting an id the picker would immediately reset. `appliedFor` is the
 * team already applied for this page: applying it once is what lets the
 * viewer's own pick stand, and a later list refresh not undo it.
 */
export function pageWorkspaceToSelect(input: {
  pageWorkspaceId: string | null | undefined;
  appliedFor: string | null;
  members: { items: readonly Pick<WorkspaceSummary, "id">[] } | null;
  others: readonly Pick<WorkspaceSummary, "id">[];
}): string | null {
  const { pageWorkspaceId, appliedFor, members, others } = input;
  if (!pageWorkspaceId || !members || pageWorkspaceId === appliedFor) return null;
  const listed = [...members.items, ...others].some((team) => team.id === pageWorkspaceId);
  return listed ? pageWorkspaceId : null;
}

/**
 * The options in keyboard order. The heading is not in it, so the arrow keys
 * never stop on it.
 */
export function flattenSwitcherOptions(
  groups: readonly SwitcherOptionGroup[],
): WorkspaceSummary[] {
  return groups.flatMap((group) => [...group.options]);
}

/**
 * The index the panel opens on: the current team, so the arrow keys start
 * from where the user is, or the first option when the current one is not
 * listed.
 */
export function openingSwitcherIndex(
  options: readonly Pick<WorkspaceSummary, "id">[],
  currentId: string | null,
): number {
  const index = options.findIndex((option) => option.id === currentId);
  return index >= 0 ? index : 0;
}

/**
 * Where a key moves the active stop, among `count` teams, or null when the
 * key does not move it. Arrows wrap; Home and End jump to the ends.
 */
export function nextSwitcherIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return index < 0 || index >= count - 1 ? 0 : index + 1;
    case "ArrowUp":
      return index <= 0 ? count - 1 : index - 1;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** What Tab does inside the open panel: hop to the "+" button, back to the list, or leave. */
export type PanelTabAction = "to-create" | "to-list" | "close";

/**
 * Tab goes list -> "+" button (when offered) -> out of the panel, which closes
 * it; Shift+Tab from the "+" button goes back to the list.
 */
export function panelTabAction(
  shiftKey: boolean,
  onCreateButton: boolean,
  canCreate: boolean,
): PanelTabAction {
  if (onCreateButton) return shiftKey ? "to-list" : "close";
  return !shiftKey && canCreate ? "to-create" : "close";
}

/**
 * How far (px) to slide the open panel sideways so it stays on screen. It
 * opens under the trigger's left edge; on a phone the trigger sits mid-header
 * and a wide panel would run off the right edge, so it moves left — but never
 * past the left margin. 0 when it already fits.
 */
export function switcherPanelShift(
  panelLeft: number,
  panelRight: number,
  viewportWidth: number,
  margin = 8,
): number {
  let shift = 0;
  if (panelRight > viewportWidth - margin) shift = viewportWidth - margin - panelRight;
  if (panelLeft + shift < margin) shift = margin - panelLeft;
  return Math.round(shift);
}
