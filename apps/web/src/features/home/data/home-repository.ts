import { completeOnboarding } from "@/features/auth/session";
import {
  getDeliveryProjectRepositories,
  getGroupActivity,
  getGroupSystems,
  getMyAssignedRepositories,
  getMyGroups,
  getSystemDeliveryProjects,
} from "@/features/groups";
import { getWorkflowHistory } from "@/features/workflows";
import { getProjects } from "@/features/projects";
import { getRuns } from "@/features/runs";
import { isGroupManagerRole } from "@/features/groups";

import type {
  DeliveryPortfolioNode,
  GroupActivityItem,
  GroupSummary,
  MyAssignedRepository,
  ProvisionedProject,
  RunGroup,
  WorkflowHistoryItem,
} from "../model/home-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */

/** Matches the window the dashboard has always requested. */
const HISTORY_LIMIT = 25;
const PROJECTS_LIMIT = 25;
const ACTIVITY_LIMIT = 4;

/** Everything the workspace overview needs, assembled in one call. */
export interface WorkspaceOverview {
  /** The selected group, or null when the selection matches none. */
  group: GroupSummary | null;
  portfolio: DeliveryPortfolioNode[];
  assignments: MyAssignedRepository[];
  /** Empty unless the caller manages the group — activity is lead-only. */
  activity: GroupActivityItem[];
}

export const homeRepository = {
  async workflowHistory(): Promise<WorkflowHistoryItem[]> {
    const res = await getWorkflowHistory(HISTORY_LIMIT);
    return res.items;
  },

  async projects(workspaceId: string | null): Promise<ProvisionedProject[]> {
    const res = await getProjects(PROJECTS_LIMIT, { workspaceId });
    return res.items;
  },

  async recentRuns(): Promise<RunGroup[]> {
    const res = await getRuns();
    return res.runs;
  },

  /**
   * The workspace overview, resolved in one place.
   *
   * This is a four-level walk — groups, then systems, then delivery projects,
   * then repositories — and it used to sit in the page interleaved with
   * setState calls, so the fan-out and the rendering were the same code. The
   * shape it returns is what the view actually needs; assembling it is I/O, so
   * it belongs here.
   */
  async workspaceOverview(
    selectedWorkspaceId: string | null,
  ): Promise<WorkspaceOverview> {
    const [groupsResponse, assignmentsResponse] = await Promise.all([
      getMyGroups(),
      getMyAssignedRepositories(),
    ]);

    const group =
      groupsResponse.items.find((item) => item.id === selectedWorkspaceId) ??
      null;

    // With a group resolved, scope assignments to it. Without one, fall back to
    // the raw selection so a stale id still narrows rather than showing all.
    const assignments = group
      ? assignmentsResponse.items.filter(
          (assignment) => assignment.groupId === group.id,
        )
      : assignmentsResponse.items.filter(
          (assignment) =>
            !selectedWorkspaceId || assignment.groupId === selectedWorkspaceId,
        );

    if (!group) {
      return { group: null, portfolio: [], assignments, activity: [] };
    }

    const systems = await getGroupSystems(group.id);
    const portfolio = await Promise.all(
      systems.map(async (system) => {
        const deliveryProjects = await getSystemDeliveryProjects(system.id);
        const withRepositories = await Promise.all(
          deliveryProjects.map(async (deliveryProject) => ({
            ...deliveryProject,
            repositories: await getDeliveryProjectRepositories(
              deliveryProject.id,
            ),
          })),
        );
        return { system, deliveryProjects: withRepositories };
      }),
    );

    const activity = isGroupManagerRole(group.role)
      ? (await getGroupActivity(group.id, { limit: ACTIVITY_LIMIT })).items
      : [];

    return { group, portfolio, assignments, activity };
  },

  async completeOnboarding(): Promise<void> {
    await completeOnboarding();
  },
};
