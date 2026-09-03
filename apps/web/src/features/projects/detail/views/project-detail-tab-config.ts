import { type SideTabGroup } from "@/features/groups/workspace";

import type { ProjectDetailTab } from "../model/project-detail-tab-rules";

/**
 * Grouped, and in a SIDE rail rather than a strip across the top.
 *
 * Nine entries will not fit a horizontal strip legibly, and the three new ones
 * are the reason: Code, Pull requests and Pipeline runs are where the work
 * actually is, so hiding them behind an overflow would bury the point of the
 * page. The headings turn a flat list into a map of what a project HAS, which
 * is the same reasoning — and the same component — as the Teams page.
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
    ],
  },
  { heading: "Records", items: [{ id: "audit", label: "Audit" }] },
  {
    heading: "Configuration",
    items: [{ id: "settings", label: "Settings" }],
  },
];
