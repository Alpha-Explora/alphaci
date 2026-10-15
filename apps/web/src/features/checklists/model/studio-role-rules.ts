/* Who sees what in QA / PO Studio's right column. Pure: no React, no fetch.
 *
 *   Team lead (PO Studio)  The acceptance and the merge to main, nothing else:
 *                          no Checklist | Playwright tabs, no Playwright tab,
 *                          no Run Playwright. One panel under the bar.
 *   QA Team (QA Studio)    Both tabs, but the Playwright tab is Playwright
 *                          browser tests only: no Quality (unit tests) stage,
 *                          no backend repository whose Verify is API tests,
 *                          and the tab's count is browser tests only.
 *   Admin (both studios)   Everything, both stages, every repository: admins
 *                          debug.
 *
 * Any other role (a Developer never opens a studio) keeps the full view, as
 * before these rules. The server still decides every action. */

import type { AppRole } from "@/shared/api/contracts";

import type { QaAutomationStage } from "./qa-automation-types";
import { repoShortName } from "./project-run-rules";
import type { PlaywrightItemRow, PlaywrightRepository, PlaywrightResults } from "./playwright-tab-rules";
import type { RepositoryRole, RepositoryRoles } from "./qa-scope";

export type { RepositoryRole, RepositoryRoles };

/**
 * Product owners and the QA Team judge a Project as one product: they never
 * see its repositories or commits (names, uat heads, merge commits, pull
 * requests), only the Project. Developers and admins, who work in the
 * repositories, keep them; so does a session with no known role, as before.
 */
export function showsRepositories(role: AppRole | null | undefined): boolean {
  return role !== "lead" && role !== "qa";
}

export interface StudioColumnRules {
  /** Checklist | Playwright tabs; false: the Checklist content alone, no tablist. */
  tabs: boolean;
  /** The Playwright tab (and with it Run Playwright and the live progress). */
  playwright: boolean;
  /** Only browser tests in the Playwright tab (and its count). */
  browserOnly: boolean;
}

const FULL: StudioColumnRules = { tabs: true, playwright: true, browserOnly: false };

const RULES: Partial<Record<AppRole, StudioColumnRules>> = {
  lead: { tabs: false, playwright: false, browserOnly: false },
  qa: { tabs: true, playwright: true, browserOnly: true },
  admin: FULL,
};

export function studioColumnRules(role: AppRole | null | undefined): StudioColumnRules {
  return (role ? RULES[role] : undefined) ?? FULL;
}

/** The stages the Playwright tab draws per repository. */
export function visibleStages(rules: StudioColumnRules): ReadonlyArray<QaAutomationStage> {
  return rules.browserOnly ? ["verify"] : ["verify", "quality"];
}

/**
 * Whether a repository runs Playwright browser tests. Only the server's
 * `backend` role (a multi-repo Project's API repository, whose Verify stage is
 * API tests) says no. A frontend says yes; an `app` or `service`, or a role
 * not known (an older backend, a repository outside a Project), cannot be
 * told apart from data the column has, so it stays listed rather than
 * hiding a frontend's results.
 */
export function runsBrowserTests(role: RepositoryRole | null | undefined): boolean {
  return role !== "backend";
}

function browserRepository(repository: PlaywrightRepository, roles: RepositoryRoles): boolean {
  // The server's merge of several repositories names none: keep it.
  if (repository.projectId === null) return true;
  return runsBrowserTests(roles[repository.projectId]);
}

/** Only the verify (browser) stage, and only the repositories it ran browser tests in. */
function browserOnlyRepository(repository: PlaywrightRepository, roles: RepositoryRoles): PlaywrightRepository {
  return {
    ...repository,
    automation: { verify: repository.automation.verify, quality: null },
    checks: repository.checks.filter((ref) => runsBrowserTests(roles[ref.projectId])),
  };
}

/** A unit test or an API (Bruno) test is not a browser test; an unnamed source on verify may be. */
function browserItem(row: PlaywrightItemRow): boolean {
  if (row.source === "unit_test" || row.source === "bruno") return false;
  return row.stage !== "quality";
}

/**
 * What the Playwright tab lists for this viewer: everything, or (QA Team)
 * browser tests only — the frontend repositories' verify stage and the
 * requirements whose automated result is a browser test. The tab label is
 * computed from this, so its count is browser tests only too.
 */
export function scopePlaywrightResults(
  results: PlaywrightResults | null,
  rules: StudioColumnRules,
  roles: RepositoryRoles,
): PlaywrightResults | null {
  if (!results || !rules.browserOnly) return results;
  return {
    ...results,
    repositories: results.repositories
      .filter((repository) => browserRepository(repository, roles))
      .map((repository) => browserOnlyRepository(repository, roles)),
    items: results.items.filter(browserItem),
  };
}

/** The repositories whose Playwright run the live progress follows: browser ones only, every role. */
export function liveRepositories(
  repositories: ReadonlyArray<PlaywrightRepository>,
  roles: RepositoryRoles,
): Array<{ projectId: string; name: string }> {
  const seen = new Set<string>();
  const out: Array<{ projectId: string; name: string }> = [];
  for (const repository of repositories) {
    for (const ref of repository.checks) {
      if (seen.has(ref.projectId) || !runsBrowserTests(roles[ref.projectId])) continue;
      seen.add(ref.projectId);
      out.push({ projectId: ref.projectId, name: repoShortName(ref.repoFullName) });
    }
  }
  return out;
}

export const NO_BROWSER_REPOSITORIES_TITLE = "No browser tests here";

export const NO_BROWSER_REPOSITORIES_TEXT =
  "None of this Project's repositories run Playwright browser tests. API and unit tests are for developers and admins.";
