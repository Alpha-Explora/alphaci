import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { qaRunsRepository } from '../../../../../src/features/checklists/data/qa-runs-repository';
import { useQaPromotionViewModel } from '../../../../../src/features/checklists/studio/view-models/use-qa-promotion-view-model';
import {
  OverrideDialog,
  OverrideToMain,
} from '../../../../../src/features/checklists/studio/views/promotion-override';

jest.mock(
  '../../../../../src/features/checklists/data/qa-runs-repository',
  () => ({
    qaRunsRepository: { promotion: jest.fn(), mergePromotion: jest.fn() },
  }),
);
jest.mock('@/features/capabilities/current', () => ({
  useCapabilities: jest.fn(() => ({ releaseGovernanceEnabled: true })),
}));

const runs = qaRunsRepository as jest.Mocked<typeof qaRunsRepository>;

const BLOCKED = {
  eligible: false,
  canMerge: true,
  canOverride: true,
  scope: 'project',
  qaBranch: 'uat',
  targetBranch: 'main',
  headSha: 'a'.repeat(40),
  reasons: ['1 item is waiting for the Product owner to pass it'],
  run: {
    id: 'run-1',
    verdict: 'APPROVED',
    signedAt: '2026-10-28T00:00:00Z',
    stale: false,
  },
};

function Harness() {
  const vm = useQaPromotionViewModel({
    projectId: 'p1',
    enabled: true,
    appRole: 'admin',
    watch: null,
  });
  return (
    <>
      <OverrideToMain vm={vm} />
      {vm.data ? (
        <OverrideDialog vm={vm} data={vm.data} projectName="Shop" />
      ) : null}
    </>
  );
}

let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

async function render(status: unknown) {
  runs.promotion.mockResolvedValue(status as never);
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(<Harness />));
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
  return host;
}

const buttonNamed = (name: string) =>
  [...document.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(name),
  ) ?? null;

describe('Override gate', () => {
  it("is not offered without the server's canOverride", async () => {
    await render({ ...BLOCKED, canOverride: false });
    expect(buttonNamed('Override gate')).toBeNull();
  });

  it('names the skipped checks, needs a written reason, and sends it', async () => {
    runs.mergePromotion.mockResolvedValue({
      merged: true,
      sha: 'm',
      message: 'Merged',
      pullRequest: null,
    } as never);
    await render(BLOCKED);

    await act(async () => buttonNamed('Override gate')!.click());
    expect(document.body.textContent).toContain(
      '1 item is waiting for the Product owner to pass it',
    );
    const submit = buttonNamed('Override and merge') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const reason = document.querySelector('textarea')!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setValue.call(reason, 'Hotfix for checkout outage INC-42');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(
      (buttonNamed('Override and merge') as HTMLButtonElement).disabled,
    ).toBe(false);

    await act(async () => buttonNamed('Override and merge')!.click());
    await act(async () => {
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    });
    expect(runs.mergePromotion).toHaveBeenCalledWith(
      'p1',
      'Hotfix for checkout outage INC-42',
    );
  });

  it("keeps the dialog open with the server's words when the override is refused", async () => {
    runs.mergePromotion.mockRejectedValue({
      status: 403,
      details: {
        code: 'DEPLOYMENT_OVERRIDE_FORBIDDEN',
        message: 'Only an admin may merge past the gate.',
      },
    });
    await render(BLOCKED);
    await act(async () => buttonNamed('Override gate')!.click());
    const reason = document.querySelector('textarea')!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    )!.set!;
    await act(async () => {
      setValue.call(reason, 'Hotfix for checkout outage INC-42');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => buttonNamed('Override and merge')!.click());
    await act(async () => {
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    });
    expect(document.body.textContent).toContain(
      'Only an admin may merge past the gate.',
    );
    expect(buttonNamed('Override and merge')).not.toBeNull();
  });
});
