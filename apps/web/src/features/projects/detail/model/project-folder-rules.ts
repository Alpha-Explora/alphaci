/* Pure rules for the project page's repository switch. No React, no fetch.
 *
 * The page reads GET /projects/:projectId/folder and, when the repository sits
 * in a Project with two or more repositories, titles itself with the Project
 * and offers a switch to the sibling repositories' pages. Everything the view
 * needs — options, links, labels — is derived here so it can be tested
 * without a DOM. */
import type {
  FolderRepoRole,
  ProjectFolderRepository,
  ProjectFolderSummary,
  RepoSwitchOption,
  RepoSwitchPresentation,
} from "./project-folder-types";
import { tabFromHash, type ProjectDetailTab } from "./project-detail-tab-rules";

const ROLE_ORDER: ReadonlyArray<FolderRepoRole> = ["frontend", "backend", "service", "app"];

const ROLE_LABELS: Record<FolderRepoRole, string> = {
  frontend: "FRONTEND",
  backend: "BACKEND",
  service: "SERVICE",
  app: "APP",
};

/** Shown for a repository whose role the server did not report. */
const UNKNOWN_ROLE_LABEL = "REPO";

/** The tooltip on a switch option with no AlphaCI project behind it. */
export const UNLINKED_REPO_HINT = "Not linked to an AlphaCI project yet";

/* ── Normalising ────────────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRole(value: unknown): FolderRepoRole | null {
  return ROLE_ORDER.includes(value as FolderRepoRole) ? (value as FolderRepoRole) : null;
}

function readRepository(value: unknown): ProjectFolderRepository | null {
  if (!isRecord(value)) return null;
  const repoFullName = stringOrNull(value.repoFullName);
  const name = stringOrNull(value.name) ?? repoFullName;
  if (!name) return null;
  return {
    projectId: stringOrNull(value.projectId),
    name,
    repoFullName,
    role: readRole(value.role),
    status: stringOrNull(value.status),
  };
}

function roleRank(role: FolderRepoRole | null): number {
  return role ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length;
}

/**
 * The folder, or null when the body is not one. A malformed repository row is
 * dropped rather than failing the page; the rows are kept in role order
 * (frontend, backend, service, app, then unknown), stable within a role.
 */
