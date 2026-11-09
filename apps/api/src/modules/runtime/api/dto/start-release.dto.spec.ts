import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { StartReleaseDto } from './start-release.dto';

const ENV = '0c1d2e3f-4a5b-4c6d-8e7f-000000000001';
const TARGET = '0c1d2e3f-4a5b-4c6d-8e7f-000000000002';

const body = (overrides: Record<string, unknown> = {}) => ({
  repoFullName: 'org/app',
  slot: 'backend',
  branch: 'uat',
  commitSha: 'abc1234',
  ...overrides,
});

async function problems(raw: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(StartReleaseDto, raw), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('StartReleaseDto', () => {
  describe('an untargeted release (the branch pipeline)', () => {
    it.each(['dev', 'uat', 'main'])(
      'accepts the pipeline branch %s',
      async (branch) => {
        expect(await problems(body({ branch }))).toEqual([]);
      },
    );

    it('refuses any other branch, as before', async () => {
      expect(await problems(body({ branch: 'release/staging' }))).toEqual([
        'branch must be one of the following values: dev, uat, main',
      ]);
    });

    it('still refuses an unknown field', async () => {
      expect(await problems(body({ surprise: true }))).toEqual([
        'property surprise should not exist',
      ]);
    });
  });

  describe('a release aimed at one target (an environment pipeline)', () => {
    const targeted = (overrides: Record<string, unknown> = {}) =>
      body({
        branch: 'release/staging',
        environmentId: ENV,
        environmentName: 'staging',
        targetId: TARGET,
        ...overrides,
      });

    it('accepts an environment source branch that is not a pipeline branch', async () => {
      expect(await problems(targeted())).toEqual([]);
    });

    it('accepts a target with no environment', async () => {
      expect(
        await problems(
          targeted({ environmentId: undefined, environmentName: undefined }),
        ),
      ).toEqual([]);
    });

    it('still needs a branch name', async () => {
      expect(await problems(targeted({ branch: '' }))).not.toEqual([]);
    });

    it('needs a target once an environment is named', async () => {
      expect(
        await problems(body({ branch: 'dev', environmentId: ENV })),
      ).toEqual(['targetId must be a UUID']);
    });

    it.each([
      ['environmentId', { environmentId: 'not-a-uuid' }],
      ['targetId', { targetId: 'not-a-uuid' }],
    ])('refuses a malformed %s', async (_name, overrides) => {
      expect(await problems(targeted(overrides))).not.toEqual([]);
    });
  });
});
