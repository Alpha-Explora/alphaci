import { type SideTabGroup } from "@/features/groups/workspace";

import type { ProjectDetailTab } from "../model/project-detail-tab-rules";

/**
 * Grouped, and in a strip across the top rather than a SIDE rail.
 *
 * The rail was here because nine entries do not fit a strip comfortably, and
 * it cost the page a 200px column on every screen — beside Code, diffs and run
 * logs, which are the widest things the product shows. The strip gives that
 * width back; the nine entries are kept legible by scrolling rather than
 * wrapping or hiding any behind an overflow menu.
 *
 * The groups survive the move, drawn as clusters separated by a rule instead
 * of by headings: a heading per group would make the bar two rows tall, and
 * the clusters alone still say a project HAS work, a pipeline, delivery,
 * records and configuration. ProjectDetailTopTabs draws them; the Teams page
 * keeps the rail, where a heading still costs nothing.
 *
 * The order follows the order work moves in: read it, propose it, watch it run,
 * see the rules that ran. Delivery, records and configuration sit after,
 * because they are consulted rather than worked in.
 */
export const PROJECT_DETAIL_TAB_GROUPS: ReadonlyArray<
  SideTabGroup<ProjectDetailTab>
> = [
  {
    heading: "Work",
    items: [
      { id: "overview", label: "Overview" },
      { id: "code", label: "Code" },
      { id: "pulls", label: "Pull requests" },
      { id: "checklists", label: "Checklists" },
    ],
  },
  {
    heading: "Pipeline",
    items: [
      { id: "runs", label: "Pipeline runs" },
      { id: "workflow", label: "Workflow" },
    ],
  },
  {
    heading: "Delivery",
    items: [
      { id: "hosting", label: "Hosting" },
      { id: "environment", label: "Environment" },
      { id: "qa", label: "QA Studio" },
      { id: "po", label: "PO Studio" },
    ],
  },
  { heading: "Records", items: [{ id: "audit", label: "Audit" }] },
  {
    heading: "Configuration",
    items: [{ id: "settings", label: "Settings" }],
  },
];

/**
 * The groups with only the tabs this viewer gets. A group left empty is
 * dropped, so a hidden tab never leaves a stray divider in the strip.
 */
export function projectDetailTabGroups(
  visible: ReadonlyArray<ProjectDetailTab>,
): Array<SideTabGroup<ProjectDetailTab>> {
  return PROJECT_DETAIL_TAB_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => visible.includes(item.id)),
  })).filter((group) => group.items.length > 0);
}