export function normaliseProjectFolder(raw: unknown): ProjectFolderSummary | null {
  if (!isRecord(raw) || !Array.isArray(raw.repositories)) return null;
  const repositories = raw.repositories
    .map(readRepository)
    .filter((repo): repo is ProjectFolderRepository => repo !== null)
    .map((repo, index) => ({ repo, index }))
    .sort((a, b) => roleRank(a.repo.role) - roleRank(b.repo.role) || a.index - b.index)
    .map(({ repo }) => repo);
  return {
    deliveryProjectId: stringOrNull(raw.deliveryProjectId),
    groupId: stringOrNull(raw.groupId),
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    repositories,
  };
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

/** "FRONTEND", "BACKEND", "SERVICE", "APP" — or "REPO" when unknown. */
export function roleLabel(role: FolderRepoRole | null | undefined): string {
  return role ? ROLE_LABELS[role] : UNKNOWN_ROLE_LABEL;
}

/** The short repository name: "Org/shop-fe" -> "shop-fe". */
export function repoShortName(repo: Pick<ProjectFolderRepository, "name" | "repoFullName">): string {
  if (!repo.repoFullName) return repo.name;
  return repo.repoFullName.split("/").at(-1) || repo.repoFullName;
}

/**
 * The repository a Project opens on: its linked frontend, else the first
 * linked repository, else null (nothing in the Project has a page yet).
 */
export function defaultRepoForFolder(
  folder: Pick<ProjectFolderSummary, "repositories"> | null | undefined,
): ProjectFolderRepository | null {
  const linked = (folder?.repositories ?? []).filter((repo) => repo.projectId !== null);
  return linked.find((repo) => repo.role === "frontend") ?? linked[0] ?? null;
}

/** A switch is worth drawing only when the Project has two or more repositories. */
export function hasRepoSwitch(folder: ProjectFolderSummary | null | undefined): folder is ProjectFolderSummary {
  return (folder?.repositories.length ?? 0) >= 2;
}

/** One option per repository, the page on screen marked current. */
export function repoSwitchOptions(
  folder: ProjectFolderSummary,
  currentProjectId: string,
): RepoSwitchOption[] {
  return folder.repositories.map((repo, index, all) => {
    const pair = repoPairName(repo, all);
    const previous = index > 0 ? all[index - 1] : undefined;
    return {
      key: repo.projectId ?? `repo:${repo.repoFullName ?? repo.name}`,
      projectId: repo.projectId,
      role: repo.role,
      roleLabel: roleLabel(repo.role),
      label: repoShortName(repo),
      pairName: pair,
      // The pair's name heads its first half; the halves then show only
      // their role, since the name is the same for both.
      startsPair:
        pair !== null && (!previous || repoPairName(previous, all) !== pair),
      repoFullName: repo.repoFullName,
      current: repo.projectId !== null && repo.projectId === currentProjectId,
      disabled: repo.projectId === null,
    };
  });
}

/**
 * Where a switch option goes: the sibling's page, on the tab the viewer is on.
 * A tab the target does not show (or an unknown hash) falls back to Overview,
 * so a switch never lands on a hidden panel.
 */
export function switchHref(
  targetProjectId: string,
  currentHash: string | null | undefined,
  visibleTabs: ReadonlyArray<ProjectDetailTab>,
): string {
  const asked = tabFromHash(currentHash);
  const tab: ProjectDetailTab = asked && visibleTabs.includes(asked) ? asked : "overview";
  return `/projects/${encodeURIComponent(targetProjectId)}#${tab}`;
}

/**
 * The Projects page opened on this Project's detail (repositories, Move,
 * checklists, Delete), with its team selected in the header. Null when the
 * folder does not say which team and Project it is — there is then nowhere
 * precise to send the viewer. (It was `/teams?section=projects&project=…`;
 * /teams still forwards such links here.)
 */
export function manageProjectHref(
  folder: Pick<ProjectFolderSummary, "groupId" | "deliveryProjectId"> | null | undefined,
): string | null {
  if (!folder?.groupId || !folder.deliveryProjectId) return null;
  const params = new URLSearchParams({
    group: folder.groupId,
    project: folder.deliveryProjectId,
  });
  return `/workflows?${params.toString()}`;
}

/** The page as it was before Projects: no Project title, no switch. */
export const SINGLE_REPO_PRESENTATION: RepoSwitchPresentation = {
  projectName: null,
  options: [],
};

/** A two-repository project's halves are named `<name>-fe` and `<name>-be`. */
const PAIR_SUFFIX = /-(fe|be)$/i;

/** `shop-fe` -> `shop`; null for a name that is not one half of a pair. */
function pairStem(repo: ProjectFolderRepository): string | null {
  const name = repoShortName(repo);
  return PAIR_SUFFIX.test(name) ? name.replace(PAIR_SUFFIX, "").toLowerCase() : null;
}

/**
 * Every repository linked to the Project, repeated roles included
 * (`store-web`, `admin-web`, `store-api`). The halves of a two-repository
 * pair (`shop-fe`, `shop-be`) are moved next to each other, frontend first,
 * where the pair's first half stood, so a Project holding several pairs reads
 * pair by pair instead of FRONTEND FRONTEND BACKEND BACKEND.
 */
export function switchRepositories(
  folder: ProjectFolderSummary,
): ProjectFolderRepository[] {
  const pairs = completePairs(folder.repositories);
  const placed = new Set<ProjectFolderRepository>();
  const ordered: ProjectFolderRepository[] = [];
  for (const repo of folder.repositories) {
    if (placed.has(repo)) continue;
    const stem = pairStem(repo);
    const pair = stem ? pairs.get(stem) : undefined;
    for (const member of pair ?? [repo]) {
      placed.add(member);
      ordered.push(member);
    }
  }
  return ordered;
}

/** Stems with exactly one frontend and one backend half, frontend first. */
function completePairs(
  repositories: ReadonlyArray<ProjectFolderRepository>,
): Map<string, [ProjectFolderRepository, ProjectFolderRepository]> {
  const byStem = new Map<string, ProjectFolderRepository[]>();
  for (const repo of repositories) {
    const stem = pairStem(repo);
    if (stem) byStem.set(stem, [...(byStem.get(stem) ?? []), repo]);
  }
  const pairs = new Map<string, [ProjectFolderRepository, ProjectFolderRepository]>();
  for (const [stem, members] of byStem) {
    const frontend = members.find((repo) => repo.role === "frontend");
    const backend = members.find((repo) => repo.role === "backend");
    if (members.length === 2 && frontend && backend) pairs.set(stem, [frontend, backend]);
  }
  return pairs;
}

/**
 * The pair a repository belongs to, by the name both halves share
 * (`shop-fe` -> `shop`), or null for a repository outside a complete pair.
 */
export function repoPairName(
  repo: ProjectFolderRepository,
  repositories: ReadonlyArray<ProjectFolderRepository>,
): string | null {
  const stem = pairStem(repo);
  if (!stem || !completePairs(repositories).has(stem)) return null;
  return repoShortName(repo).replace(PAIR_SUFFIX, "");
}

/**
 * What the header draws for this folder. A named Project with two or more
 * repositories titles the page; the switch offers `switchRepositories`, and is
 * left out when that is fewer than two. No folder, one repository or a
 * nameless Project leaves the page as it was.
 */
export function repoSwitchPresentation(
  folder: ProjectFolderSummary | null | undefined,
  currentProjectId: string,
): RepoSwitchPresentation {
  if (!hasRepoSwitch(folder) || !folder.name) return SINGLE_REPO_PRESENTATION;
  const repositories = switchRepositories(folder);
  return {
    projectName: folder.name,
    options:
      repositories.length >= 2
        ? repoSwitchOptions({ ...folder, repositories }, currentProjectId)
        : [],
  };
}

/** The next enabled option index from `from`, moving by `step`, wrapping. */
export function nextEnabledIndex(
  options: ReadonlyArray<Pick<RepoSwitchOption, "disabled">>,
  from: number,
  step: 1 | -1,
): number {
  const count = options.length;
  for (let offset = 1; offset <= count; offset += 1) {
    const index = (((from + step * offset) % count) + count) % count;
    if (!options[index].disabled) return index;
  }
  return from;
}
