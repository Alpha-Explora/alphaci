import { getProjectOptions } from "@/lib/api/catalog";
import {
  disconnectProject,
  getProjectOverview,
  getProjectPreviews,
} from "@/lib/api/projects";

import type {
  ProjectOverviewResponse,
  ProjectPreviewsResponse,
} from "../model/projects-types";

/* The only place in this domain that performs I/O. View-models call these;
 * views never do. */
export const projectsRepository = {
  overview(projectId: string): Promise<ProjectOverviewResponse> {
    return getProjectOverview(projectId);
  },

  /** One entry per branch, newest deployment each. */
  previews(projectId: string): Promise<ProjectPreviewsResponse> {
    return getProjectPreviews(projectId);
  },

  /** The org every new repository is provisioned into, for the External badge. */
  async enforcedOrg(): Promise<string | undefined> {
    return (await getProjectOptions()).enforcedOrg;
  },

  /**
   * Disconnects the project, optionally deleting the GitHub repository too.
   *
   * The repo name is echoed back as confirmation, which is what makes the
   * destructive branch deliberate rather than a checkbox away.
   */
  disconnect(
    projectId: string,
    deleteGithubRepo: boolean,
    repoFullName: string,
  ): Promise<unknown> {
    return disconnectProject(
      projectId,
      deleteGithubRepo
        ? { deleteGithubRepo: true, confirmRepoName: repoFullName }
        : undefined,
    );
  },
};
