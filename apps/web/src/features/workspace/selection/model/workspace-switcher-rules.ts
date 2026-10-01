import { OTHER_TEAMS_HEADING, type WorkspaceSummary } from "./workspace-types";

/** The heading over an admin's own teams, when their other teams follow. */
export const OWN_TEAMS_HEADING = "Your teams";

/** One run of options in the header picker, with its heading (or none). */
export interface SwitcherOptionGroup {
  key: "own" | "other";
  /** null draws the options as a flat list with no heading. */
  label: string | null;
  options: readonly WorkspaceSummary[];
}

/**
 * The picker's groups. With no other teams (everyone but a platform admin) it
 * is one flat list, as it always was. An admin's non-member teams follow under
 * "Other teams (admin)", with the admin's own teams headed "Your teams" above
 * them for symmetry — or on their own when the admin belongs to no team.
 */
export function switcherOptionGroups(
  own: readonly WorkspaceSummary[],
  other: readonly WorkspaceSummary[],
): SwitcherOptionGroup[] {
  if (other.length === 0) {
    return own.length > 0 ? [{ key: "own", label: null, options: own }] : [];
  }
  const groups: SwitcherOptionGroup[] = [];
  if (own.length > 0) groups.push({ key: "own", label: OWN_TEAMS_HEADING, options: own });
  groups.push({ key: "other", label: OTHER_TEAMS_HEADING, options: other });
  return groups;
}

/**
 * The options in keyboard order. Group headings are not in it, so the arrow
 * keys never stop on one.
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
 * Where a key moves the active stop, among `count` stops (every option, then
 * the "Create workspace" action when it is offered), or null when the key does
 * not move it. Arrows wrap; Home and End jump to the ends.
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
