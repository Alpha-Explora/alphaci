import { normalizeRepoShape } from './repo-shape';

describe('normalizeRepoShape', () => {
  it('maps catalog IDs to canonical shapes', () => {
    expect(normalizeRepoShape('mono')).toBe('monorepo');
    expect(normalizeRepoShape('multi')).toBe('multi-repo');
  });

  it('passes canonical shapes through unchanged', () => {
    expect(normalizeRepoShape('monorepo')).toBe('monorepo');
    expect(normalizeRepoShape('multi-repo')).toBe('multi-repo');
    expect(normalizeRepoShape('microservices')).toBe('microservices');
    expect(normalizeRepoShape('standalone')).toBe('standalone');
  });

  it('falls back to standalone for unknown or missing shapes', () => {
    expect(normalizeRepoShape(undefined)).toBe('standalone');
    expect(normalizeRepoShape(null)).toBe('standalone');
    expect(normalizeRepoShape('something-else')).toBe('standalone');
  });
});
