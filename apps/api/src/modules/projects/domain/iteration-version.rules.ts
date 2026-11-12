/** How the next Iteration moves the release version. */
export type RevisionType = 'major' | 'minor' | 'patch';

export const REVISION_TYPES: readonly RevisionType[] = [
  'major',
  'minor',
  'patch',
];

export interface IterationVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * The first Iteration is v1.0.0. From v1.2.3: patch -> v1.2.4 (fixes only),
 * minor -> v1.3.0 (new features), major -> v2.0.0 (large or breaking
 * changes). Pure.
 */
export function nextIterationVersion(
  previous: IterationVersion | null,
  revision: RevisionType,
): IterationVersion {
  if (!previous) return { major: 1, minor: 0, patch: 0 };
  if (revision === 'major')
    return { major: previous.major + 1, minor: 0, patch: 0 };
  if (revision === 'minor') {
    return { major: previous.major, minor: previous.minor + 1, patch: 0 };
  }
  return {
    major: previous.major,
    minor: previous.minor,
    patch: previous.patch + 1,
  };
}

/** "v1.2.3": the label the UI, reports and Git tags use. */
export function versionLabel(version: IterationVersion): string {
  return `v${String(version.major)}.${String(version.minor)}.${String(version.patch)}`;
}
