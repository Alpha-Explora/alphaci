import { Logger } from '@nestjs/common';

import { GithubHttp } from './github-http';
import {
  buildPipelineOwnersRuleset,
  ensurePipelineOwnersRuleset,
  ensurePipelineOwnersTeam,
  fastForwardBranch,
  isOrganizationAccount,
} from './github-pipeline-owners';

const json = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const BRANCHES = ['dev', 'uat', 'main'];

describe('pipeline owners on GitHub', () => {
  let fetchMock: jest.Mock;
  let http: GithubHttp;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    http = new GithubHttp(new Logger('test'));
  });

  const call = (index: number) =>
    fetchMock.mock.calls[index] as [string, { method?: string; body?: string }];

  describe('the ruleset', () => {
    const run = (bypassAppId: number | null = 42) =>
      ensurePipelineOwnersRuleset(http, 'tok', 'org', 'repo', {
        branches: BRANCHES,
        bypassAppId,
      });

    it('requires a code owner review and no other approval on dev, uat and main, bypassable only by the App', () => {
      expect(buildPipelineOwnersRuleset(BRANCHES, 42)).toEqual({
        name: 'ALPHACI pipeline owners',
        target: 'branch',
        enforcement: 'active',
        conditions: {
          ref_name: {
            include: ['refs/heads/dev', 'refs/heads/uat', 'refs/heads/main'],
            exclude: [],
          },
        },
        rules: [
          {
            type: 'pull_request',
            parameters: {
              required_approving_review_count: 0,
              dismiss_stale_reviews_on_push: true,
              require_code_owner_review: true,
              require_last_push_approval: false,
              required_review_thread_resolution: false,
            },
          },
        ],
        // No organization-admin or repository-admin bypass: owners are held
        // to the rule like everyone else.
        bypass_actors: [
          { actor_id: 42, actor_type: 'Integration', bypass_mode: 'always' },
        ],
      });
    });

    it('creates the ruleset when the repository has none', async () => {
      fetchMock
        .mockResolvedValueOnce(json(200, [{ id: 7, name: 'something else' }]))
        .mockResolvedValueOnce(json(201));

      await expect(run()).resolves.toEqual({ status: 'applied' });
      expect(call(1)[0]).toBe('https://api.github.com/repos/org/repo/rulesets');
      expect(call(1)[1].method).toBe('POST');
      expect(JSON.parse(call(1)[1].body ?? '{}')).toEqual(
        buildPipelineOwnersRuleset(BRANCHES, 42),
      );
    });

    it('leaves a matching ruleset alone', async () => {
      fetchMock
        .mockResolvedValueOnce(
          json(200, [{ id: 9, name: 'ALPHACI pipeline owners' }]),
        )
        .mockResolvedValueOnce(
          json(200, { id: 9, ...buildPipelineOwnersRuleset(BRANCHES, 42) }),
        );

      await expect(run()).resolves.toEqual({ status: 'unchanged' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('restores a ruleset someone loosened, with a PUT', async () => {
      const loosened = buildPipelineOwnersRuleset(BRANCHES, 42);
      loosened['bypass_actors'] = [
        { actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' },
      ];
      fetchMock
        .mockResolvedValueOnce(
          json(200, [{ id: 9, name: 'ALPHACI pipeline owners' }]),
        )
        .mockResolvedValueOnce(json(200, { id: 9, ...loosened }))
        .mockResolvedValueOnce(json(200));

      await expect(run()).resolves.toEqual({ status: 'applied' });
      expect(call(2)[0]).toBe(
        'https://api.github.com/repos/org/repo/rulesets/9',
      );
      expect(call(2)[1].method).toBe('PUT');
    });

    it('reports a private repository on GitHub Free as unavailable, not failed', async () => {
      fetchMock.mockResolvedValueOnce(
        json(403, {
          message:
            'Upgrade to GitHub Pro or make this repository public to enable this feature.',
        }),
      );

      await expect(run()).resolves.toEqual({
        status: 'unavailable',
        error:
          'Upgrade to GitHub Pro or make this repository public to enable this feature.',
      });
    });

    it('names the missing App permission when GitHub refuses the write', async () => {
      fetchMock
        .mockResolvedValueOnce(json(200, []))
        .mockResolvedValueOnce(
          json(403, { message: 'Resource not accessible by integration' }),
        );

      const outcome = await run();
      expect(outcome.status).toBe('failed');
      expect(outcome.error).toContain('Administration: write');
    });
  });

  describe('the team', () => {
    const run = (logins: string[]) =>
      ensurePipelineOwnersTeam(http, 'tok', 'org', 'repo', logins);

    it('adds the admins who are organization members, reports the others, and grants the team Write', async () => {
      fetchMock
        .mockResolvedValueOnce(json(200, { type: 'Organization' }))
        .mockResolvedValueOnce(json(422, { message: 'Name must be unique' }))
        .mockResolvedValueOnce(json(204)) // lloydlim1 is a member
        .mockResolvedValueOnce(json(200)) // added to the team
        .mockResolvedValueOnce(json(404)) // outsider is not
        .mockResolvedValueOnce(json(204)); // Write on the repository

      await expect(run(['lloydlim1', 'outsider'])).resolves.toEqual({
        status: 'applied',
        teamSlug: 'alphaci-pipeline-owners',
        members: ['lloydlim1'],
        notOrgMembers: ['outsider'],
      });
      expect(call(3)[0]).toBe(
        'https://api.github.com/orgs/org/teams/alphaci-pipeline-owners/memberships/lloydlim1',
      );
      expect(call(5)[0]).toBe(
        'https://api.github.com/orgs/org/teams/alphaci-pipeline-owners/repos/org/repo',
      );
      expect(JSON.parse(call(5)[1].body ?? '{}')).toEqual({
        permission: 'push',
      });
    });

    it('does nothing for a personal account, which has no teams', async () => {
      fetchMock.mockResolvedValueOnce(json(200, { type: 'User' }));

      const outcome = await run(['lloydlim1']);
      expect(outcome.status).toBe('unavailable');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reports a refused team creation with the permission it needs', async () => {
      fetchMock
        .mockResolvedValueOnce(json(200, { type: 'Organization' }))
        .mockResolvedValueOnce(json(403, { message: 'Forbidden' }));

      const outcome = await run([]);
      expect(outcome.status).toBe('failed');
      expect(outcome.status === 'failed' && outcome.error).toContain(
        'Members: write',
      );
    });
  });

  it('fast-forwards a branch without forcing it', async () => {
    fetchMock.mockResolvedValueOnce(json(200)).mockResolvedValueOnce(json(422));

    await expect(
      fastForwardBranch(http, 'tok', 'org', 'repo', 'dev', 'abc'),
    ).resolves.toBe(true);
    expect(call(0)[0]).toBe(
      'https://api.github.com/repos/org/repo/git/refs/heads/dev',
    );
    expect(JSON.parse(call(0)[1].body ?? '{}')).toEqual({
      sha: 'abc',
      force: false,
    });
    await expect(
      fastForwardBranch(http, 'tok', 'org', 'repo', 'uat', 'abc'),
    ).resolves.toBe(false);
  });

  it('tells an organization from a personal account', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { type: 'Organization' }))
      .mockResolvedValueOnce(json(200, { type: 'User' }))
      .mockRejectedValueOnce(new Error('offline'));

    await expect(isOrganizationAccount(http, 'tok', 'org')).resolves.toBe(true);
    await expect(isOrganizationAccount(http, 'tok', 'me')).resolves.toBe(false);
    await expect(isOrganizationAccount(http, 'tok', 'x')).resolves.toBe(false);
  });
});
