/* A role's Projects as lists: a Developer's "My work" and the Product owner's
 * "Projects needing attention". Pure: no React, no fetch. */

import { waitingForNextIterationText } from "@/features/checklists";

import {
  deliveryProjectHref,
  projectPageHref,
  type HomeLinkContext,
} from "./home-persona-rules";
import type {
  AttentionRow,
  MyWorkProject,
  MyWorkRepository,
} from "./home-persona-types";
import { latestRunFor, runTone } from "./home-run-rules";
import type {
  FolderRepository,
  ProjectFolder,
  RunGroup,
  TeamQaOverview,
} from "./home-types";

function myWorkRepository(
  repository: FolderRepository,
  latest: ReadonlyMap<string, RunGroup>,
): MyWorkRepository {
  const run = latestRunFor(latest, repository.repoFullName);
  return {
    repositoryId: repository.repositoryId,
    name: repository.name,
    href: repository.project ? projectPageHref(repository.project.id) : null,
    tone: runTone(run),
    branch: run ? run.branch : null,
  };
}

function failingFirst(repositories: MyWorkRepository[]): MyWorkRepository[] {
  return [
    ...repositories.filter((repository) => repository.tone === "failure"),
    ...repositories.filter((repository) => repository.tone !== "failure"),
  ];
}

function hasFailure(project: MyWorkProject): boolean {
  return project.repositories.some((repository) => repository.tone === "failure");
}

/**
 * Each Project's waiting sentence, from the team overview's iteration: only a
 * delivered one (none active) waits for the Product owner (Iterations phase
 * 3, P15). A Project the overview does not report, or reports without an
 * iteration (an older backend), has none.
 */
function waitingByProject(overview: TeamQaOverview | null): Map<string, string> {
  const waiting = new Map<string, string>();
  for (const project of overview?.projects ?? []) {
    const iteration = project.iteration;
    if (iteration?.status !== "delivered") continue;
    waiting.set(project.deliveryProject.id, waitingForNextIterationText(iteration));
  }
  return waiting;
}

/**
 * The Projects in scope, each with its repositories and their newest run, and
 * — between a delivered iteration and the next — who the team is waiting for.
 * Projects and repositories with a failing run come first.
 */
export function myWorkProjects(
  folders: ReadonlyArray<ProjectFolder>,
  latest: ReadonlyMap<string, RunGroup>,
  links: HomeLinkContext,
  overview: TeamQaOverview | null = null,
): MyWorkProject[] {
  const waiting = waitingByProject(overview);
  const projects = folders.map((folder) => ({
    deliveryProjectId: folder.deliveryProjectId,
    name: folder.name,
    href: deliveryProjectHref(links.groupId, folder.deliveryProjectId),
    repositories: failingFirst(folder.repositories.map((repository) => myWorkRepository(repository, latest))),
    waiting: waiting.get(folder.deliveryProjectId) ?? null,
  }));
  return [...projects.filter(hasFailure), ...projects.filter((project) => !hasFailure(project))];
}

export const NO_FEATURES_REASON = "No Features yet, so Developers cannot add repositories";
export const NO_DEVELOPERS_REASON = "No Developers yet";

function developerCounts(overview: TeamQaOverview | null): Map<string, number | null> {
  const counts = new Map<string, number | null>();
  for (const project of overview?.projects ?? []) {
    counts.set(project.deliveryProject.id, project.counts.members?.developer ?? null);
  }
  return counts;
}

function attentionReasons(folder: ProjectFolder, developers: number | null | undefined, qa: boolean): string[] {
  const reasons: string[] = [];
  // Feature counts are always 0 with the QA capability off; only count them when it is on.
  if (qa && folder.featureCount === 0) reasons.push(NO_FEATURES_REASON);
  if (developers === 0) reasons.push(NO_DEVELOPERS_REASON);
  return reasons;
}

/**
 * Projects only a Product owner can unblock: no Features (Developers cannot
 * add a repository) or no Developer members (nobody can work on them).
 * Unknown counts never flag a Project.
 */
export function needsAttentionRows(
  folders: ReadonlyArray<ProjectFolder>,
  overview: TeamQaOverview | null,
  qa: boolean,
  links: HomeLinkContext,
): AttentionRow[] {
  const developers = developerCounts(overview);
  return folders
    .map((folder) => ({
      deliveryProjectId: folder.deliveryProjectId,
      name: folder.name,
      reasons: attentionReasons(folder, developers.get(folder.deliveryProjectId), qa),
      href: deliveryProjectHref(links.groupId, folder.deliveryProjectId),
    }))
    .filter((row) => row.reasons.length > 0);
}
