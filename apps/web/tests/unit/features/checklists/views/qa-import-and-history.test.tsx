import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QaImportControl } from '../../../../../src/features/checklists/importing/views/qa-import-control';
import { QaProgressHistory } from '../../../../../src/features/checklists/history/views/qa-progress-history';
import { qaImportRepository } from '../../../../../src/features/checklists/data/qa-import-repository';
import { qaHistoryRepository } from '../../../../../src/features/checklists/data/qa-history-repository';

jest.mock(
  '../../../../../src/features/checklists/data/qa-import-repository',
  () => ({
    qaImportRepository: {
      preview: jest.fn(),
      requirements: jest.fn(),
      testCases: jest.fn(),
    },
  }),
);
jest.mock(
  '../../../../../src/features/checklists/data/qa-history-repository',
  () => ({ qaHistoryRepository: { list: jest.fn() } }),
);
const imports = qaImportRepository as jest.Mocked<typeof qaImportRepository>;
const history = qaHistoryRepository as jest.Mocked<typeof qaHistoryRepository>;
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  jest.resetAllMocks();
});
async function click(text: string) {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((entry) => entry.textContent?.trim() === text);
  if (!button) throw new Error(`Missing button ${text}`);
  await act(async () => button.click());
}
it('previews a file before a single atomic Feature import, preserving criteria', async () => {
  const onImported = jest.fn();
  imports.preview.mockResolvedValue([
    {
      name: 'Features',
      headers: ['Feature', 'User story', 'Acceptance criteria'],
      rows: [['Account', 'Sign in', 'Profile shown']],
    },
  ]);
  imports.requirements.mockResolvedValue('1 Features imported.');
  await act(async () =>
    root.render(
      <QaImportControl
        projectId="project"
        mode="requirements"
        onImported={onImported}
      />,
    ),
  );
  await click('Import feature checklist');
  expect(imports.preview).not.toHaveBeenCalled();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    value: [new File(['fixture'], 'features.csv')],
  });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
  expect(document.body.textContent).toContain('Profile shown');
  expect(imports.requirements).not.toHaveBeenCalled();
  await click('Import 1 rows');
  expect(imports.requirements).toHaveBeenCalledWith('project', [
    { row: 2, group: 'Account', title: 'Sign in', details: 'Profile shown' },
  ]);
  expect(onImported).toHaveBeenCalledTimes(1);
  expect(document.body.textContent).toContain('1 Features imported.');
});
it('does not save while a mapped row has errors', async () => {
  imports.preview.mockResolvedValue([
    {
      name: 'Cases',
      headers: ['Category', 'Test case'],
      rows: [['', 'Sign in']],
    },
  ]);
  await act(async () =>
    root.render(
      <QaImportControl
        projectId="p"
        mode="test-cases"
        stories={[
          { requirementId: 'r', itemId: 's', label: 'Account / Login' },
        ]}
        onImported={jest.fn()}
      />,
    ),
  );
  await click('Import test cases');
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', {
    value: [new File(['fixture'], 'cases.csv')],
  });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
  expect(document.body.textContent).toContain(
    'Row 2: Group and Title are required.',
  );
  expect(imports.testCases).not.toHaveBeenCalled();
  expect(
    [...document.querySelectorAll<HTMLButtonElement>('button')].find((entry) =>
      entry.textContent?.startsWith('Import 0 rows'),
    )?.disabled,
  ).toBe(true);
});
it('loads the tracker only on open and paginates without hiding earlier rounds', async () => {
  history.list
    .mockResolvedValueOnce({
      events: [
        {
          id: 'one',
          createdAt: '2026-10-27T00:00:00Z',
          iterationId: 'it',
          iterationNumber: 1,
          runId: 'run',
          itemId: 'story',
          title: 'Login',
          requirementName: 'Account',
          actorLogin: 'qa',
          type: 'status_changed',
          fromStatus: 'pending',
          toStatus: 'failed',
          payload: { notes: 'Profile missing' },
        },
      ],
      nextCursor: 'older',
    })
    .mockResolvedValueOnce({ events: [], nextCursor: null });
  await act(async () =>
    root.render(<QaProgressHistory projectId="p" itemId="story" />),
  );
  expect(history.list).not.toHaveBeenCalled();
  const details = container.querySelector('details')!;
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event('toggle', { bubbles: true }));
  });
  expect(document.body.textContent).toContain('Profile missing');
  await click('Load older events');
  expect(history.list).toHaveBeenLastCalledWith(
    'p',
    { itemId: 'story', before: 'older' },
    expect.any(AbortSignal),
  );
  expect(document.body.textContent).toContain('Profile missing');
});
