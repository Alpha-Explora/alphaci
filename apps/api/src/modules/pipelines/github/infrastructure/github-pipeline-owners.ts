import type {
  GithubPipelineOwnersTeamOutcome,
  GithubRulesetOutcome,
} from '#kernel/ports/github.port';
import {
  PIPELINE_OWNERS_RULESET_NAME,
  PIPELINE_OWNERS_TEAM_SLUG,
} from '#kernel/ports/github.port';
import type { GithubHttp } from './github-http';

/**
 * Pipeline owners: the people who must approve a change to a repository's
 * workflows, and the rule that makes GitHub ask them.
 *
 * - A per-organization team, `alphaci-pipeline-owners`, holds the ALPHACI
 *   admins who belong to that organization and has Write on the repository.
 *   CODEOWNERS can only name a team that has explicit Write, so the grant is
 *   part of ensuring the team.
 * - A repository ruleset on dev, uat and main requires a pull request with
 *   zero approvals and a code owner's review. A pull request that does not
 *   touch an owned path merges as before; one that touches the workflows
 *   waits for a pipeline owner. Only the ALPHACI GitHub App may bypass it,
 *   so organization owners are held to it too.
 *
 * Both are best effort and never throw: the outcome says what happened.
 */

const GITHUB_API = 'https://api.github.com';

interface RulesetSummary {
  id: number;
  name: string;
}

interface RulesetDetail {
  id: number;
  name: string;
  target?: string;
  enforcement?: string;
  conditions?: { ref_name?: { include?: string[]; exclude?: string[] } };
  rules?: Array<{ type: string; parameters?: Record<string, unknown> }>;
  bypass_actors?: Array<{
    actor_id?: number | null;
    actor_type?: string;
    bypass_mode?: string;
  }>;
}

const PULL_REQUEST_PARAMETERS = {
  required_approving_review_count: 0,
  dismiss_stale_reviews_on_push: true,
  require_code_owner_review: true,
  require_last_push_approval: false,
  required_review_thread_resolution: false,
} as const;

export function buildPipelineOwnersRuleset(
  branches: readonly string[],
  bypassAppId: number | null,
): Record<string, unknown> {
  return {
    name: PIPELINE_OWNERS_RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: branches.map((branch) => `refs/heads/${branch}`),
        exclude: [],
      },
    },
    rules: [
      { type: 'pull_request', parameters: { ...PULL_REQUEST_PARAMETERS } },
    ],
    bypass_actors:
      bypassAppId === null
        ? []
        : [
            {
              actor_id: bypassAppId,
              actor_type: 'Integration',
              bypass_mode: 'always',
            },
          ],
  };
}

/** Whether the ruleset GitHub holds already says what we would write. */
export function rulesetMatches(
  existing: RulesetDetail,
  branches: readonly string[],
  bypassAppId: number | null,
): boolean {
  if (existing.enforcement !== 'active' || existing.target !== 'branch') {
    return false;
  }
  const include = [...(existing.conditions?.ref_name?.include ?? [])].sort();
  const wanted = branches.map((branch) => `refs/heads/${branch}`).sort();
  if (JSON.stringify(include) !== JSON.stringify(wanted)) return false;

  const pullRequest = existing.rules?.find(
    (rule) => rule.type === 'pull_request',
  );
  if (!pullRequest || existing.rules?.length !== 1) return false;
  for (const [key, value] of Object.entries(PULL_REQUEST_PARAMETERS)) {
    if (pullRequest.parameters?.[key] !== value) return false;
  }

  const actors = existing.bypass_actors ?? [];
  if (bypassAppId === null) return actors.length === 0;
  return (
    actors.length === 1 &&
    actors[0]?.actor_type === 'Integration' &&
    actors[0]?.actor_id === bypassAppId &&
    actors[0]?.bypass_mode === 'always'
  );
}

async function errorDetail(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message.slice(0, 200);
  } catch {
    // Not JSON: keep the raw excerpt.
  }
  return body.slice(0, 200);
}

/**
 * GitHub's answer when the plan has no rulesets for this repository: a
 * private repository on GitHub Free. It is a plan limit, not a fault.
 */
function isPlanLimit(status: number, detail: string): boolean {
  return (
    (status === 403 || status === 404) &&
    /upgrade to github|make this repository public/i.test(detail)
  );
}

