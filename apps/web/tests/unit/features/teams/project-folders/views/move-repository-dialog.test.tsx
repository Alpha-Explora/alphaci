import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { MoveRepositoryViewModel } from '../../../../../../src/features/teams/project-folders/view-models/use-move-repository-view-model';
import { MoveRepositoryDialog } from '../../../../../../src/features/teams/project-folders/views/project-folder-dialogs';
import { foldersSnapshot } from '../folder-fixtures';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('MoveRepositoryDialog access confirmation', () => {
  const { folders } = foldersSnapshot();
  const source = folders[0];
  const repository = source.repositories[0];
  let root: Root | null = null;
  let container: HTMLElement;

  const viewModel = (
    overrides: Partial<MoveRepositoryViewModel> = {},
  ): MoveRepositoryViewModel => ({
    status: 'idle',
    error: null,
    accessLoss: null,
    repository,
    source,
    targetId: 'dp-2',
    notice: null,
    openFor: jest.fn(),
    close: jest.fn(),
    setTargetId: jest.fn(),
    submit: jest.fn().mockResolvedValue(undefined),
    archiveEmptied: jest.fn().mockResolvedValue(undefined),
    dismissNotice: jest.fn(),
    ...overrides,
  });

  async function render(vm: MoveRepositoryViewModel) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<MoveRepositoryDialog vm={vm} targets={folders.slice(1)} />);
    });
    return document.body;
  }

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });

  const buttons = (body: HTMLElement) =>
    [...body.querySelectorAll('button')].map((b) => b.textContent);

  it('is a plain move until the API asks about access', async () => {
    const body = await render(viewModel());

    expect(buttons(body)).toContain('Move repository');
    expect(buttons(body)).not.toContain('Move and remove access');
    expect(body.querySelector('.pf-access-loss')).toBeNull();
  });

  it('names who loses access and asks to confirm', async () => {
    const vm = viewModel({
      accessLoss: {
        message:
          'Moving "frontend" to "wallet" removes GitHub Write from 2 people.',
        people: ['Ada Lovelace', 'bob'],
      },
    });
    const body = await render(vm);

    const warning = body.querySelector('.pf-access-loss');
    expect(warning?.getAttribute('role')).toBe('alert');
    expect(warning?.textContent).toContain(
      'removes GitHub Write from 2 people',
    );
    expect(
      [...warning!.querySelectorAll('li')].map((item) => item.textContent),
    ).toEqual(['Ada Lovelace', 'bob']);
    expect(buttons(body)).toContain('Move and remove access');
    expect(buttons(body)).not.toContain('Move repository');

    const confirm = [...body.querySelectorAll('button')].find(
      (b) => b.textContent === 'Move and remove access',
    )!;
    await act(async () => confirm.click());
    expect(vm.submit).toHaveBeenCalledTimes(1);
  });
});
