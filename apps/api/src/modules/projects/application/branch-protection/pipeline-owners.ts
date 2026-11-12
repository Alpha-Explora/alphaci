import {
  PIPELINE_OWNERS_TEAM_SLUG,
  type GithubPipelineOwnersTeamOutcome,
  type GithubProjectPort,
  type GithubRulesetOutcome,
} from '#kernel/ports/github.port';

/**
 * Pipeline owners for one repository: who must review a change to its
 * workflows, the CODEOWNERS file that names them, and the ruleset that makes
 * GitHub wait for them. Used by provisioning (everything, before and after
 * branch protection) and by the admin retrofit (team and ruleset; existing
 * repositories get the CODEOWNERS file through the workflow update pull
 * request, because their branches already refuse direct pushes).
 *
 * Every step is best effort. A repository that provisioned fine is never
 * failed by this, and the result says what happened for the audit trail.
 */

export const CODEOWNERS_PATH = '.github/CODEOWNERS';
const CODEOWNERS_COMMIT_MESSAGE = 'ci: add ALPHACI CODEOWNERS';

/** The CODEOWNERS file ALPHACI writes, owning the workflows and itself. */
export function buildPipelineCodeowners(org: string): string {
  const owner = `@${org}/${PIPELINE_OWNERS_TEAM_SLUG}`;
  return [
    '# Managed by ALPHACI. A change to the pipeline needs a review from a',
    '# pipeline owner (the ALPHACI admins). Change workflows through ALPHACI.',
    `/.github/workflows/ ${owner}`,
    `/.github/CODEOWNERS ${owner}`,
    '',
  ].join('\n');
}

export interface CodeownersBranchResult {
  branch: string;
  /** committed: a commit on this branch; fast-forwarded: moved to main's. */
  status: 'committed' | 'fast-forwarded' | 'failed';
  error?: string;
}

export interface PipelineOwnersPreparation {
  team: GithubPipelineOwnersTeamOutcome;
  codeowners: CodeownersBranchResult[];
}

export interface PipelineOwnersResult extends PipelineOwnersPreparation {
  ruleset: GithubRulesetOutcome;
}

export class PipelineOwners {
  constructor(
    private readonly github: GithubProjectPort,
    private readonly adminLogins: () => Promise<string[]>,
    private readonly bypassAppId: number | null,
  ) {}

  /**
   * Before branch protection: the team, then (when asked) the CODEOWNERS
   * file on every branch. It is committed once, on main when main is one of
   * them, and the other branches are fast-forwarded to that commit so they
   * keep one history; a branch that has moved on gets its own commit.
   */
  async prepare(input: {
    token: string;
    owner: string;
    repo: string;
    branches: readonly string[];
    writeCodeowners: boolean;
  }): Promise<PipelineOwnersPreparation> {
    let logins: string[] = [];
    try {
      logins = await this.adminLogins();
    } catch {
      // An empty team still lets CODEOWNERS and the ruleset be written.
    }
    const team = await this.github.ensurePipelineOwnersTeam(
      input.token,
      input.owner,
      input.repo,
      logins,
    );
    if (!input.writeCodeowners || team.status === 'unavailable') {
      return { team, codeowners: [] };
    }
    return {
      team,
      codeowners: await this.writeCodeowners(input),
    };
  }

  /** After branch protection: the ruleset. Skipped for a personal account. */
  async ruleset(input: {
    token: string;
    owner: string;
    repo: string;
    branches: readonly string[];
    team: GithubPipelineOwnersTeamOutcome;
  }): Promise<GithubRulesetOutcome> {
    if (input.team.status === 'unavailable') {
      return { status: 'unavailable', error: input.team.error };
    }
    return this.github.ensurePipelineOwnersRuleset(
      input.token,
      input.owner,
      input.repo,
      { branches: input.branches, bypassAppId: this.bypassAppId },
    );
  }

  private async writeCodeowners(input: {
    token: string;
    owner: string;
    repo: string;
    branches: readonly string[];
  }): Promise<CodeownersBranchResult[]> {
    const content = buildPipelineCodeowners(input.owner);
    const ordered = input.branches.includes('main')
      ? ['main', ...input.branches.filter((branch) => branch !== 'main')]
      : [...input.branches];
    const results: CodeownersBranchResult[] = [];
    let firstSha: string | null = null;

    for (const branch of ordered) {
      try {
        if (
          firstSha &&
          (await this.github.fastForwardBranch(
            input.token,
            input.owner,
            input.repo,
            branch,
            firstSha,
          ))
        ) {
          results.push({ branch, status: 'fast-forwarded' });
          continue;
        }
        const commit = await this.github.putFileContent(
          input.token,
          input.owner,
          input.repo,
          CODEOWNERS_PATH,
          content,
          branch,
          CODEOWNERS_COMMIT_MESSAGE,
        );
        firstSha ??= commit.commitSha;
        results.push({ branch, status: 'committed' });
      } catch (error) {
        results.push({
          branch,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}

/** The App id bypassing the ruleset, from the configured GitHub App. */
export function pipelineOwnersBypassAppId(
  appId: string | undefined,
): number | null {
  const parsed = Number(appId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** One line for the audit trail: what the pipeline-owners step did. */
export function describePipelineOwners(result: PipelineOwnersResult): {
  failed: boolean;
  message: string;
} {
  const problems: string[] = [];
  if (result.team.status === 'failed')
    problems.push(`team: ${result.team.error}`);
  for (const branch of result.codeowners) {
    if (branch.status === 'failed') {
      problems.push(
        `CODEOWNERS on ${branch.branch}: ${branch.error ?? 'failed'}`,
      );
    }
  }
  if (result.ruleset.status === 'failed') {
    problems.push(`ruleset: ${result.ruleset.error ?? 'failed'}`);
  }
  if (problems.length > 0) {
    return {
      failed: true,
      message: `Pipeline owners could not be fully applied (${problems.join('; ')})`,
    };
  }
  if (result.ruleset.status === 'unavailable') {
    return {
      failed: false,
      message: `Workflow changes are not review-gated: ${result.ruleset.error ?? 'rulesets are unavailable for this repository'}`,
    };
  }
  return {
    failed: false,
    message: 'Workflow changes now need a pipeline owner review',
  };
}