export async function ensurePipelineOwnersRuleset(
  http: GithubHttp,
  accessToken: string,
  owner: string,
  repo: string,
  options: { branches: readonly string[]; bypassAppId: number | null },
): Promise<GithubRulesetOutcome> {
  const base = `${GITHUB_API}/repos/${owner}/${repo}/rulesets`;
  const headers = http.workspaceHeaders(accessToken);
  const desired = buildPipelineOwnersRuleset(
    options.branches,
    options.bypassAppId,
  );

  try {
    const list = await http.fetchWithRetry(`${base}?per_page=100`, {
      headers,
    });
    if (!list.ok) {
      const detail = await errorDetail(list);
      if (isPlanLimit(list.status, detail)) {
        return { status: 'unavailable', error: detail };
      }
      return {
        status: 'failed',
        error: `HTTP ${String(list.status)} reading rulesets: ${detail}`,
      };
    }
    const existing = ((await list.json()) as RulesetSummary[]).find(
      (ruleset) => ruleset.name === PIPELINE_OWNERS_RULESET_NAME,
    );

    if (existing) {
      const current = await http.fetchWithRetry(`${base}/${existing.id}`, {
        headers,
      });
      if (current.ok) {
        const detail = (await current.json()) as RulesetDetail;
        if (rulesetMatches(detail, options.branches, options.bypassAppId)) {
          return { status: 'unchanged' };
        }
      }
    }

    const write = await http.fetchWithRetry(
      existing ? `${base}/${existing.id}` : base,
      {
        method: existing ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(desired),
      },
    );
    if (!write.ok) {
      const detail = await errorDetail(write);
      if (isPlanLimit(write.status, detail)) {
        return { status: 'unavailable', error: detail };
      }
      const hint =
        write.status === 403 || write.status === 404
          ? ' (the GitHub App needs Administration: write)'
          : '';
      return {
        status: 'failed',
        error: `HTTP ${String(write.status)} writing the ruleset${hint}: ${detail}`,
      };
    }
    return { status: 'applied' };
  } catch (error) {
    return {
      status: 'failed',
      error: `GitHub could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function accountType(
  http: GithubHttp,
  accessToken: string,
  login: string,
): Promise<{ type: string | null; error?: string }> {
  const response = await http.fetchWithRetry(`${GITHUB_API}/users/${login}`, {
    headers: http.workspaceHeaders(accessToken),
  });
  if (!response.ok) {
    return {
      type: null,
      error: `HTTP ${String(response.status)} reading ${login}: ${await errorDetail(response)}`,
    };
  }
  const { type } = (await response.json()) as { type?: string };
  return { type: type ?? null };
}

/** Whether `login` is a GitHub organization; false when GitHub cannot say. */
export async function isOrganizationAccount(
  http: GithubHttp,
  accessToken: string,
  login: string,
): Promise<boolean> {
  try {
    return (
      (await accountType(http, accessToken, login)).type === 'Organization'
    );
  } catch {
    return false;
  }
}

/**
 * Moves `branch` to `sha` only when that is a fast-forward (`force: false`).
 * Provisioning commits the CODEOWNERS file once on main and moves dev and uat
 * with it, so the three branches keep one history. False when GitHub refuses,
 * which is what a branch that has moved on gets.
 */
export async function fastForwardBranch(
  http: GithubHttp,
  accessToken: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
): Promise<boolean> {
  try {
    const response = await http.fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
      {
        method: 'PATCH',
        headers: {
          ...http.workspaceHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sha, force: false }),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensurePipelineOwnersTeam(
  http: GithubHttp,
  accessToken: string,
  org: string,
  repo: string,
  memberLogins: readonly string[],
): Promise<GithubPipelineOwnersTeamOutcome> {
  const headers = http.workspaceHeaders(accessToken);
  const json = { ...headers, 'Content-Type': 'application/json' };

  try {
    const account = await accountType(http, accessToken, org);
    if (account.error !== undefined) {
      return { status: 'failed', error: account.error };
    }
    if (account.type !== 'Organization') {
      return {
        status: 'unavailable',
        error: `${org} is a personal account, which has no teams`,
      };
    }

    const created = await http.fetchWithRetry(
      `${GITHUB_API}/orgs/${org}/teams`,
      {
        method: 'POST',
        headers: json,
        body: JSON.stringify({
          name: PIPELINE_OWNERS_TEAM_SLUG,
          description:
            'ALPHACI admins. Review every change to a repository workflow (CODEOWNERS).',
          privacy: 'closed',
        }),
      },
    );
    // 422: the team already exists.
    if (!created.ok && created.status !== 422) {
      return {
        status: 'failed',
        error: `HTTP ${String(created.status)} creating the team (the GitHub App needs Members: write): ${await errorDetail(created)}`,
      };
    }

    const members: string[] = [];
    const notOrgMembers: string[] = [];
    for (const login of memberLogins) {
      const membership = await http.fetchWithRetry(
        `${GITHUB_API}/orgs/${org}/members/${login}`,
        { headers },
      );
      // 204 is a member. Anyone else would be invited into the organization,
      // which is a decision for a person, so they are reported instead.
      if (membership.status !== 204) {
        notOrgMembers.push(login);
        continue;
      }
      const add = await http.fetchWithRetry(
        `${GITHUB_API}/orgs/${org}/teams/${PIPELINE_OWNERS_TEAM_SLUG}/memberships/${login}`,
        {
          method: 'PUT',
          headers: json,
          body: JSON.stringify({ role: 'member' }),
        },
      );
      if (!add.ok) {
        return {
          status: 'failed',
          error: `HTTP ${String(add.status)} adding ${login} to the team: ${await errorDetail(add)}`,
        };
      }
      members.push(login);
    }

    const grant = await http.fetchWithRetry(
      `${GITHUB_API}/orgs/${org}/teams/${PIPELINE_OWNERS_TEAM_SLUG}/repos/${org}/${repo}`,
      {
        method: 'PUT',
        headers: json,
        body: JSON.stringify({ permission: 'push' }),
      },
    );
    if (!grant.ok) {
      return {
        status: 'failed',
        error: `HTTP ${String(grant.status)} granting the team Write on ${org}/${repo}: ${await errorDetail(grant)}`,
      };
    }

    return {
      status: 'applied',
      teamSlug: PIPELINE_OWNERS_TEAM_SLUG,
      members,
      notOrgMembers,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: `GitHub could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
