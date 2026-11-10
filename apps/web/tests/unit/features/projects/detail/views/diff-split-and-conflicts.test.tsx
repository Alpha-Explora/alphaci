import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  pairSplitRows,
  parseUnifiedDiff,
  readDiffMode,
} from '../../../../../../src/features/projects/detail/model/unified-diff';
import { DiffView } from '../../../../../../src/features/projects/detail/views/workspace/diff-view';

const PATCH = [
  '@@ -1,3 +1,4 @@ run()',
  ' keep',
  '-old a',
  '-old b',
  '+new a',
  '+new b',
  '+new c',
  ' end',
].join('\n');

describe('pairSplitRows', () => {
  it('pairs a run of deletions with the additions after it, padding the shorter side', () => {
    const rows = pairSplitRows(parseUnifiedDiff(PATCH));
    expect(
      rows.map((row) =>
        row.kind === 'full'
          ? `full:${row.line.kind}`
          : `${row.left?.text ?? '-'}|${row.right?.text ?? '-'}`,
      ),
    ).toEqual([
      'full:hunk',
      'keep|keep',
      'old a|new a',
      'old b|new b',
      '-|new c',
      'end|end',
    ]);
  });

  it('keeps line numbers on their own side', () => {
    const rows = pairSplitRows(parseUnifiedDiff(PATCH));
    const changed = rows[2];
    expect(
      changed.kind === 'pair' && [
        changed.left?.oldNumber,
        changed.right?.newNumber,
      ],
    ).toEqual([2, 2]);
  });

  it('reads an unknown stored mode as unified', () => {
    expect(readDiffMode('split')).toBe('split');
    expect(readDiffMode('sideways')).toBe('unified');
    expect(readDiffMode(null)).toBe('unified');
  });
});

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  window.localStorage.clear();
});

describe('DiffView layout toggle', () => {
  it('switches to side by side, remembers it, and labels both sides for screen readers', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () =>
      root?.render(
        <DiffView
          files={[
            {
              filename: 'a.ts',
              status: 'modified',
              additions: 3,
              deletions: 2,
              patch: PATCH,
            },
          ]}
        />,
      ),
    );
    const split = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Side by side',
    )!;
    expect(split.getAttribute('aria-pressed')).toBe('false');
    await act(async () => split.click());
    expect(split.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('table.ws-difftable--split')).not.toBeNull();
    expect(host.querySelector('thead')?.textContent).toContain('Base');
    expect(window.localStorage.getItem('alphaci.diffMode')).toBe('split');
  });
});
