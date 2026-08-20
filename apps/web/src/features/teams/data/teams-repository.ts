import { getGroups } from "@/lib/api/hierarchy";
import { getProjects } from "@/lib/api/projects";

import type { ProvisionedProject, Team } from "../model/teams-types";

/* The only place in this domain that performs I/O. View-models call this;
 * views never do. */

/** Server-side cap on getProjects; asking for more is silently clamped. */
const PROJECT_PAGE_LIMIT = 100;

export const teamsRepository = {
  async list(): Promise<Team[]> {
    return getGroups();
  },

  /**
   * Projects for one team, scoped server-side.
   *
   * Deliberately scoped rather than filtered in the browser: the unscoped list
   * returns the caller's newest 100 across all teams, so someone in several
   * teams could have a team's repositories fall outside that window and see an
   * empty section with no explanation.
   */
  async listProjects(teamId: string): Promise<ProvisionedProject[]> {
    const res = await getProjects(PROJECT_PAGE_LIMIT, { workspaceId: teamId });
    return res.items;
  },
};
