import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { StageNode } from '../../../../../../src/features/runs/list/views/stage-node';
import type {
  StageReport,
  StageStatus,
} from '../../../../../../src/features/runs/model/runs-types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/*
 * Every status a stage can report has to draw an icon. blocked and stalled were
 * added so a pipeline that never started stops looking merely slow, but the
 * icon selector's switch did not handle them, so exactly those stages
 * rendered with nothing in the icon slot.
 */
const STATUSES: readonly StageStatus[] = [
  'success',
  'failure',
  'running',
  'cancelled',
  'pending',
  'stalled',
  'blocked',
];

const stage = (status: StageStatus): StageReport => ({
  stage: 'package',
  status,
  runId: 1,
  friendlyMessages: [],
  githubRunUrl: 'https://github.com/acme/app/actions/runs/1',
  updatedAt: '2026-11-10T00:00:00.000Z',
});

describe('StageNode icon', () => {
  let root: Root | null = null;
  let container: HTMLElement;

  async function render(status: StageStatus) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <StageNode
          stage={stage(status)}
          index={0}
          isExpanded={false}
          reduced
          onToggle={() => undefined}
        />,
      );
    });
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });

  it.each(STATUSES)('draws an icon for a %s stage', async (status) => {
    await render(status);

    // An svg, or the running spinner (a styled span): never an empty slot.
    const slot = container.querySelector('.runs-stage-icon');
    expect(slot?.firstElementChild).not.toBeNull();
  });

  it('draws a different icon for a blocked stage than for a pending one', async () => {
    await render('pending');
    const pending = container.querySelector('.runs-stage-icon')?.innerHTML;
    act(() => root?.unmount());
    document.body.innerHTML = '';

    await render('blocked');
    const blocked = container.querySelector('.runs-stage-icon')?.innerHTML;

    expect(blocked).not.toBe(pending);
  });

  it('shows a stalled stage with the failure icon, as its colours do', async () => {
    await render('failure');
    const failure = container.querySelector('.runs-stage-icon')?.innerHTML;
    act(() => root?.unmount());
    document.body.innerHTML = '';

    await render('stalled');

    expect(container.querySelector('.runs-stage-icon')?.innerHTML).toBe(
      failure,
    );
  });
});
