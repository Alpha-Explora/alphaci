import {
  deliveredBannerTitle,
  deliveredIterationTitle,
  iterationTitle,
  mergeAllSummary,
  normalizeIteration,
  normalizeIterationRef,
} from '@/features/checklists/model/iteration-rules';
import {
  nextIterationVersion,
  revisionOptions,
  startIterationDescription,
  startIterationInput,
  startIterationLabel,
  waitingForNextIterationText,
} from '@/features/checklists/model/iteration-start-rules';

/* Phase 2, item 6: Iterations carry a release version, vMajor.Minor.Patch
 * (v1.0.0, then v1.0.1 for a patch, v1.1.0 for a minor revision or v2.0.0
 * for a major one), and the Product owner picks which when starting the
 * next one. */

const wire = {
  id: 'it-3',
  number: 3,
  status: 'delivered',
  goal: 'Loyalty',
  deliveredAt: null,
  version: { major: 1, minor: 2, patch: 1, label: 'v1.2.1' },
  revisionType: 'patch',
};

describe('iteration release versions', () => {
  it('reads the version and revision type off the wire', () => {
    const iteration = normalizeIteration(wire);
    expect(iteration?.version).toEqual({
      major: 1,
      minor: 2,
      patch: 1,
      label: 'v1.2.1',
    });
    expect(iteration?.revisionType).toBe('patch');
  });

  it('reads a two-number version from an older backend as patch 0', () => {
    const iteration = normalizeIteration({
      ...wire,
      version: { major: 1, minor: 2, label: 'v1.2' },
      revisionType: 'minor',
    });
    expect(iteration?.version).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
      label: 'v1.2.0',
    });
  });

  it('reads an older payload exactly as before: no version fields at all', () => {
    const { version: _version, revisionType: _revision, ...older } = wire;
    const iteration = normalizeIteration(older);
    expect(iteration).not.toHaveProperty('version');
    expect(iteration).not.toHaveProperty('revisionType');
  });

  it('ignores a malformed version', () => {
    expect(
      normalizeIteration({ ...wire, version: { major: 1 } }),
    ).not.toHaveProperty('version');
    expect(
      normalizeIteration({ ...wire, version: { major: -1, minor: 0 } }),
    ).not.toHaveProperty('version');
  });

  it('names an Iteration by its version once known, by its number before', () => {
    expect(
      iterationTitle({
        number: 3,
        goal: 'Loyalty',
        version: { major: 1, minor: 2, patch: 1 },
      }),
    ).toBe('Version 1.2.1 · Loyalty');
    expect(iterationTitle({ number: 3, goal: null })).toBe('Version 3');
    expect(
      deliveredBannerTitle({
        number: 3,
        deliveredAt: null,
        deliveredByLogin: 'ana',
        version: { major: 2, minor: 0, patch: 0 },
      }),
    ).toBe('Version 2.0.0 delivered by @ana');
  });

  it('names a delivered run by the version label it carries', () => {
    const ref = normalizeIterationRef({
      id: 'it-3',
      number: 3,
      status: 'delivered',
      versionLabel: 'v1.2.1',
    });
    expect(ref).toEqual({
      id: 'it-3',
      number: 3,
      status: 'delivered',
      versionLabel: 'v1.2.1',
    });
    expect(deliveredIterationTitle(ref ?? { number: 0 })).toBe(
      'Version 1.2.1 was delivered',
    );
    expect(deliveredIterationTitle({ number: 3 })).toBe(
      'Version 3 was delivered',
    );
  });

  it('says which version a merge delivered', () => {
    const iteration = normalizeIteration(wire);
    expect(
      mergeAllSummary({ repositories: [], delivered: true, iteration }),
    ).toBe('Version 1.2.1 delivered.');
  });

  it('waits for the next version without guessing its number', () => {
    expect(
      waitingForNextIterationText({
        number: 3,
        deliveredAt: null,
        version: { major: 1, minor: 2, patch: 1 },
      }),
    ).toBe(
      'Version 1.2.1 was delivered. Waiting for the Product owner to start the next version.',
    );
  });

  it('computes the next version as the server does', () => {
    const previous = { major: 1, minor: 2, patch: 1 };
    expect(nextIterationVersion(previous, 'patch')).toEqual({
      major: 1,
      minor: 2,
      patch: 2,
      label: 'v1.2.2',
    });
    expect(nextIterationVersion(previous, 'minor')).toEqual({
      major: 1,
      minor: 3,
      patch: 0,
      label: 'v1.3.0',
    });
    expect(nextIterationVersion(previous, 'major')).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      label: 'v2.0.0',
    });
  });

  it('offers patch, minor and major, each naming the version it leads to', () => {
    expect(
      revisionOptions({ major: 1, minor: 2, patch: 0 }).map((option) => [
        option.value,
        option.label,
      ]),
    ).toEqual([
      ['patch', 'Patch revision · v1.2.1'],
      ['minor', 'Minor revision · v1.3.0'],
      ['major', 'Major revision · v2.0.0'],
    ]);
    expect(revisionOptions(null).map((option) => option.label)).toEqual([
      'Patch revision',
      'Minor revision',
      'Major revision',
    ]);
  });

  it('sends the revision only when one is chosen', () => {
    expect(startIterationInput(' Loyalty ', 'patch')).toEqual({
      goal: 'Loyalty',
      revisionType: 'patch',
    });
    expect(startIterationInput('', 'minor')).toEqual({ revisionType: 'minor' });
    expect(startIterationInput('')).toEqual({});
  });

  it('labels Start and its sentence by version', () => {
    expect(startIterationLabel('1.3.0')).toBe('Start version 1.3.0');
    expect(
      startIterationDescription(4, {
        previous: 'Version 1.2.1',
        next: 'Version 1.3.0',
      }),
    ).toBe(
      "Name what this version is for. Version 1.3.0 starts with an empty checklist: Version 1.2.1's requirements and QA results stay with Version 1.2.1, read-only.",
    );
  });
});
