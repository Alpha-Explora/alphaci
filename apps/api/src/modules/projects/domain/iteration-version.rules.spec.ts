import { nextIterationVersion, versionLabel } from './iteration-version.rules';

describe('iteration versions', () => {
  it('starts at v1.0.0 whatever the revision type', () => {
    expect(nextIterationVersion(null, 'patch')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
    });
  });

  it('a patch revision bumps only the patch number', () => {
    expect(
      nextIterationVersion({ major: 1, minor: 2, patch: 0 }, 'patch'),
    ).toEqual({
      major: 1,
      minor: 2,
      patch: 1,
    });
  });

  it('a minor revision bumps minor and resets patch', () => {
    expect(
      nextIterationVersion({ major: 1, minor: 2, patch: 3 }, 'minor'),
    ).toEqual({
      major: 1,
      minor: 3,
      patch: 0,
    });
  });

  it('a major revision bumps major and resets minor and patch', () => {
    expect(
      nextIterationVersion({ major: 1, minor: 4, patch: 2 }, 'major'),
    ).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
    });
  });

  it('labels a version for people and for Git tags', () => {
    expect(versionLabel({ major: 2, minor: 3, patch: 1 })).toBe('v2.3.1');
  });
});
