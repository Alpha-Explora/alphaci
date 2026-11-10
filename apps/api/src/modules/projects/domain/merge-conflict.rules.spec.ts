import { conflictCandidates } from './merge-conflict.rules';

const file = (
  filename: string,
  additions = 1,
  deletions = 0,
  previousFilename?: string,
) => ({
  filename,
  additions,
  deletions,
  previousFilename: previousFilename ?? null,
});

describe('conflictCandidates', () => {
  it('lists only paths changed on both sides, the largest first', () => {
    expect(
      conflictCandidates(
        [file('a.ts', 2), file('b.ts', 10, 5), file('only-head.ts')],
        [file('b.ts', 1), file('a.ts', 1), file('only-base.ts')],
      ),
    ).toEqual([
      { path: 'b.ts', headChanges: 15, baseChanges: 1 },
      { path: 'a.ts', headChanges: 2, baseChanges: 1 },
    ]);
  });

  it('matches a file renamed on one side to its old path', () => {
    expect(
      conflictCandidates(
        [file('src/new.ts', 3, 0, 'src/old.ts')],
        [file('src/old.ts', 1)],
      ),
    ).toEqual([{ path: 'src/new.ts', headChanges: 3, baseChanges: 1 }]);
  });

  it('is empty when the sides touched different files', () => {
    expect(conflictCandidates([file('a.ts')], [file('b.ts')])).toEqual([]);
  });
});
